import { ACCUSATIONS, BURGLARY, REPUTATION } from '../data/balance';
import { accusationFactor } from './factions';
import { CITIES, CITY_IDS } from '../data/cities';
import { GOODS, type GoodId } from '../data/goods';
import { postMessage, type SimContext } from '../context';
import { chance, nextRange, pick } from '../rng';
import { daysToTicks } from '../time';
import { addReputation } from './reputation';
import { removeGoods } from './storage';

/**
 * Wöchentliche Risiken:
 * - Willkürliche Anklagen, wer nicht mindestens alle drei Wochen betet und badet
 *   (Tippsammlung 2.1.1.6.1 / 2.1.1.7.1).
 * - Einbrüche in Kontore mit Lagerhäusern; Wachen und Anwesenheit senken das Risiko (2.2.1.4).
 */

export function runAccusationsWeek(ctx: SimContext): void {
  const { state } = ctx;
  const p = state.player;
  const grace = daysToTicks(ACCUSATIONS.graceDays);
  const checks: { last: number; charge: string }[] = [
    { last: p.lastPrayerTick, charge: 'Unzucht – Ihr wurdet lange nicht im Tempel gesehen' },
    { last: p.lastBathTick, charge: 'der Behauptung, die Welt sei eine Scheibe – Ihr meidet das Badehaus' },
  ];
  for (const check of checks) {
    if (
      state.tick - check.last <= grace ||
      !chance(state.rng, ACCUSATIONS.weeklyChance * accusationFactor(state))
    )
      continue;
    const fine = Math.round(Math.max(ACCUSATIONS.minFine, p.netWorth * ACCUSATIONS.fineShareOfNetWorth));
    p.money -= fine;
    addReputation(state, p.homeCityId, {
      social: -REPUTATION.accusationPenalty,
      societal: -REPUTATION.accusationPenalty,
    });
    postMessage(
      ctx,
      'danger',
      'Anklage',
      `Ihr wurdet wegen ${check.charge} angeklagt und zu ${fine} GS Buße verurteilt.`,
    );
  }
}

export function runBurglaryWeek(ctx: SimContext): void {
  const { state } = ctx;
  for (const cityId of CITY_IDS) {
    const kontor = state.player.kontors[cityId];
    if (!kontor || kontor.warehouses === 0) continue;
    const present = state.player.location.kind === 'city' && state.player.location.cityId === cityId;
    const risk =
      BURGLARY.weeklyChancePerWarehouse *
      kontor.warehouses *
      Math.max(0, 1 - kontor.guards * BURGLARY.guardReduction) *
      (present ? BURGLARY.presenceFactor : 1);
    if (!chance(state.rng, risk)) continue;
    const goods = (Object.keys(kontor.storage) as GoodId[]).filter((g) => (kontor.storage[g] ?? 0) >= 1);
    if (goods.length === 0) continue;
    const good = pick(state.rng, goods);
    const stolen =
      (kontor.storage[good] ?? 0) * nextRange(state.rng, BURGLARY.stolenShareMin, BURGLARY.stolenShareMax);
    removeGoods(kontor.storage, good, stolen);
    // Diebesgut taucht auf dem örtlichen Markt wieder auf.
    state.cities[cityId].market[good] += stolen;
    postMessage(
      ctx,
      'danger',
      'Einbruch',
      `Diebe haben aus Eurem Kontor in ${CITIES[cityId].name} ${Math.round(stolen)} ${GOODS[good].name} gestohlen.`,
      cityId,
    );
  }
}
