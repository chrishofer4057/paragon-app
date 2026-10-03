import { describe, expect, it } from 'vitest';
import { HAGGLE } from '../../data/balance';
import { applyCommand } from '../../engine';
import { run, setupGame } from '../../testing/fixtures';
import { haggleLimit, merchantMood, standardUnitPrice } from '../../systems/haggle';

function sellOffer(state: ReturnType<typeof setupGame>, price: number) {
  return applyCommand(state, {
    type: 'Haggle',
    good: 'Wood',
    amount: 5,
    direction: 'sell',
    pricePerUnit: price,
    storage: { kind: 'inventory' },
  }).result;
}

describe('Feilschen', () => {
  it('ein Angebot innerhalb der Schmerzgrenze bringt mehr als der Marktpreis', () => {
    const state = setupGame({ rank: 'huckster' });
    state.player.inventory.Wood = 5;
    const standard = standardUnitPrice(state, 'NewArk', 'Wood', 5, 'sell');
    const limit = haggleLimit(state, 'NewArk', 'Wood', 5, 'sell');
    expect(limit).toBeGreaterThan(standard);
    const money = state.player.money;
    const result = sellOffer(state, limit * 0.999);
    expect(result).toMatchObject({ ok: true, tag: 'accepted' });
    expect(state.player.money - money).toBeGreaterThan(standard * 5);
    expect(state.player.inventory.Wood ?? 0).toBe(0);
  });

  it('zu gierige Angebote werden abgelehnt und verderben die Laune', () => {
    const state = setupGame({ rank: 'huckster' });
    state.player.inventory.Wood = 5;
    const limit = haggleLimit(state, 'NewArk', 'Wood', 5, 'sell');
    const result = sellOffer(state, limit * 1.5);
    expect(result).toMatchObject({ ok: true, tag: 'offended' });
    expect(state.player.inventory.Wood).toBe(5);
    expect(merchantMood(state, 'NewArk')).toBeLessThan(1);
    // schlechte Laune = weniger Spielraum
    expect(haggleLimit(state, 'NewArk', 'Wood', 5, 'sell')).toBeLessThan(limit);
  });

  it('knapp daneben: der Händler zögert', () => {
    const state = setupGame({ rank: 'huckster' });
    state.player.inventory.Wood = 5;
    const standard = standardUnitPrice(state, 'NewArk', 'Wood', 5, 'sell');
    const limit = haggleLimit(state, 'NewArk', 'Wood', 5, 'sell');
    expect(sellOffer(state, limit + standard * 0.02)).toMatchObject({ ok: true, tag: 'hesitant' });
  });

  it('höchstens drei Versuche je Ware und Tag', () => {
    const state = setupGame({ rank: 'huckster' });
    state.player.inventory.Wood = 5;
    for (let i = 0; i < HAGGLE.attemptsPerGoodPerDay; i++) expect(sellOffer(state, 1e6).ok).toBe(true);
    expect(sellOffer(state, 1).ok).toBe(false);
  });

  it('beim Kaufen gilt die Grenze nach unten', () => {
    const state = setupGame({ rank: 'huckster', money: 10_000 });
    const limit = haggleLimit(state, 'NewArk', 'Grain', 5, 'buy');
    expect(limit).toBeLessThan(standardUnitPrice(state, 'NewArk', 'Grain', 5, 'buy'));
    run(state, {
      type: 'Haggle',
      good: 'Grain',
      amount: 5,
      direction: 'buy',
      pricePerUnit: limit * 1.001,
      storage: { kind: 'inventory' },
    });
    expect(state.player.inventory.Grain).toBe(5);
  });

  it('Tagelöhner dürfen noch nicht feilschen', () => {
    const state = setupGame();
    state.player.inventory.Wood = 5;
    expect(sellOffer(state, 1).ok).toBe(false);
  });
});
