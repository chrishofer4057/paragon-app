import { describe, expect, it } from 'vitest';
import { BUSINESSES, BUSINESS_LAND_TAX_PER_WEEK } from '../data/businesses';
import { applyCommand } from '../engine';
import type { BusinessState } from '../state/gameState';
import { run, runDays, setupGame } from '../testing/fixtures';
import { canBuildBusinessIn, isEffectiveIn, outputFactor, productionBonus } from './businesses';
import { amountOf } from './storage';

const MATERIALS = { Stone: 500, Wood: 500, Tools: 200, Wool: 20 };

function onlyBusiness(state: ReturnType<typeof setupGame>): BusinessState {
  const list = Object.values(state.player.businesses);
  expect(list).toHaveLength(1);
  return list[0]!;
}

describe('Betriebe', () => {
  it('braucht den Rang Kaufmann und ein Kontor in der Stadt', () => {
    const noRank = setupGame({ money: 50_000, kontorIn: ['NewArk'] });
    expect(applyCommand(noRank, { type: 'BuildBusiness', businessType: 'woodcutter' }).result.ok).toBe(false);
    const noKontor = setupGame({ money: 50_000, rank: 'merchant' });
    expect(applyCommand(noKontor, { type: 'BuildBusiness', businessType: 'woodcutter' }).result.ok).toBe(
      false,
    );
  });

  it('effektiv nur bei gelisteten Waren, Exoten nur dort, wo sie vorkommen', () => {
    expect(isEffectiveIn('NewArk', 'grainFarm')).toBe(true);
    expect(isEffectiveIn('NewArk', 'fishery')).toBe(false);
    expect(canBuildBusinessIn('NewArk', 'fishery')).toBe(true); // ineffektiv erlaubt
    expect(canBuildBusinessIn('NewArk', 'dragonHunter')).toBe(false);
    expect(canBuildBusinessIn('Druumora', 'dragonHunter')).toBe(true);
    // Weinbau ineffektiv nur im Süden
    expect(canBuildBusinessIn('Riverrun', 'vineyard')).toBe(true);
    expect(canBuildBusinessIn('Reach', 'vineyard')).toBe(false);
  });

  it('wird von einem Bautrupp gebaut, stellt Arbeiter ein und produziert ins Kontor', () => {
    const state = setupGame({
      money: 50_000,
      rank: 'merchant',
      kontorIn: ['NewArk'],
      kontorGoods: MATERIALS,
    });
    run(state, { type: 'BuildBusiness', businessType: 'woodcutter' });
    expect(Object.values(state.constructions)).toHaveLength(1);
    // Material wurde aus dem Kontor genommen
    expect(amountOf(state.player.kontors.NewArk!.storage, 'Stone')).toBe(500 - 25);
    runDays(state, BUSINESSES.woodcutter.buildDays - 1);
    expect(Object.keys(state.player.businesses)).toHaveLength(0);
    runDays(state, 2);
    const business = onlyBusiness(state);
    expect(business.effective).toBe(true);
    const woodBefore = amountOf(state.player.kontors.NewArk!.storage, 'Wood');
    runDays(state, 14);
    expect(business.workers).toBe(BUSINESSES.woodcutter.workers);
    expect(amountOf(state.player.kontors.NewArk!.storage, 'Wood')).toBeGreaterThan(woodBefore + 10);
  });

  it('verarbeitet Rohstoffe aus dem Kontor und steht ohne sie still', () => {
    const state = setupGame({
      money: 100_000,
      rank: 'merchant',
      kontorIn: ['NewArk'],
      kontorGoods: MATERIALS,
    });
    run(state, { type: 'BuildBusiness', businessType: 'workshop' });
    runDays(state, BUSINESSES.workshop.buildDays + 5);
    const business = onlyBusiness(state);
    const storage = state.player.kontors.NewArk!.storage;
    storage.GhostIron = 0;
    const toolsBefore = amountOf(storage, 'Tools');
    runDays(state, 3);
    expect(amountOf(storage, 'Tools')).toBeCloseTo(toolsBefore, 5);
    storage.GhostIron = 10;
    runDays(state, 3);
    expect(amountOf(storage, 'Tools')).toBeGreaterThan(toolsBefore);
    expect(amountOf(storage, 'GhostIron')).toBeLessThan(10);
    expect(business.workers).toBeGreaterThan(0);
  });

  it('ineffektive Betriebe produzieren nur halb so viel', () => {
    const state = setupGame();
    const effective: BusinessState = {
      id: 'b1' as BusinessState['id'],
      type: 'grainFarm',
      cityId: 'NewArk',
      effective: true,
      workers: 30,
      utilization: 1,
    };
    const ineffective = { ...effective, effective: false };
    expect(outputFactor(state, ineffective, false)).toBeCloseTo(outputFactor(state, effective, false) / 2);
  });

  it('Produktionsbonus ab 3/6/9 gleichen Betrieben', () => {
    expect(productionBonus(2)).toBe(1);
    expect(productionBonus(3)).toBe(1.03);
    expect(productionBonus(6)).toBe(1.06);
    expect(productionBonus(9)).toBe(1.1);
  });

  it('Anbaubetriebe im Norden produzieren im Winter weniger', () => {
    const state = setupGame();
    const farm: BusinessState = {
      id: 'b1' as BusinessState['id'],
      type: 'grainFarm',
      cityId: 'Reach',
      effective: true,
      workers: 30,
      utilization: 1,
    };
    const southFarm = { ...farm, cityId: 'Riverrun' as const };
    expect(outputFactor(state, farm, true)).toBeLessThan(outputFactor(state, farm, false));
    expect(outputFactor(state, southFarm, true)).toBe(outputFactor(state, southFarm, false));
  });

  it('kostet wöchentlich Löhne und Grundsteuer (die an die Stadtkasse geht)', () => {
    const state = setupGame({
      money: 100_000,
      rank: 'merchant',
      kontorIn: ['NewArk'],
      kontorGoods: MATERIALS,
    });
    run(state, { type: 'BuildBusiness', businessType: 'woodcutter' });
    runDays(state, 30);
    const treasuryBefore = state.cities.NewArk.treasury;
    runDays(state, 7);
    expect(state.cities.NewArk.treasury - treasuryBefore).toBeGreaterThanOrEqual(BUSINESS_LAND_TAX_PER_WEEK);
  });

  it('Auslastung 0 entlässt alle Arbeiter', () => {
    const state = setupGame({
      money: 100_000,
      rank: 'merchant',
      kontorIn: ['NewArk'],
      kontorGoods: MATERIALS,
    });
    run(state, { type: 'BuildBusiness', businessType: 'woodcutter' });
    runDays(state, 20);
    const business = onlyBusiness(state);
    run(state, { type: 'SetUtilization', businessId: business.id, utilization: 0 });
    runDays(state, 1);
    expect(business.workers).toBe(0);
  });
});
