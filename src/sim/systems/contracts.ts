import { CONTRACTS, REPUTATION } from '../data/balance';
import { CITIES, CITY_IDS } from '../data/cities';
import { GOODS, type GoodId } from '../data/goods';
import { emit, newId, postMessage, type SimContext } from '../context';
import { chance, nextRange, pick } from '../rng';
import type { CityContract } from '../state/gameState';
import type { ContractId } from '../state/ids';
import { daysToTicks } from '../time';
import { shortages, totalDemandWeekly } from './demand';
import { addReputation } from './reputation';

/**
 * Aushang im Stadthaus (Tippsammlung 2.1.1.3.1): Bei Warenmangel schreibt die Stadt
 * Lieferaufträge mit garantiertem Preis aus.
 * - Preisgarantie: Bezahlung sofort nach der letzten Lieferung.
 * - Lieferausschreibung: Bezahlung erst bei Fristende, für alles bis dahin Gelieferte.
 * Wer Aufträge verschläft, bekommt eine Weile keine neuen.
 */

export function runContractsDay(ctx: SimContext): void {
  const { state } = ctx;
  for (const cityId of CITY_IDS) {
    const city = state.cities[cityId];
    // Abgelaufene Aufträge abrechnen
    for (const contract of city.contracts.filter((c) => c.expiresTick <= state.tick)) {
      if (contract.acceptedByPlayer) settleExpired(ctx, cityId, contract);
    }
    city.contracts = city.contracts.filter((c) => c.expiresTick > state.tick);

    if (city.contracts.length >= CONTRACTS.maxPerCity || !chance(state.rng, CONTRACTS.dailyOfferChance))
      continue;
    const short = shortages(city).filter((g) => !city.contracts.some((c) => c.good === g));
    if (short.length === 0) continue;
    const good: GoodId = pick(state.rng, short);
    const weekly = totalDemandWeekly(city, good);
    const amount = Math.max(
      1,
      Math.round(weekly * nextRange(state.rng, CONTRACTS.amountWeeksMin, CONTRACTS.amountWeeksMax)),
    );
    const contract: CityContract = {
      id: newId<ContractId>(state, 'c'),
      good,
      amount,
      delivered: 0,
      pricePerUnit: Math.round(
        GOODS[good].basePrice * nextRange(state.rng, CONTRACTS.priceFactorMin, CONTRACTS.priceFactorMax),
      ),
      kind: chance(state.rng, 0.5) ? 'priceGuarantee' : 'tender',
      expiresTick:
        state.tick + daysToTicks(Math.round(nextRange(state.rng, CONTRACTS.minDays, CONTRACTS.maxDays))),
      acceptedByPlayer: false,
    };
    city.contracts.push(contract);
    emit(ctx, { type: 'ContractOffered', cityId, contractId: contract.id, good });
  }
}

function settleExpired(ctx: SimContext, cityId: (typeof CITY_IDS)[number], contract: CityContract): void {
  const { state } = ctx;
  const city = state.cities[cityId];
  const name = CITIES[cityId].name;
  if (contract.kind === 'tender' && contract.delivered > 0) {
    const payment = contract.delivered * contract.pricePerUnit;
    state.player.money += payment;
    addReputation(state, cityId, {
      societal: payment * REPUTATION.tradePerValue * REPUTATION.contractFactor,
    });
    postMessage(
      ctx,
      'success',
      'Prämie ausgezahlt',
      `${name} zahlt ${Math.round(payment)} GS für Eure Lieferung ${GOODS[contract.good].name}.`,
      cityId,
    );
  }
  if (contract.delivered < contract.amount) {
    city.contractLockoutUntilTick = state.tick + daysToTicks(CONTRACTS.failureLockoutDays);
    addReputation(state, cityId, { societal: -CONTRACTS.failureSocietalPenalty });
    postMessage(
      ctx,
      'warning',
      'Auftrag verfehlt',
      `Die Lieferung ${GOODS[contract.good].name} nach ${name} ist unvollständig geblieben.`,
      cityId,
    );
  }
}

/** Nach vollständiger Lieferung einer Preisgarantie sofort bezahlen. */
export function completeContractIfDone(
  ctx: SimContext,
  cityId: (typeof CITY_IDS)[number],
  contract: CityContract,
): void {
  const { state } = ctx;
  if (contract.delivered + 1e-6 < contract.amount) return;
  const city = state.cities[cityId];
  if (contract.kind === 'priceGuarantee') {
    const payment = contract.amount * contract.pricePerUnit;
    state.player.money += payment;
    addReputation(state, cityId, {
      societal: payment * REPUTATION.tradePerValue * REPUTATION.contractFactor,
      social: payment * REPUTATION.tradePerValue,
    });
    city.contracts = city.contracts.filter((c) => c.id !== contract.id);
    postMessage(ctx, 'success', 'Auftrag erfüllt', `Ihr erhaltet ${Math.round(payment)} GS.`, cityId);
  } else {
    // Ausschreibung: Bezahlung bei Fristende; Ansehen für die Pünktlichkeit gibt es schon jetzt.
    addReputation(state, cityId, {
      social: contract.amount * contract.pricePerUnit * REPUTATION.tradePerValue,
    });
  }
}
