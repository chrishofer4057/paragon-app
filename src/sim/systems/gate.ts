import { GATE } from '../data/balance';
import { CITY_IDS } from '../data/cities';
import { GOOD_IDS, GOODS } from '../data/goods';
import type { SimContext } from '../context';
import { nextRange, pick } from '../rng';

/**
 * Landesherr am Stadttor (Landesfürst, Tippsammlung 6.5.1): fragt jeden Monat vier Waren
 * zu guten Preisen nach. Handeln darf nur, wer in der Stadt Ratsherr ist.
 */

export function runGateMonth(ctx: SimContext): void {
  const { state } = ctx;
  const candidates = GOOD_IDS.filter((g) => GOODS[g].category !== 'material' || g === 'Tools');
  for (const cityId of CITY_IDS) {
    const city = state.cities[cityId];
    const chosen = new Set<(typeof GOOD_IDS)[number]>();
    while (chosen.size < GATE.goodsPerMonth) chosen.add(pick(state.rng, candidates));
    city.gate = [...chosen].map((good) => ({
      good,
      remaining: GATE.maxUnitsPerGood,
      pricePerUnit: Math.round(
        GOODS[good].basePrice * nextRange(state.rng, GATE.priceFactorMin, GATE.priceFactorMax),
      ),
    }));
  }
}
