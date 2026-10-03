import { describe, expect, it } from 'vitest';
import { REPUTATION } from '../data/balance';
import { applyCommand } from '../engine';
import type { BusinessState } from '../state/gameState';
import { run, runDays, setupGame } from '../testing/fixtures';
import {
  effectiveReputation,
  globalReputation,
  standingReputation,
  tradeReputationDelta,
} from './reputation';
import { targetStock } from './demand';

describe('Ansehen', () => {
  it('Verkauf steigert, Einkauf schmälert das lokale Ansehen', () => {
    const state = setupGame({ rank: 'huckster', money: 10_000 });
    state.player.inventory.Grain = 5;
    run(state, { type: 'SellGoods', good: 'Grain', amount: 5, from: { kind: 'inventory' } });
    const afterSale = state.player.reputation.NewArk.societal;
    expect(afterSale).toBeGreaterThan(0);
    run(state, { type: 'BuyGoods', good: 'Grain', amount: 5, into: { kind: 'inventory' } });
    expect(state.player.reputation.NewArk.societal).toBeLessThan(afterSale);
    // andere Städte unberührt
    expect(state.player.reputation.Reach.societal).toBe(0);
  });

  it('knappe Waren bringen beim Verkauf mehr Ansehen', () => {
    const state = setupGame();
    const city = state.cities.NewArk;
    city.market.Fish = targetStock(city, 'Fish') * 3;
    const plenty = tradeReputationDelta(city, 'Fish', 1000, 'sell', false).societal;
    city.market.Fish = targetStock(city, 'Fish') * 0.2;
    const scarce = tradeReputationDelta(city, 'Fish', 1000, 'sell', false).societal;
    expect(scarce).toBeGreaterThan(plenty * 3);
  });

  it('Grundversorgung erreicht auch die Armen, Luxus kaum', () => {
    const state = setupGame();
    const city = state.cities.NewArk;
    const staple = tradeReputationDelta(city, 'Grain', 1000, 'sell', false);
    const luxury = tradeReputationDelta(city, 'Silk', 1000, 'sell', false);
    expect(staple.social / staple.societal).toBeGreaterThan(luxury.social / luxury.societal);
  });

  it('zeitliches Ansehen klingt ab, gestiftetes bleibt', () => {
    const state = setupGame();
    state.player.reputation.NewArk.societal = 10;
    state.player.reputation.NewArk.societalBase = 5;
    runDays(state, 60);
    expect(state.player.reputation.NewArk.societal).toBeLessThan(10 * (1 - REPUTATION.dailyDecay) ** 50);
    expect(state.player.reputation.NewArk.societalBase).toBe(5);
  });

  it('Arbeitsplätze, Kontor und Gilde verschaffen laufende Stellung', () => {
    const state = setupGame({ kontorIn: ['NewArk'] });
    state.player.businesses.b1 = {
      id: 'b1' as BusinessState['id'],
      type: 'woodcutter',
      cityId: 'NewArk',
      effective: true,
      workers: 30,
      utilization: 1,
    };
    state.player.guilds.push('NewArk');
    const standing = standingReputation(state, 'NewArk');
    expect(standing.social).toBeCloseTo(30 * REPUTATION.perWorkerSocial);
    expect(standing.societal).toBeCloseTo(
      30 * REPUTATION.perWorkerSocietal + REPUTATION.kontorSocietal + REPUTATION.guildMemberSocietal,
    );
    expect(standingReputation(state, 'Reach').societal).toBe(0);
  });

  it('Unternehmenswert wirkt hanseweit', () => {
    const state = setupGame();
    state.player.netWorth = REPUTATION.netWorthGlobalCap;
    expect(globalReputation(state).societal).toBeCloseTo(REPUTATION.netWorthGlobalMax);
    expect(effectiveReputation(state, 'Zor').societal).toBeGreaterThan(REPUTATION.netWorthGlobalMax - 0.01);
  });

  it('Infrastruktur stiften bringt dauerhaftes soziales Ansehen', () => {
    const state = setupGame({
      rank: 'merchant',
      money: 50_000,
      kontorIn: ['NewArk'],
      kontorGoods: { Stone: 100, Wood: 20 },
    });
    const wellsBefore = state.cities.NewArk.infrastructure.well;
    run(state, { type: 'FundInfrastructure', infrastructure: 'well' });
    runDays(state, 6);
    expect(state.cities.NewArk.infrastructure.well).toBe(wellsBefore + 1);
    expect(state.player.reputation.NewArk.socialBase).toBeGreaterThan(0);
    // Ein Brunnen pro 500 Einwohner – mehr lehnt die Stadt ab.
    state.cities.NewArk.infrastructure.well = 100;
    expect(applyCommand(state, { type: 'FundInfrastructure', infrastructure: 'well' }).result.ok).toBe(false);
  });
});
