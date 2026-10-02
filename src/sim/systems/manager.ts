import { KONTOR_MANAGER } from '../data/balance';
import { CITY_IDS } from '../data/cities';
import type { GoodId } from '../data/goods';
import type { SimContext } from '../context';
import type { StandingOrder } from '../state/gameState';
import { buyFromMarket, sellToMarket } from './market';
import { unitsBuyableBelow, unitsSellableAbove, maxAffordable } from './prices';
import { amountOf } from './storage';

/**
 * Kontorverwalter (Tippsammlung 3.3.2.2): handelt einmal täglich nach Daueraufträgen –
 * kaufen bis zu einem Preis und Bestand, verkaufen ab einem Preis bis auf eine Reserve.
 * Ist der Spieler in der Stadt, handelt er etwas geschickter.
 */

export function runManagersDay(ctx: SimContext): void {
  const { state } = ctx;
  for (const cityId of CITY_IDS) {
    const kontor = state.player.kontors[cityId];
    if (!kontor?.manager) continue;
    const city = state.cities[cityId];
    const present = state.player.location.kind === 'city' && state.player.location.cityId === cityId;
    const bonus = present ? KONTOR_MANAGER.presencePriceBonus : 0;
    for (const [good, order] of Object.entries(kontor.manager.orders) as [GoodId, StandingOrder][]) {
      const stock = amountOf(kontor.storage, good);
      if (order.sellAbove !== null && stock > order.keepMin) {
        const units = unitsSellableAbove(city, good, order.sellAbove, Math.floor(stock - order.keepMin));
        if (units > 0)
          sellToMarket(ctx, cityId, good, units, kontor.storage, { personal: false, priceBonus: bonus });
      }
      const after = amountOf(kontor.storage, good);
      if (order.buyBelow !== null && after < order.buyUpTo && state.player.money > 0) {
        const wanted = unitsBuyableBelow(city, good, order.buyBelow, Math.floor(order.buyUpTo - after));
        const units = maxAffordable(city, good, state.player.money, wanted, 1 - bonus);
        if (units > 0)
          buyFromMarket(ctx, cityId, good, units, kontor.storage, { personal: false, priceBonus: bonus });
      }
    }
  }
}
