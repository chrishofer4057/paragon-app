import { NPC_TRADE } from '../data/balance';
import { CITY_IDS, type CityId } from '../data/cities';
import { GOOD_IDS } from '../data/goods';
import { newId, type SimContext } from '../context';
import { nextInt } from '../rng';
import type { ShipmentId } from '../state/ids';
import { daysToTicks } from '../time';
import { targetStock } from './demand';

/**
 * Hintergrundhandel der KI-Händler: Überschüsse wandern mit Verzögerung in Mangelstädte.
 * Bewusst träge und verlustbehaftet, damit der Spieler schneller und lohnender handeln kann,
 * die Welt ohne ihn aber nicht zusammenbricht ("Alle Städte werden immer simuliert").
 */

export function runNpcTradeDay(ctx: SimContext): void {
  const { state } = ctx;
  for (const good of GOOD_IDS) {
    const surplus: { cityId: CityId; amount: number }[] = [];
    const deficit: { cityId: CityId; amount: number }[] = [];
    for (const cityId of CITY_IDS) {
      const city = state.cities[cityId];
      const target = targetStock(city, good);
      const stock = city.market[good];
      if (stock > target * NPC_TRADE.surplusThreshold) {
        surplus.push({
          cityId,
          amount: (stock - target * NPC_TRADE.surplusThreshold) * NPC_TRADE.surplusRate,
        });
      } else if (stock < target * NPC_TRADE.deficitThreshold) {
        deficit.push({
          cityId,
          amount: (target * NPC_TRADE.deficitThreshold - stock) * NPC_TRADE.deficitRate,
        });
      }
    }
    const offered = surplus.reduce((s, e) => s + e.amount, 0);
    const wanted = deficit.reduce((s, e) => s + e.amount, 0);
    const moved = Math.min(offered, wanted);
    if (moved <= 0.01) continue;
    for (const s of surplus) {
      const city = state.cities[s.cityId];
      city.market[good] = Math.max(0, city.market[good] - (s.amount / offered) * moved);
    }
    for (const d of deficit) {
      state.npcShipments.push({
        id: newId<ShipmentId>(state, 'x'),
        good,
        amount: (d.amount / wanted) * moved * NPC_TRADE.efficiency,
        to: d.cityId,
        arriveTick:
          state.tick + daysToTicks(nextInt(state.rng, NPC_TRADE.minTransitDays, NPC_TRADE.maxTransitDays)),
      });
    }
  }
}

export function deliverNpcShipments(ctx: SimContext): void {
  const { state } = ctx;
  if (state.npcShipments.length === 0) return;
  const remaining = [];
  for (const shipment of state.npcShipments) {
    if (shipment.arriveTick <= state.tick) state.cities[shipment.to].market[shipment.good] += shipment.amount;
    else remaining.push(shipment);
  }
  state.npcShipments = remaining;
}
