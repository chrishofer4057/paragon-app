import { describe, expect, it } from 'vitest';
import { SHIP_TYPES } from '../../data/ships';
import { applyCommand } from '../../engine';
import type { ShipState } from '../../state/gameState';
import type { ShipId } from '../../state/ids';
import { run, runDays, setupGame } from '../../testing/fixtures';
import { amountOf } from '../../systems/storage';

function giveShip(state: ReturnType<typeof setupGame>, crew = 10, hasCaptain = true): ShipState {
  const ship: ShipState = {
    id: 's1' as ShipId,
    name: 'Ursina',
    type: 'schute',
    capacity: 50,
    condition: 100,
    crew,
    hasCaptain,
    cargo: {},
    location: { kind: 'port', cityId: 'NewArk' },
    repairUntilTick: null,
  };
  state.ships[ship.id] = ship;
  return ship;
}

describe('Werft', () => {
  it('baut ab Kaufmann Schiffe, erfahrene Werften schneller', () => {
    const state = setupGame({
      rank: 'merchant',
      money: 100_000,
      kontorIn: ['NewArk'],
      kontorGoods: { Wood: 200, Tools: 50, Oil: 50, Wool: 20 },
    });
    run(state, { type: 'OrderShip', shipType: 'schute', name: 'Erste' });
    const job = Object.values(state.constructions)[0]!;
    expect(job.durationDays).toBeLessThan(SHIP_TYPES.schute.baseBuildDays); // New Ark hat eine erfahrene Werft
    runDays(state, job.durationDays + 1);
    const ship = Object.values(state.ships)[0]!;
    expect(ship.name).toBe('Erste');
    expect(ship.crew).toBe(0);
  });

  it('repariert gegen Geld und Zeit', () => {
    const state = setupGame({ money: 10_000 });
    const ship = giveShip(state);
    ship.condition = 50;
    run(state, { type: 'RepairShip', shipId: ship.id });
    expect(applyCommand(state, { type: 'SendShip', shipId: ship.id, destination: 'Reach' }).result.ok).toBe(
      false,
    );
    runDays(state, 20);
    expect(ship.condition).toBe(100);
  });
});

describe('Kapitän', () => {
  it('ohne Kapitän fährt ein Schiff nur mit der Figur an Bord', () => {
    const state = setupGame({ money: 1000 });
    const ship = giveShip(state, 10, false);
    const send = applyCommand(state, { type: 'SendShip', shipId: ship.id, destination: 'PortNyx' }).result;
    expect(send.ok).toBe(false);
    expect(send.ok ? '' : send.reason).toContain('Kapitän');
    expect(applyCommand(state, { type: 'Travel', destination: 'PortNyx', shipId: ship.id }).result.ok).toBe(
      true,
    );
  });

  it('mit Kapitän lässt sich das Schiff allein losschicken', () => {
    const state = setupGame({ money: 1000 });
    const ship = giveShip(state, 10, true);
    expect(applyCommand(state, { type: 'SendShip', shipId: ship.id, destination: 'PortNyx' }).result.ok).toBe(
      true,
    );
  });

  it('Kapitäne lassen sich schon ab Kaufmann anheuern', () => {
    const state = setupGame({ rank: 'merchant', money: 10_000 });
    const ship = giveShip(state, 10, false);
    state.cities.NewArk.tavern.captainAvailable = true;
    run(state, { type: 'HireCaptain', shipId: ship.id });
    expect(ship.hasCaptain).toBe(true);
  });
});

describe('Seefahrt', () => {
  it('ohne Mindestbesatzung legt kein Schiff ab', () => {
    const state = setupGame({ money: 1000 });
    const ship = giveShip(state, 0);
    expect(applyCommand(state, { type: 'SendShip', shipId: ship.id, destination: 'PortNyx' }).result.ok).toBe(
      false,
    );
    run(state, { type: 'HireSailors', shipId: ship.id, count: SHIP_TYPES.schute.minCrew });
    run(state, { type: 'SendShip', shipId: ship.id, destination: 'PortNyx' });
    runDays(state, 5);
    expect(ship.location).toEqual({ kind: 'port', cityId: 'PortNyx' });
    expect(ship.condition).toBeLessThan(100);
  });

  it('Matrosen kommen aus den Bettlern und kosten Lohn', () => {
    const state = setupGame({ money: 1000 });
    const ship = giveShip(state, 0);
    const beggars = state.cities.NewArk.population.beggars;
    run(state, { type: 'HireSailors', shipId: ship.id, count: 5 });
    expect(state.cities.NewArk.population.beggars).toBe(beggars - 5);
    run(state, { type: 'DismissSailors', shipId: ship.id, count: 5 });
    expect(state.cities.NewArk.population.beggars).toBe(beggars);
  });

  it('die Figur reist an Bord und ist danach in der Zielstadt', () => {
    const state = setupGame();
    const ship = giveShip(state);
    run(state, { type: 'Travel', destination: 'PortNyx', shipId: ship.id });
    expect(state.player.location.kind).toBe('travel');
    expect(applyCommand(state, { type: 'ChopWood', quality: 1 }).result.ok).toBe(false);
    runDays(state, 5);
    expect(state.player.location).toEqual({ kind: 'city', cityId: 'PortNyx' });
  });

  it('Überfahrt als Passagier kostet Geld; Duri zahlt weniger', () => {
    const gian = setupGame({ characterId: 'gian', money: 500 });
    const duri = setupGame({ characterId: 'duri', money: 500 });
    run(gian, { type: 'Travel', destination: 'Riverrun' });
    run(duri, { type: 'Travel', destination: 'Riverrun' });
    expect(duri.player.money).toBeGreaterThan(gian.player.money);
  });

  it('Frachtraum mieten: der Kapitän verkauft am Ziel (abzüglich Provision)', () => {
    const state = setupGame({ rank: 'trader', money: 1000 });
    state.player.inventory.Wood = 10;
    run(state, {
      type: 'ShipCargo',
      good: 'Wood',
      amount: 10,
      destination: 'PortNyx',
      from: { kind: 'inventory' },
    });
    expect(amountOf(state.player.inventory, 'Wood')).toBe(0);
    const money = state.player.money;
    runDays(state, 5);
    expect(state.player.money).toBeGreaterThan(money);
    expect(state.player.consignments).toHaveLength(0);
  });
});
