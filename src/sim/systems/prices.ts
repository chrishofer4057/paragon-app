import { MARKET } from '../data/balance';
import { GOODS, type GoodId } from '../data/goods';
import type { CityState } from '../state/gameState';
import { targetStock } from './demand';

/**
 * Preisbildung (CLAUDE.md §5.4):
 *   preis = basispreis * clamp((zielbestand / max(bestand, 1)) ^ elastizität, minFaktor, maxFaktor)
 *
 * Mengengeschäfte werden Einheit für Einheit bewertet: Wer 50 Holz verkauft, drückt mit
 * jeder Einheit den Preis für die nächste.
 */

export function priceAtStock(good: GoodId, stock: number, target: number): number {
  const def = GOODS[good];
  const ratio = target / Math.max(stock, 1);
  const factor = Math.min(def.maxFactor, Math.max(def.minFactor, Math.pow(ratio, def.elasticity)));
  return def.basePrice * factor;
}

/** Aktueller Mittelpreis einer Ware in der Stadt. */
export function midPrice(city: CityState, good: GoodId): number {
  return priceAtStock(good, city.market[good], targetStock(city, good));
}

/** Preis, den der Spieler beim Kauf der nächsten Einheit zahlt. */
export function buyPrice(city: CityState, good: GoodId): number {
  return midPrice(city, good) * (1 + MARKET.spread / 2);
}

/** Preis, den der Spieler beim Verkauf der nächsten Einheit erhält. */
export function sellPrice(city: CityState, good: GoodId): number {
  return midPrice(city, good) * (1 - MARKET.spread / 2);
}

/** Größe der Bewertungsschritte; große Mengen werden in höchstens 200 Schritten gerechnet. */
function stepSize(amount: number): number {
  return Math.max(1, amount / 200);
}

/**
 * Gesamtpreis für den Kauf von `amount` Einheiten (Stadt verkauft, Bestand sinkt).
 * `priceFactor` < 1 bedeutet einen Rabatt (z. B. Figurenbonus).
 */
export function quoteBuy(city: CityState, good: GoodId, amount: number, priceFactor = 1): number {
  if (amount <= 0) return 0;
  const target = targetStock(city, good);
  const step = stepSize(amount);
  let stock = city.market[good];
  let remaining = amount;
  let total = 0;
  while (remaining > 1e-9) {
    const chunk = Math.min(step, remaining);
    total += priceAtStock(good, stock - chunk / 2, target) * chunk;
    stock -= chunk;
    remaining -= chunk;
  }
  return total * (1 + MARKET.spread / 2) * priceFactor;
}

/** Gesamterlös für den Verkauf von `amount` Einheiten (Bestand steigt). */
export function quoteSell(city: CityState, good: GoodId, amount: number, priceFactor = 1): number {
  if (amount <= 0) return 0;
  const target = targetStock(city, good);
  const step = stepSize(amount);
  let stock = city.market[good];
  let remaining = amount;
  let total = 0;
  while (remaining > 1e-9) {
    const chunk = Math.min(step, remaining);
    total += priceAtStock(good, stock + chunk / 2, target) * chunk;
    stock += chunk;
    remaining -= chunk;
  }
  return total * (1 - MARKET.spread / 2) * priceFactor;
}

/** Größte ganze Menge, die sich für `money` kaufen lässt (höchstens `limit`). */
export function maxAffordable(
  city: CityState,
  good: GoodId,
  money: number,
  limit: number,
  priceFactor = 1,
): number {
  let lo = 0;
  let hi = Math.floor(Math.min(limit, city.market[good]));
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (quoteBuy(city, good, mid, priceFactor) <= money) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

/**
 * Wie viele Einheiten kann man verkaufen, bevor der Grenzpreis unter `minPrice` fällt?
 * Für Verwalter-Daueraufträge ("verkaufe, solange mindestens x GS").
 */
export function unitsSellableAbove(city: CityState, good: GoodId, minPrice: number, limit: number): number {
  const target = targetStock(city, good);
  let units = 0;
  let stock = city.market[good];
  while (units < limit) {
    const marginal = priceAtStock(good, stock + 0.5, target) * (1 - MARKET.spread / 2);
    if (marginal < minPrice) break;
    units += 1;
    stock += 1;
  }
  return units;
}

/** Wie viele Einheiten kann man kaufen, bevor der Grenzpreis über `maxPrice` steigt? */
export function unitsBuyableBelow(city: CityState, good: GoodId, maxPrice: number, limit: number): number {
  const target = targetStock(city, good);
  let units = 0;
  let stock = city.market[good];
  while (units < limit && stock >= 1) {
    const marginal = priceAtStock(good, stock - 0.5, target) * (1 + MARKET.spread / 2);
    if (marginal > maxPrice) break;
    units += 1;
    stock -= 1;
  }
  return units;
}
