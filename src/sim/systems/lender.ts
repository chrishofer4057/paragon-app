import { LENDER, REPUTATION } from '../data/balance';
import { CITIES, CITY_IDS } from '../data/cities';
import { GOOD_IDS, type GoodId } from '../data/goods';
import { newId, postMessage, type SimContext } from '../context';
import { chance, nextInt, nextRange, pick } from '../rng';
import type { GameState } from '../state/gameState';
import type { OfferId } from '../state/ids';
import { daysToTicks } from '../time';
import { randomName } from '../world/createWorld';
import { sellPrice } from './prices';
import { addReputation } from './reputation';
import { addGoods, removeGoods } from './storage';

/**
 * Geldverleiher (Darlehensgeber, Tippsammlung 2.1.1.5):
 * - bis zu drei Darlehen, Zinsen gelten pro Woche, Rückzahlung nur am Stück;
 * - zehn Tage vor Fälligkeit eine Mahnung, nach weiteren zehn Tagen Pfändung
 *   (erst Bargeld, dann Kontorwaren) – das kostet Ansehen;
 * - Spieler können selbst Geld verleihen; fällt ein Schuldner aus, wird gepfändet
 *   (Waren) oder erlassen (Ansehen bei den Armen).
 */

export function creditLimit(state: GameState): number {
  const used = Object.values(state.loans).reduce((sum, l) => sum + l.principal, 0);
  const limit = Math.min(
    LENDER.maxCredit,
    Math.max(LENDER.minCredit, state.player.netWorth * LENDER.creditShareOfNetWorth),
  );
  return Math.max(0, Math.floor(limit - used));
}

export function runLoansWeek(state: GameState): void {
  for (const loan of Object.values(state.loans)) loan.owed *= 1 + loan.weeklyRate;
}

function seize(ctx: SimContext, loanId: string): void {
  const { state } = ctx;
  const loan = state.loans[loanId];
  if (!loan) return;
  let remaining = loan.owed;
  const fromCash = Math.min(remaining, Math.max(0, state.player.money));
  state.player.money -= fromCash;
  remaining -= fromCash;
  // Waren aus den Kontoren pfänden, Stadt für Stadt, alphabetisch nach Ware (2.1.1.5.2).
  for (const cityId of CITY_IDS) {
    const kontor = state.player.kontors[cityId];
    if (!kontor || remaining <= 0) continue;
    for (const good of GOOD_IDS) {
      const amount = kontor.storage[good] ?? 0;
      if (amount <= 0 || remaining <= 0) continue;
      const price = sellPrice(state.cities[cityId], good) * LENDER.seizurePriceFactor;
      const units = Math.min(amount, remaining / Math.max(price, 1));
      removeGoods(kontor.storage, good, units);
      state.cities[cityId].market[good] += units;
      remaining -= units * price;
    }
  }
  if (remaining > 0) state.player.money -= remaining;
  delete state.loans[loanId];
  addReputation(state, state.player.homeCityId, { societal: -REPUTATION.loanDefaultSocietalPenalty });
  addReputation(state, loan.cityId, { societal: -REPUTATION.loanDefaultSocietalPenalty });
  postMessage(
    ctx,
    'danger',
    'Pfändung',
    `Der Geldverleiher aus ${CITIES[loan.cityId].name} hat gepfändet.`,
    loan.cityId,
  );
}

export function runLoansDay(ctx: SimContext): void {
  const { state } = ctx;
  for (const loan of Object.values(state.loans)) {
    if (!loan.reminded && state.tick >= loan.dueTick - daysToTicks(LENDER.reminderDays)) {
      loan.reminded = true;
      postMessage(
        ctx,
        'warning',
        'Darlehen bald fällig',
        `Euer Darlehen in ${CITIES[loan.cityId].name} über ${Math.round(loan.owed)} GS ist in ${LENDER.reminderDays} Tagen fällig.`,
        loan.cityId,
      );
    }
    if (state.tick >= loan.dueTick + daysToTicks(LENDER.graceDays)) seize(ctx, loan.id);
  }
  for (const lent of Object.values(state.lentLoans)) {
    if (lent.defaultedUntilTick !== null) {
      if (state.tick >= lent.defaultedUntilTick) resolveDefault(ctx, lent.id, 'forgive');
      continue;
    }
    if (state.tick < lent.dueTick) continue;
    if (chance(state.rng, LENDER.borrowerDefaultChance)) {
      lent.defaultedUntilTick = state.tick + daysToTicks(10);
      postMessage(
        ctx,
        'warning',
        'Schuldner zahlt nicht',
        `${lent.borrowerName} kann nicht zurückzahlen. Ihr habt zehn Tage, um zu pfänden oder zu erlassen.`,
        lent.cityId,
      );
    } else {
      const repayment = lent.principal * Math.pow(1 + lent.weeklyRate, lent.weeks);
      state.player.money += repayment;
      delete state.lentLoans[lent.id];
      postMessage(
        ctx,
        'success',
        'Darlehen zurückgezahlt',
        `${lent.borrowerName} zahlt ${Math.round(repayment)} GS zurück.`,
        lent.cityId,
      );
    }
  }
}

/** Pfänden bringt Waren (Kategorien wie im Original), Erlassen bringt soziales Ansehen. */
export function resolveDefault(ctx: SimContext, loanId: string, choice: 'seize' | 'forgive'): void {
  const { state } = ctx;
  const lent = state.lentLoans[loanId];
  if (!lent) return;
  delete state.lentLoans[loanId];
  if (choice === 'forgive') {
    addReputation(state, lent.cityId, { social: REPUTATION.loanGivenSocietal * 3 });
    postMessage(ctx, 'info', 'Schuld erlassen', `Ihr erlasst ${lent.borrowerName} die Schuld.`, lent.cityId);
    return;
  }
  const category: GoodId[] = pick(state.rng, [
    ['Grain', 'Wood', 'Fish'],
    ['Faerybloom', 'Meat', 'Wool'],
    ['Silk', 'Clothes', 'Wine'],
  ] as GoodId[][]);
  const kontor = state.player.kontors[lent.cityId];
  const city = state.cities[lent.cityId];
  const goods = [pick(state.rng, category)];
  const second = pick(
    state.rng,
    category.filter((g) => g !== goods[0]),
  );
  goods.push(second);
  for (const good of goods) {
    const units = Math.floor(lent.principal / 2 / Math.max(1, sellPrice(city, good)));
    if (kontor) addGoods(kontor.storage, good, units);
    else city.market[good] += units;
  }
  postMessage(ctx, 'info', 'Gepfändet', `Ihr pfändet Waren bei ${lent.borrowerName}.`, lent.cityId);
}

export function runBorrowerOffersWeek(ctx: SimContext): void {
  const { state } = ctx;
  for (const cityId of CITY_IDS) {
    const city = state.cities[cityId];
    city.borrowerOffers = [];
    for (let i = 0; i < LENDER.borrowerOffersPerWeek; i++) {
      const term = pick(state.rng, LENDER.terms);
      city.borrowerOffers.push({
        id: newId<OfferId>(state, 'o'),
        borrowerName: randomName(state.rng),
        amount: nextInt(state.rng, 5, 60) * 100,
        weeks: term.weeks,
        weeklyRate: Math.round(term.weeklyRate * nextRange(state.rng, 1.1, 1.6) * 1000) / 1000,
      });
    }
  }
}
