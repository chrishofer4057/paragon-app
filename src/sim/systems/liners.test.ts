import { describe, expect, it } from 'vitest';
import { LINE_IDS, LINER, LINES } from '../data/lines';
import { CITY_IDS } from '../data/cities';
import { applyCommand, tick } from '../engine';
import { run, setupGame } from '../testing/fixtures';
import { connectionsFrom, lineSchedule, linersInPort, lineTravelHours, nextDeparture } from './liners';
import { amountOf } from './storage';

describe('Linienschiffe', () => {
  it('jede Stadt wird von mindestens einer Linie angefahren', () => {
    for (const city of CITY_IDS) {
      expect(
        LINE_IDS.some((l) => LINES[l].stops.includes(city)),
        city,
      ).toBe(true);
    }
  });

  it('Abfahrten liegen in der Zukunft und wiederholen sich im Takt', () => {
    for (const lineId of LINE_IDS) {
      const stop = LINES[lineId].stops[0]!;
      const first = nextDeparture(lineId, stop, 1000)!;
      expect(first).toBeGreaterThanOrEqual(1000);
      const second = nextDeparture(lineId, stop, first + 1)!;
      const { cycleHours } = lineSchedule(lineId);
      expect(second - first).toBeCloseTo(cycleHours / LINES[lineId].ships, -1);
    }
  });

  it('Fahrzeit entlang der Linie wächst mit der Zahl der Stationen', () => {
    const stops = LINES.central.stops;
    expect(lineTravelHours('central', stops[0]!, stops[2]!)!).toBeGreaterThan(
      lineTravelHours('central', stops[0]!, stops[1]!)!,
    );
  });

  it('Mitreisen mit Fracht: Figur und Ware kommen am Ziel an, Ware im Hafenlager', () => {
    const state = setupGame({ rank: 'trader', money: 2000 });
    state.player.inventory.Wood = 10;
    const connection = connectionsFrom(state, 'NewArk').find((c) => c.destination === 'PortNyx')!;
    run(state, {
      type: 'BookLiner',
      lineId: connection.lineId,
      destination: 'PortNyx',
      cargo: { good: 'Wood', amount: 10, from: { kind: 'inventory' } },
    });
    expect(state.player.inventory.Wood ?? 0).toBe(0);
    tick(state, connection.departTick - state.tick + 1);
    expect(state.player.location.kind).toBe('travel');
    tick(state, connection.arriveTick - state.tick + 1);
    expect(state.player.location).toEqual({ kind: 'city', cityId: 'PortNyx' });
    expect(amountOf(state.player.holds.PortNyx!, 'Wood')).toBe(10);
    run(state, { type: 'SellGoods', good: 'Wood', amount: 10, from: { kind: 'hold', cityId: 'PortNyx' } });
  });

  it('wer nicht am Hafen ist, verpasst das Schiff – die Fracht reist trotzdem', () => {
    const state = setupGame({ rank: 'trader', money: 2000 });
    state.player.inventory.Wood = 5;
    const connection = connectionsFrom(state, 'NewArk').find((c) => c.destination === 'Nexara')!;
    run(state, {
      type: 'BookLiner',
      lineId: connection.lineId,
      destination: 'Nexara',
      cargo: { good: 'Wood', amount: 5, from: { kind: 'inventory' } },
    });
    state.player.location = {
      kind: 'travel',
      from: 'NewArk',
      to: 'Eos',
      departTick: state.tick,
      arriveTick: state.tick + 9999,
      shipId: null,
    };
    tick(state, connection.arriveTick - state.tick + 1);
    expect(state.messages.some((m) => m.title === 'Schiff verpasst')).toBe(true);
    expect(amountOf(state.player.holds.Nexara!, 'Wood')).toBe(5);
  });

  it('nur eine Buchung gleichzeitig; Fracht erst ab Händler', () => {
    const state = setupGame({ money: 2000 });
    state.player.inventory.Wood = 5;
    const c = connectionsFrom(state, 'NewArk')[0]!;
    expect(
      applyCommand(state, {
        type: 'BookLiner',
        lineId: c.lineId,
        destination: c.destination,
        cargo: { good: 'Wood', amount: 5, from: { kind: 'inventory' } },
      }).result.ok,
    ).toBe(false);
    run(state, { type: 'BookLiner', lineId: c.lineId, destination: c.destination });
    expect(
      applyCommand(state, { type: 'BookLiner', lineId: c.lineId, destination: c.destination }).result.ok,
    ).toBe(false);
    run(state, { type: 'CancelLiner' });
    expect(state.player.linerBooking).toBeNull();
  });

  it('Linienschiff ist günstiger als eine gecharterte Überfahrt', async () => {
    const { passageFare } = await import('./travel');
    const state = setupGame();
    const c = connectionsFrom(state, 'NewArk').find((x) => x.destination === 'PortNyx')!;
    expect(c.fare).toBeLessThan(passageFare('NewArk', 'PortNyx', 1));
  });
});

describe('Linienschiffe im Hafen', () => {
  it('liegen während der Liegezeit vor der Abfahrt im Hafen', () => {
    const dep = nextDeparture('southeast', 'NewArk', 1000)!;
    expect(linersInPort('NewArk', dep - 1)).toContain('southeast');
    expect(linersInPort('NewArk', dep - LINER.stopHours)).toContain('southeast');
    expect(linersInPort('NewArk', dep - LINER.stopHours - 1)).not.toContain('southeast');
  });

  it('nur Linien, die die Stadt anlaufen', () => {
    for (let t = 0; t < 2000; t += 7) {
      for (const id of linersInPort('Moira', t)) expect(LINES[id].stops).toContain('Moira');
    }
  });
});
