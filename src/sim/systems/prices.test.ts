import { describe, expect, it } from 'vitest';
import { GOODS } from '../data/goods';
import { setupGame } from '../testing/fixtures';
import { targetStock } from './demand';
import {
  buyPrice,
  maxAffordable,
  priceAtStock,
  quoteBuy,
  quoteSell,
  sellPrice,
  unitsSellableAbove,
} from './prices';

describe('Preisbildung', () => {
  it('entspricht beim Zielbestand dem Basispreis', () => {
    expect(priceAtStock('Wood', 100, 100)).toBeCloseTo(GOODS.Wood.basePrice);
  });

  it('steigt bei Knappheit und fällt bei Überangebot – innerhalb der Grenzen', () => {
    const target = 100;
    const scarce = priceAtStock('Grain', 20, target);
    const normal = priceAtStock('Grain', 100, target);
    const glut = priceAtStock('Grain', 500, target);
    expect(scarce).toBeGreaterThan(normal);
    expect(glut).toBeLessThan(normal);
    expect(priceAtStock('Grain', 0, target)).toBeCloseTo(GOODS.Grain.basePrice * GOODS.Grain.maxFactor);
    expect(priceAtStock('Grain', 1e9, target)).toBeCloseTo(GOODS.Grain.basePrice * GOODS.Grain.minFactor);
  });

  it('Kaufpreis liegt über dem Verkaufspreis (Spanne)', () => {
    const state = setupGame();
    const city = state.cities.NewArk;
    expect(buyPrice(city, 'Wood')).toBeGreaterThan(sellPrice(city, 'Wood'));
  });

  it('bewertet Mengen Einheit für Einheit (große Verkäufe drücken den Durchschnittspreis)', () => {
    const state = setupGame();
    const city = state.cities.NewArk;
    const one = quoteSell(city, 'Wood', 1);
    const hundred = quoteSell(city, 'Wood', 100);
    expect(hundred).toBeLessThan(one * 100);
    expect(quoteBuy(city, 'Wood', 50)).toBeGreaterThan(quoteBuy(city, 'Wood', 1) * 50 - 1e-6);
  });

  it('findet die größte bezahlbare Menge', () => {
    const state = setupGame();
    const city = state.cities.NewArk;
    const units = maxAffordable(city, 'Wood', 1000, 1000);
    expect(quoteBuy(city, 'Wood', units)).toBeLessThanOrEqual(1000);
    expect(quoteBuy(city, 'Wood', units + 1)).toBeGreaterThan(1000);
  });

  it('verkauft für Daueraufträge nur bis zum Mindestpreis', () => {
    const state = setupGame();
    const city = state.cities.NewArk;
    const floor = sellPrice(city, 'Wood') * 0.8;
    const units = unitsSellableAbove(city, 'Wood', floor, 10_000);
    expect(units).toBeGreaterThan(0);
    city.market.Wood += units + 1;
    expect(sellPrice(city, 'Wood')).toBeLessThan(floor);
    expect(targetStock(city, 'Wood')).toBeGreaterThan(0);
  });
});
