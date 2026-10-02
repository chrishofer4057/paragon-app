import { describe, expect, it } from 'vitest';
import { BUSINESS_LAND_TAX_PER_WEEK, BUSINESS_TYPE_IDS, BUSINESSES, businessForGood } from './businesses';
import { CITIES, CITY_IDS } from './cities';
import { GOOD_IDS, GOODS, type GoodAmounts, type GoodId } from './goods';

const value = (amounts: GoodAmounts) =>
  (Object.entries(amounts) as [GoodId, number][]).reduce((sum, [g, a]) => sum + GOODS[g].basePrice * a, 0);

describe('Spieldaten', () => {
  it('jede Ware hat einen Betrieb, der sie herstellt, und mindestens eine Erzeugerstadt', () => {
    for (const good of GOOD_IDS) {
      expect(businessForGood(good), good).toBeDefined();
      expect(
        CITY_IDS.some((id) => CITIES[id].special === good || CITIES[id].regular.includes(good)),
        good,
      ).toBe(true);
    }
  });

  it('jeder Betrieb ist bei Basispreisen und voller Auslastung profitabel', () => {
    for (const id of BUSINESS_TYPE_IDS) {
      const b = BUSINESSES[id];
      const profit = value(b.outputs) - value(b.inputs) - b.wagesPerWeek - BUSINESS_LAND_TAX_PER_WEEK;
      expect(profit, b.name).toBeGreaterThan(0);
      // Löhne sind nicht nur die Untergrenze – sonst wäre der Betrieb grenzwertig.
      expect(b.wagesPerWeek, b.name).toBeGreaterThan(b.workers * 3);
    }
  });

  it('Veredelung lohnt sich: Erzeugnis ist mehr wert als seine Rohstoffe', () => {
    for (const id of BUSINESS_TYPE_IDS) {
      const b = BUSINESSES[id];
      if (Object.keys(b.inputs).length === 0) continue;
      expect(value(b.outputs), b.name).toBeGreaterThan(value(b.inputs) * 1.3);
    }
  });
});
