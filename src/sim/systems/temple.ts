import { TEMPLE_MATERIAL_PRICE_LIMIT, TEMPLE_STAGES } from '../data/buildings';
import { CITY_IDS } from '../data/cities';
import { GOODS, type GoodId } from '../data/goods';
import type { SimContext } from '../context';
import { enqueueConstruction } from './construction';
import { buyPrice } from './prices';
import { amountOf } from './storage';

/**
 * Tempelausbau (Kirchenausbau, Tippsammlung 2.1.1.7.4): Sind genug Spenden beisammen,
 * kauft der Priester täglich Baumaterial – aber nur bis zu einem Preislimit. Erst wenn
 * alles da ist, beginnt der Bau und bindet einen Bautrupp.
 */

export function runTempleDay(ctx: SimContext): void {
  const { state } = ctx;
  for (const cityId of CITY_IDS) {
    const city = state.cities[cityId];
    const temple = city.temple;
    const stage = TEMPLE_STAGES[temple.stage];
    if (!stage || temple.buildingUntilTick !== null || temple.donations < stage.donationsNeeded) continue;
    let complete = true;
    for (const [good, needed] of Object.entries(stage.materials) as [GoodId, number][]) {
      const have = amountOf(temple.materials, good);
      if (have >= needed) continue;
      if (buyPrice(city, good) > GOODS[good].basePrice * TEMPLE_MATERIAL_PRICE_LIMIT) {
        complete = false;
        continue;
      }
      const take = Math.min(needed - have, Math.floor(city.market[good]));
      city.market[good] -= take;
      temple.materials[good] = have + take;
      if (have + take < needed) complete = false;
    }
    if (!complete) continue;
    temple.donations -= stage.donationsNeeded;
    const job = enqueueConstruction(
      ctx,
      cityId,
      { type: 'templeStage', stage: temple.stage },
      stage.buildDays,
    );
    temple.buildingUntilTick = job.readyTick ?? state.tick;
  }
}

/** Hinweis des Priesters zum Spendenstand (2.1.1.7.4). */
export function priestHint(donations: number, stageIndex: number, building: boolean): string {
  const stage = TEMPLE_STAGES[stageIndex];
  if (!stage) return 'Wir planen keinen weiteren Ausbau.';
  if (building) return 'Wir planen derzeit keinen weiteren Ausbau.';
  const share = donations / stage.donationsNeeded;
  if (share >= 1) return 'Wir haben die benötigte Spende zusammen und beginnen bald mit dem Ausbau.';
  if (share >= 2 / 3) return 'Wir haben schon den größten Teil der benötigten Spenden zusammen.';
  if (share >= 1 / 3) return 'Wir haben schon viele Spenden erhalten.';
  return 'Wir benötigen noch viele Spender.';
}
