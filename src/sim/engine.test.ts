import { describe, expect, it } from 'vitest';
import { CHARACTER_IDS, CHARACTERS } from './data/characters';
import { CITY_IDS, CITIES } from './data/cities';
import { applyCommand, applyCommandPure, createNewGame, tick } from './engine';
import type { Command } from './commands/commands';
import { run, runDays, setupGame } from './testing/fixtures';
import { totalPopulation } from './systems/demand';
import { sellPrice } from './systems/prices';

describe('createNewGame', () => {
  it('legt alle 26 Städte mit Markt und Bevölkerung an', () => {
    const state = createNewGame({ seed: 1, characterId: 'gian' });
    expect(Object.keys(state.cities)).toHaveLength(26);
    for (const id of CITY_IDS) {
      expect(totalPopulation(state.cities[id])).toBeGreaterThan(0);
      expect(Object.values(state.cities[id].market).every((v) => v >= 0)).toBe(true);
    }
  });

  it('teilt Städte nach Kartenposition in nordisch und südlich', () => {
    expect(CITIES.Valtirock.culture).toBe('north');
    expect(CITIES.Riverrun.culture).toBe('south');
  });

  it('startet die Figur mittellos als Tagelöhner in der Startstadt', () => {
    for (const id of CHARACTER_IDS) {
      const state = createNewGame({ seed: 1, characterId: id });
      expect(state.player.rank).toBe('dayLaborer');
      expect(state.player.money).toBe(CHARACTERS[id].startMoney);
      expect(state.player.location).toEqual({ kind: 'city', cityId: CHARACTERS[id].startCity });
      expect(Object.keys(state.player.kontors)).toHaveLength(0);
    }
  });

  it('ist reines JSON (Speichern/Laden ohne Verlust)', () => {
    const state = createNewGame({ seed: 5, characterId: 'ursina' });
    runDays(state, 10);
    expect(JSON.parse(JSON.stringify(state))).toEqual(state);
  });
});

describe('Determinismus', () => {
  const script: Command[] = [
    { type: 'ChopWood', quality: 0.8 },
    { type: 'SellGoods', good: 'Wood', amount: 0 + 1, from: { kind: 'inventory' } },
  ];

  function play(seed: number) {
    const state = createNewGame({ seed, characterId: 'gian' });
    for (let day = 0; day < 20; day++) {
      for (const command of script) applyCommand(state, command);
      tick(state, 24);
    }
    return state;
  }

  it('gleicher Seed + gleiche Commands = identischer Zustand', () => {
    expect(play(77)).toEqual(play(77));
  });

  it('anderer Seed = andere Welt', () => {
    expect(play(77)).not.toEqual(play(78));
  });
});

describe('applyCommand', () => {
  it('ungültige Commands ändern nichts und nennen einen Grund', () => {
    const state = setupGame();
    const before = JSON.stringify(state);
    const outcome = applyCommand(state, {
      type: 'SellGoods',
      good: 'Silk',
      amount: 5,
      from: { kind: 'inventory' },
    });
    expect(outcome.result.ok).toBe(false);
    if (!outcome.result.ok) expect(outcome.result.reason).toMatch(/Nicht genug/);
    expect(JSON.stringify(state)).toBe(before);
  });

  it('verweigert Aktionen oberhalb des eigenen Rangs', () => {
    const state = setupGame({ money: 100_000 });
    const before = JSON.stringify(state);
    const outcome = applyCommand(state, { type: 'FoundKontor' });
    expect(outcome.result).toEqual({ ok: false, reason: expect.stringMatching(/Händler/) });
    expect(JSON.stringify(state)).toBe(before);
  });

  it('applyCommandPure lässt den Eingabezustand unverändert', () => {
    const state = setupGame();
    const before = JSON.stringify(state);
    const outcome = applyCommandPure(state, { type: 'ChopWood', quality: 1 });
    expect(outcome.result.ok).toBe(true);
    expect(JSON.stringify(state)).toBe(before);
    expect(outcome.state.player.inventory.Wood).toBeGreaterThan(0);
  });

  it('sperrt die Figur, solange sie beschäftigt ist', () => {
    const state = setupGame();
    run(state, { type: 'ChopWood', quality: 1 });
    expect(applyCommand(state, { type: 'ChopWood', quality: 1 }).result.ok).toBe(false);
    tick(state, 2);
    expect(applyCommand(state, { type: 'ChopWood', quality: 1 }).result.ok).toBe(true);
  });
});

describe('Ein Jahr ohne Spieler', () => {
  it('bleibt die Welt im Gleichgewicht (kein Zusammenbruch, keine Explosion)', () => {
    const state = createNewGame({ seed: 42, characterId: 'gian' });
    const before = CITY_IDS.reduce((sum, id) => sum + totalPopulation(state.cities[id]), 0);
    runDays(state, 360);
    const after = CITY_IDS.reduce((sum, id) => sum + totalPopulation(state.cities[id]), 0);
    expect(after / before).toBeGreaterThan(0.85);
    expect(after / before).toBeLessThan(1.25);
    for (const id of CITY_IDS) {
      for (const value of Object.values(state.cities[id].market)) expect(Number.isFinite(value)).toBe(true);
      expect(sellPrice(state.cities[id], 'Grain')).toBeGreaterThan(0);
    }
  }, 30_000);
});
