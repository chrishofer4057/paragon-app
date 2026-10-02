import { LENDER, REPUTATION } from '../../data/balance';
import { newId, type SimContext } from '../../context';
import type { LoanId, OfferId } from '../../state/ids';
import { daysToTicks } from '../../time';
import { creditLimit, resolveDefault } from '../../systems/lender';
import { addReputation } from '../../systems/reputation';
import { fail, ok, type CommandResult } from '../commands';
import { requireCity, requireMoney, requirePositiveAmount } from '../guards';

export function handleTakeLoan(ctx: SimContext, termIndex: number, amount: number): CommandResult {
  const { state } = ctx;
  const where = requireCity(state);
  if ('error' in where) return where.error;
  const term = LENDER.terms[termIndex];
  if (!term) return fail('Diese Laufzeit bietet der Geldverleiher nicht an.');
  const error = requirePositiveAmount(amount);
  if (error) return error;
  if (Object.keys(state.loans).length >= LENDER.maxLoans)
    return fail(`Mehr als ${LENDER.maxLoans} Darlehen gibt Euch niemand.`);
  const limit = creditLimit(state);
  if (amount > limit) return fail(`Der Geldverleiher leiht Euch höchstens ${limit} GS.`);
  const id = newId<LoanId>(state, 'l');
  state.loans[id] = {
    id,
    cityId: where.cityId,
    principal: amount,
    owed: amount,
    weeklyRate: term.weeklyRate,
    takenTick: state.tick,
    dueTick: state.tick + daysToTicks(term.weeks * 7),
    reminded: false,
  };
  state.player.money += amount;
  return ok(`Ihr erhaltet ${amount} GS zu ${(term.weeklyRate * 100).toFixed(1)} % Zins pro Woche.`);
}

/** Rückzahlung nur am Stück, bei jedem Geldverleiher möglich (2.1.1.5.2). */
export function handleRepayLoan(ctx: SimContext, loanId: LoanId): CommandResult {
  const { state } = ctx;
  const where = requireCity(state);
  if ('error' in where) return where.error;
  const loan = state.loans[loanId];
  if (!loan) return fail('Dieses Darlehen gibt es nicht.');
  const error = requireMoney(state, loan.owed);
  if (error) return error;
  state.player.money -= loan.owed;
  delete state.loans[loanId];
  return ok('Darlehen getilgt.');
}

export function handleGrantLoan(ctx: SimContext, offerId: OfferId): CommandResult {
  const { state } = ctx;
  const where = requireCity(state);
  if ('error' in where) return where.error;
  const city = state.cities[where.cityId];
  const offer = city.borrowerOffers.find((o) => o.id === offerId);
  if (!offer) return fail('Dieser Kreditwunsch ist nicht mehr aktuell.');
  const error = requireMoney(state, offer.amount);
  if (error) return error;
  const id = newId<LoanId>(state, 'l');
  state.lentLoans[id] = {
    id,
    cityId: where.cityId,
    borrowerName: offer.borrowerName,
    principal: offer.amount,
    weeklyRate: offer.weeklyRate,
    weeks: offer.weeks,
    dueTick: state.tick + daysToTicks(offer.weeks * 7),
    defaultedUntilTick: null,
  };
  state.player.money -= offer.amount;
  city.borrowerOffers = city.borrowerOffers.filter((o) => o.id !== offerId);
  addReputation(state, where.cityId, { societal: REPUTATION.loanGivenSocietal });
  return ok(`${offer.borrowerName} erhält ${offer.amount} GS.`);
}

export function handleResolveDefault(
  ctx: SimContext,
  loanId: LoanId,
  choice: 'seize' | 'forgive',
): CommandResult {
  const lent = ctx.state.lentLoans[loanId];
  if (lent?.defaultedUntilTick == null) return fail('Dieser Schuldner ist nicht in Verzug.');
  resolveDefault(ctx, loanId, choice);
  return ok();
}
