import { CHARACTERS } from '../data/characters';
import { CITIES, mapDistance, type CityId } from '../data/cities';
import { GOODS } from '../data/goods';
import { LINE_IDS, LINER, LINES, type LineId } from '../data/lines';
import { emit, postMessage, type SimContext } from '../context';
import type { GameState } from '../state/gameState';
import { HOURS_PER_DAY } from '../time';
import { completePassengerQuests } from './tavern';
import { addGoods } from './storage';

/**
 * Fahrplan der Linienschiffe. Ein Umlauf: Segmentfahrzeiten + Liegezeiten. Die Schiffe
 * einer Linie sind gleichmäßig über den Umlauf verteilt.
 */

function segmentHours(from: CityId, to: CityId): number {
  return Math.max(12, Math.round((mapDistance(from, to) / LINER.speedPerDay) * HOURS_PER_DAY));
}

/** Abfahrtszeit (Stunden ab Umlaufbeginn) an jeder Station und Gesamtdauer des Umlaufs. */
export function lineSchedule(lineId: LineId): { departOffsets: number[]; cycleHours: number } {
  const stops = LINES[lineId].stops;
  const departOffsets: number[] = [];
  let t = 0;
  for (let i = 0; i < stops.length; i++) {
    t += LINER.stopHours;
    departOffsets.push(t);
    t += segmentHours(stops[i]!, stops[(i + 1) % stops.length]!);
  }
  return { departOffsets, cycleHours: t };
}

/** Nächste Abfahrt der Linie in `cityId` ab `afterTick` (inklusive). */
export function nextDeparture(lineId: LineId, cityId: CityId, afterTick: number): number | null {
  const index = LINES[lineId].stops.indexOf(cityId);
  if (index < 0) return null;
  const { departOffsets, cycleHours } = lineSchedule(lineId);
  const spacing = cycleHours / LINES[lineId].ships;
  const offset = departOffsets[index]!;
  // Abfahrten bei offset + k * spacing
  const k = Math.ceil((afterTick - offset) / spacing);
  return Math.round(offset + k * spacing);
}

/** Linien, deren Schiff gerade in `cityId` liegt (Liegezeit bis einschließlich Abfahrtsstunde). */
export function linersInPort(cityId: CityId, tick: number): LineId[] {
  return LINE_IDS.filter((id) => {
    const next = nextDeparture(id, cityId, tick);
    return next !== null && next - tick <= LINER.stopHours;
  });
}

/** Fahrzeit (Stunden) von Station A nach B entlang der Linie, inkl. Zwischenhalten. */
export function lineTravelHours(lineId: LineId, from: CityId, to: CityId): number | null {
  const stops = LINES[lineId].stops;
  const a = stops.indexOf(from);
  const b = stops.indexOf(to);
  if (a < 0 || b < 0 || a === b) return null;
  let hours = 0;
  let i = a;
  while (i !== b) {
    const next = (i + 1) % stops.length;
    hours += segmentHours(stops[i]!, stops[next]!);
    if (next !== b) hours += LINER.stopHours;
    i = next;
  }
  return hours;
}

/** Fahrtstrecke (Kartenpunkte) entlang der Linie – Grundlage für Fahrpreise. */
export function lineDistance(lineId: LineId, from: CityId, to: CityId): number {
  const stops = LINES[lineId].stops;
  let i = stops.indexOf(from);
  const b = stops.indexOf(to);
  let distance = 0;
  while (i !== b && i >= 0 && b >= 0) {
    const next = (i + 1) % stops.length;
    distance += mapDistance(stops[i]!, stops[next]!);
    i = next;
  }
  return distance;
}

export function linerFare(state: GameState, lineId: LineId, from: CityId, to: CityId): number {
  const factor = CHARACTERS[state.player.characterId].freightFactor;
  return Math.round(lineDistance(lineId, from, to) * LINER.farePerDistance * factor);
}

export function linerCargoFee(
  state: GameState,
  lineId: LineId,
  from: CityId,
  to: CityId,
  amount: number,
): number {
  const factor = CHARACTERS[state.player.characterId].freightFactor;
  return Math.round(amount * lineDistance(lineId, from, to) * LINER.cargoPerUnitPerDistance * factor);
}

export interface Connection {
  lineId: LineId;
  lineName: string;
  destination: CityId;
  departTick: number;
  arriveTick: number;
  fare: number;
}

/** Alle direkten Verbindungen ab einer Stadt (je Ziel die früheste Ankunft). */
export function connectionsFrom(state: GameState, cityId: CityId): Connection[] {
  const best = new Map<CityId, Connection>();
  for (const lineId of LINE_IDS) {
    const depart = nextDeparture(lineId, cityId, state.tick + 1);
    if (depart === null) continue;
    for (const destination of LINES[lineId].stops) {
      const hours = lineTravelHours(lineId, cityId, destination);
      if (hours === null) continue;
      const connection: Connection = {
        lineId,
        lineName: LINES[lineId].name,
        destination,
        departTick: depart,
        arriveTick: depart + hours,
        fare: linerFare(state, lineId, cityId, destination),
      };
      const existing = best.get(destination);
      if (!existing || connection.arriveTick < existing.arriveTick) best.set(destination, connection);
    }
  }
  return [...best.values()].sort((a, b) => a.arriveTick - b.arriveTick);
}

/** Buchung abwickeln: Abfahrt (Figur geht an Bord oder verpasst das Schiff) und Ankunft (Fracht ins Hafenlager). */
export function runLinersHour(ctx: SimContext): void {
  const { state } = ctx;
  const p = state.player;
  const booking = p.linerBooking;
  if (!booking) return;
  if (!booking.departed && state.tick >= booking.departTick) {
    booking.departed = true;
    const loc = p.location;
    if (loc.kind === 'city' && loc.cityId === booking.from && p.busyUntilTick <= state.tick) {
      p.location = {
        kind: 'travel',
        from: booking.from,
        to: booking.to,
        departTick: booking.departTick,
        arriveTick: booking.arriveTick,
        shipId: null,
      };
      booking.passengerAboard = true;
    } else {
      postMessage(
        ctx,
        'warning',
        'Schiff verpasst',
        `Die ${LINES[booking.lineId].name} hat ohne Euch abgelegt.${booking.cargo ? ' Eure Fracht reist trotzdem mit.' : ''}`,
        booking.from,
      );
    }
  }
  if (booking.departed && state.tick >= booking.arriveTick) {
    if (booking.cargo) {
      const hold = (p.holds[booking.to] ??= {});
      addGoods(hold, booking.cargo.good, booking.cargo.amount);
      postMessage(
        ctx,
        'info',
        'Fracht angekommen',
        `${booking.cargo.amount} ${GOODS[booking.cargo.good].name} liegen im Hafenlager von ${CITIES[booking.to].name}.`,
        booking.to,
      );
    }
    if (booking.passengerAboard && p.location.kind === 'travel') {
      p.location = { kind: 'city', cityId: booking.to };
      emit(ctx, { type: 'PlayerArrived', cityId: booking.to });
      completePassengerQuests(ctx, booking.to);
    }
    p.linerBooking = null;
  }
}
