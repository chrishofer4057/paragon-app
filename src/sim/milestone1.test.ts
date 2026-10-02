import { describe, expect, it } from 'vitest';
import { applyCommand, createNewGame, tick } from './engine';
import { amountOf } from './systems/storage';
import { sellPrice } from './systems/prices';

/**
 * Abnahme Meilenstein 1 (CLAUDE.md §9): Figur wählen, Holz hacken, verkaufen und sehen,
 * wie der Preis bei Überangebot fällt und sich über die Zeit erholt.
 */
describe('Meilenstein 1 – vertikaler Ausschnitt', () => {
  it('Figurenbonus wirkt sich aus: der Holzfäller sammelt mehr Holz', () => {
    const gian = createNewGame({ seed: 1, characterId: 'gian' });
    const ursina = createNewGame({ seed: 1, characterId: 'ursina' });
    applyCommand(gian, { type: 'ChopWood', quality: 0.5 });
    applyCommand(ursina, { type: 'ChopWood', quality: 0.5 });
    expect(amountOf(gian.player.inventory, 'Wood')).toBeGreaterThan(
      amountOf(ursina.player.inventory, 'Wood') * 1.5,
    );
  });

  it('besseres Timing im Minispiel bringt mehr Ertrag', () => {
    const good = createNewGame({ seed: 1, characterId: 'gian' });
    const bad = createNewGame({ seed: 1, characterId: 'gian' });
    applyCommand(good, { type: 'ChopWood', quality: 1 });
    applyCommand(bad, { type: 'ChopWood', quality: 0 });
    expect(amountOf(good.player.inventory, 'Wood')).toBeGreaterThan(
      amountOf(bad.player.inventory, 'Wood') * 2,
    );
  });

  it('Holz hacken, verkaufen: Preis fällt bei Überangebot und erholt sich', () => {
    const state = createNewGame({ seed: 3, characterId: 'gian' });
    const city = state.cities.NewArk;

    // Ein paar Tage Holz hacken (Figur ist je Aktion 2 Stunden beschäftigt).
    for (let i = 0; i < 40; i++) {
      const { result } = applyCommand(state, { type: 'ChopWood', quality: 1 });
      expect(result.ok).toBe(true);
      tick(state, 2);
    }
    const wood = Math.floor(amountOf(state.player.inventory, 'Wood'));
    expect(wood).toBeGreaterThanOrEqual(5);

    // Den Markt künstlich mit Holz fluten, damit der Effekt deutlich wird (Überangebot).
    city.market.Wood += 300;
    const flooded = sellPrice(city, 'Wood');
    const moneyBefore = state.player.money;
    const { result } = applyCommand(state, {
      type: 'SellGoods',
      good: 'Wood',
      amount: wood,
      from: { kind: 'inventory' },
    });
    expect(result.ok).toBe(true);
    expect(state.player.money).toBeGreaterThan(moneyBefore);
    const afterSale = sellPrice(city, 'Wood');
    expect(afterSale).toBeLessThan(flooded);

    // Die Bürger verbrauchen Holz, KI-Händler kaufen den Überschuss – der Preis erholt sich.
    tick(state, 24 * 30);
    expect(sellPrice(city, 'Wood')).toBeGreaterThan(afterSale * 1.2);
  });

  it('Verkaufen bringt Ansehen in der Stadt', () => {
    const state = createNewGame({ seed: 3, characterId: 'gian' });
    state.player.inventory.Wood = 10;
    const before = state.player.reputation.NewArk.societal;
    applyCommand(state, { type: 'SellGoods', good: 'Wood', amount: 10, from: { kind: 'inventory' } });
    expect(state.player.reputation.NewArk.societal).toBeGreaterThan(before);
  });
});
