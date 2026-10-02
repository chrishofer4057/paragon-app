import { CARGO_RENTAL, PASSAGE, SHIP_TYPES, SHIP_WEAR_PER_DAY } from '../data/ships';
import { CITIES, mapDistance, type CityId } from '../data/cities';
import { GOODS } from '../data/goods';
import { emit, postMessage, type SimContext } from '../context';
import type { ShipState } from '../state/gameState';
import { daysToTicks } from '../time';
import { quoteSell } from './prices';
import { addReputation, tradeReputationDelta } from './reputation';
import { completePassengerQuests } from './tavern';

/**
 * Reisen (CLAUDE.md §5.3): Die Figur ist immer an genau einem Ort. Reisen geht als
 * Passagier (Überfahrt bezahlen), mit einem eigenen Schiff oder – für Waren ohne
 * Mitreise – als Fracht auf einem Linienschiff (Option B aus §2.5).
 */

export function travelDays(from: CityId, to: CityId, speedPerDay: number): number {
  return Math.max(1, Math.ceil((mapDistance(from, to) / speedPerDay) * 2) / 2);
}

export function passageFare(from: CityId, to: CityId, freightFactor: number): number {
  return Math.round(mapDistance(from, to) * PASSAGE.farePerDistance * freightFactor);
}

export function shipTravelDays(ship: ShipState, from: CityId, to: CityId): number {
  return travelDays(from, to, SHIP_TYPES[ship.type].speedPerDay);
}

export function runTravelHour(ctx: SimContext): void {
  const { state } = ctx;
  for (const ship of Object.values(state.ships)) {
    if (ship.location.kind === 'sea' && ship.location.arriveTick <= state.tick) {
      const days = (ship.location.arriveTick - ship.location.departTick) / 24;
      ship.condition = Math.max(0, ship.condition - days * SHIP_WEAR_PER_DAY);
      const cityId = ship.location.to;
      ship.location = { kind: 'port', cityId };
      emit(ctx, { type: 'ShipArrived', shipId: ship.id, cityId });
    }
    if (ship.repairUntilTick !== null && ship.repairUntilTick <= state.tick) {
      ship.repairUntilTick = null;
      ship.condition = 100;
      postMessage(
        ctx,
        'success',
        'Reparatur fertig',
        `${ship.name} ist wieder seetüchtig.`,
        ship.location.kind === 'port' ? ship.location.cityId : null,
      );
    }
  }
  const loc = state.player.location;
  if (loc.kind === 'travel' && loc.arriveTick <= state.tick) {
    state.player.location = { kind: 'city', cityId: loc.to };
    emit(ctx, { type: 'PlayerArrived', cityId: loc.to });
    completePassengerQuests(ctx, loc.to);
  }
  deliverConsignments(ctx);
}

/** Mitgegebene Fracht: Der Kapitän verkauft am Ziel, abzüglich Provision (§2.5 Option B). */
function deliverConsignments(ctx: SimContext): void {
  const { state } = ctx;
  const p = state.player;
  const due = p.consignments.filter((c) => c.arriveTick <= state.tick);
  if (due.length === 0) return;
  p.consignments = p.consignments.filter((c) => c.arriveTick > state.tick);
  for (const c of due) {
    const city = state.cities[c.to];
    const gross = quoteSell(city, c.good, c.amount, CARGO_RENTAL.captainPriceFactor);
    const rep = tradeReputationDelta(city, c.good, gross, 'sell', false);
    city.market[c.good] += c.amount;
    const net = gross * (1 - CARGO_RENTAL.captainCommission);
    p.money += net;
    addReputation(state, c.to, rep);
    postMessage(
      ctx,
      'info',
      'Fracht verkauft',
      `Der Kapitän hat ${c.amount} ${GOODS[c.good].name} in ${CITIES[c.to].name} für ${Math.round(net)} GS (nach Provision) verkauft.`,
      c.to,
    );
  }
}

export function arrivalTick(stateTick: number, days: number): number {
  return stateTick + daysToTicks(days);
}
