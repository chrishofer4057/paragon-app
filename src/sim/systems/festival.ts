import { REPUTATION } from '../data/balance';
import { FESTIVAL_GOODS_PER_1000, FESTIVAL_HAPPINESS_DAYS } from '../data/buildings';
import { CITIES, CITY_IDS, type CityId } from '../data/cities';
import type { GoodId } from '../data/goods';
import { emit, postMessage, type SimContext } from '../context';
import type { GameState } from '../state/gameState';
import { daysToTicks } from '../time';
import { totalPopulation } from './demand';
import { addReputation, combinedReputation, effectiveReputation } from './reputation';
import { amountOf, removeGoods } from './storage';

/**
 * Feste (Tippsammlung 2.1.1.12): drei Wochen vorher angekündigt, am Festtag werden die
 * Waren aus dem Kontor verbraucht. Wie viele kommen, hängt von der Beliebtheit ab
 * (mindestens 40 %, höchstens alle Einwohner).
 */

export function expectedGuests(state: GameState, cityId: CityId): number {
  const pop = totalPopulation(state.cities[cityId]) + state.cities[cityId].population.beggars;
  const popularity = Math.min(1, Math.max(0, combinedReputation(effectiveReputation(state, cityId)) / 50));
  return Math.round(pop * (0.4 + 0.6 * popularity));
}

function holdFestival(ctx: SimContext, cityId: CityId): void {
  const { state } = ctx;
  const city = state.cities[cityId];
  const kontor = state.player.kontors[cityId];
  const guests = expectedGuests(state, cityId);
  let neededTotal = 0;
  let servedTotal = 0;
  for (const [good, per1000] of Object.entries(FESTIVAL_GOODS_PER_1000) as [GoodId, number][]) {
    const needed = (per1000 * guests) / 1000;
    const served = kontor ? Math.min(needed, amountOf(kontor.storage, good)) : 0;
    if (kontor && served > 0) removeGoods(kontor.storage, good, served);
    neededTotal += needed;
    servedTotal += served;
  }
  const success = neededTotal > 0 ? servedTotal / neededTotal : 0;
  city.festival = null;
  if (success > 0.25) city.festivalBoostUntilTick = state.tick + daysToTicks(FESTIVAL_HAPPINESS_DAYS);
  addReputation(state, cityId, {
    social: REPUTATION.festivalMax.social * success,
    societal: REPUTATION.festivalMax.societal * success,
  });
  emit(ctx, { type: 'FestivalHeld', cityId, success });
  const verdict =
    success >= 0.9
      ? 'ein berauschendes Fest'
      : success >= 0.6
        ? 'einigermaßen erfolgreich'
        : success >= 0.3
          ? 'ein recht mäßiger Erfolg'
          : 'kein Freudentag';
  postMessage(
    ctx,
    success >= 0.6 ? 'success' : 'warning',
    'Fest gefeiert',
    `Euer Fest in ${CITIES[cityId].name} war ${verdict} (${guests} Gäste).`,
    cityId,
  );
}

export function runFestivalsHour(ctx: SimContext): void {
  for (const cityId of CITY_IDS) {
    const festival = ctx.state.cities[cityId].festival;
    if (festival && festival.tick <= ctx.state.tick) holdFestival(ctx, cityId);
  }
}
