import { describe, expect, it } from 'vitest';
import { GOOD_IDS } from '../data/goods';
import { HOUSES } from '../data/buildings';
import type { BusinessState } from '../state/gameState';
import { run, runDays, setupGame } from '../testing/fixtures';
import { targetStock } from './demand';
import { computeHappiness, happinessLevel, housingCapacity } from './population';
import { runHiringDay } from './businesses';

describe('Bevölkerung', () => {
  it('Zufriedenheit hängt am Warenangebot', () => {
    const state = setupGame();
    const city = state.cities.NewArk;
    for (const g of GOOD_IDS) city.market[g] = targetStock(city, g);
    const supplied = computeHappiness(state, city, 'poor');
    for (const g of GOOD_IDS) city.market[g] = 0;
    const starving = computeHappiness(state, city, 'poor');
    expect(happinessLevel(supplied)).toBeGreaterThanOrEqual(4);
    expect(happinessLevel(starving)).toBe(0);
  });

  it('Reiche hängen an Luxus, Arme nicht', () => {
    const state = setupGame();
    const city = state.cities.NewArk;
    for (const g of GOOD_IDS) city.market[g] = targetStock(city, g);
    const richBefore = computeHappiness(state, city, 'rich');
    const poorBefore = computeHappiness(state, city, 'poor');
    city.market.Wine = 0;
    city.market.Silk = 0;
    expect(richBefore - computeHappiness(state, city, 'rich')).toBeGreaterThan(
      poorBefore - computeHappiness(state, city, 'poor'),
    );
  });

  it('versorgte Städte wachsen, hungernde schrumpfen', () => {
    const fed = setupGame();
    const starved = setupGame();
    const pop = (s: typeof fed) => s.cities.Reach.population.rich + s.cities.Reach.population.wealthy;
    const start = pop(fed);
    for (let day = 0; day < 30; day++) {
      for (const g of GOOD_IDS) fed.cities.Reach.market[g] = targetStock(fed.cities.Reach, g) * 1.5;
      for (const g of GOOD_IDS) starved.cities.Reach.market[g] = 0;
      runDays(fed, 1);
      runDays(starved, 1);
    }
    expect(pop(fed)).toBeGreaterThan(start);
    expect(pop(starved)).toBeLessThan(start);
  });

  it('neue Arbeiter kommen aus den Bettlern und brauchen Wohnraum für Arme', () => {
    const state = setupGame();
    const city = state.cities.NewArk;
    city.population.beggars = 200;
    city.housing.poor = Math.ceil(city.population.poor); // voll belegt
    state.player.businesses.b1 = {
      id: 'b1' as BusinessState['id'],
      type: 'woodcutter',
      cityId: 'NewArk',
      effective: true,
      workers: 0,
      utilization: 1,
    };
    runHiringDay(state);
    expect(state.player.businesses.b1!.workers).toBe(0);
    city.housing.poor += 100;
    runHiringDay(state);
    expect(state.player.businesses.b1!.workers).toBeGreaterThan(0);
    expect(city.population.beggars).toBeLessThan(200);
  });

  it('Spielerhäuser erweitern den Wohnraum und bringen Miete', () => {
    const state = setupGame({
      rank: 'merchant',
      money: 50_000,
      kontorIn: ['NewArk'],
      kontorGoods: { Stone: 100, Wood: 100, Tools: 20 },
    });
    const city = state.cities.NewArk;
    run(state, { type: 'BuildHouse', houseType: 'cottage' });
    runDays(state, HOUSES.cottage.buildDays + 1);
    // Gesamtkapazität = städtischer Wohnraum (baut die Stadt selbst nach) + Spielerhäuser
    expect(housingCapacity(state, city, 'poor')).toBe(city.housing.poor + HOUSES.cottage.capacity);
    const house = Object.values(state.player.houses)[0]!;
    runDays(state, 7);
    expect(house.tenants).toBeGreaterThan(0);
  });

  it('Schule erhöht den Bettlerzustrom', () => {
    const plain = setupGame();
    const school = setupGame();
    school.cities.NewArk.infrastructure.school = 1;
    for (const s of [plain, school]) {
      for (const g of GOOD_IDS) s.cities.NewArk.market[g] = targetStock(s.cities.NewArk, g) * 2;
      s.cities.NewArk.population.beggars = 0;
    }
    runDays(plain, 1);
    runDays(school, 1);
    expect(school.cities.NewArk.population.beggars).toBeGreaterThan(plain.cities.NewArk.population.beggars);
  });
});
