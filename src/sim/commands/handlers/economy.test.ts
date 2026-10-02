import { describe, expect, it } from 'vitest';
import { LENDER, MARKET } from '../../data/balance';
import { KONTOR } from '../../data/buildings';
import { applyCommand, tick } from '../../engine';
import type { LoanId } from '../../state/ids';
import { run, runDays, setupGame } from '../../testing/fixtures';
import { amountOf } from '../../systems/storage';
import { buyPrice, sellPrice } from '../../systems/prices';
import { dailyPlayerCosts } from '../../systems/finance';

describe('Handel nach Rang', () => {
  it('Tagelöhner kaufen nur kleine Mengen für sich selbst', () => {
    const state = setupGame({ money: 10_000 });
    expect(
      applyCommand(state, {
        type: 'BuyGoods',
        good: 'Grain',
        amount: MARKET.dayLaborerDailyBuyLimit + 1,
        into: { kind: 'inventory' },
      }).result.ok,
    ).toBe(false);
    run(state, { type: 'BuyGoods', good: 'Grain', amount: 2, into: { kind: 'inventory' } });
    state.player.rank = 'huckster';
    run(state, { type: 'BuyGoods', good: 'Grain', amount: 15, into: { kind: 'inventory' } });
  });

  it('der Rucksack ist begrenzt', () => {
    const state = setupGame({ money: 100_000, rank: 'huckster' });
    expect(
      applyCommand(state, { type: 'BuyGoods', good: 'Wood', amount: 50, into: { kind: 'inventory' } }).result
        .ok,
    ).toBe(false);
  });

  it('Ursina handelt persönlich zu besseren Preisen', () => {
    const gian = setupGame({ characterId: 'gian' });
    const ursina = setupGame({ characterId: 'ursina' });
    gian.player.inventory.Wood = 5;
    ursina.player.inventory.Wood = 5;
    const g0 = gian.player.money;
    const u0 = ursina.player.money;
    run(gian, { type: 'SellGoods', good: 'Wood', amount: 5, from: { kind: 'inventory' } });
    run(ursina, { type: 'SellGoods', good: 'Wood', amount: 5, from: { kind: 'inventory' } });
    expect(ursina.player.money - u0).toBeGreaterThan(gian.player.money - g0);
  });
});

describe('Marktstand', () => {
  it('bringt bessere Preise als der Großhandel, aber begrenzte Kundschaft', () => {
    const state = setupGame({ rank: 'huckster', money: 100 });
    state.player.inventory.Wood = 3;
    run(state, { type: 'RentStall' });
    const before = state.player.money;
    const marketValue = sellPrice(state.cities.NewArk, 'Wood');
    run(state, { type: 'SellAtStall', good: 'Wood', amount: 1, from: { kind: 'inventory' } });
    expect(state.player.money - before).toBeGreaterThan(marketValue);
    expect(
      applyCommand(state, { type: 'SellAtStall', good: 'Wood', amount: 1, from: { kind: 'inventory' } })
        .result.ok,
    ).toBe(false); // beschäftigt
    expect(
      applyCommand(state, { type: 'SellAtStall', good: 'Wood', amount: 2000, from: { kind: 'inventory' } })
        .result.ok,
    ).toBe(false);
  });
});

describe('Taverne', () => {
  it('Tagelöhnerarbeit bringt Lohn und kostet einen Arbeitstag', () => {
    const state = setupGame();
    let job = state.cities.NewArk.tavern.dayJobs[0];
    for (let i = 0; i < 20 && !job; i++) {
      tick(state, 24);
      job = state.cities.NewArk.tavern.dayJobs[0];
    }
    expect(job).toBeDefined();
    const money = state.player.money;
    run(state, { type: 'WorkDayJob', jobId: job!.id });
    expect(state.player.money).toBe(money + job!.wage);
    expect(state.player.busyUntilTick).toBeGreaterThan(state.tick + 7);
  });
});

describe('Kontor', () => {
  it('ab Händler gründbar; Bau dauert, danach Lager mit Kapazität', () => {
    const state = setupGame({ rank: 'trader', money: 20_000 });
    state.player.inventory = { Stone: 20 };
    run(state, { type: 'FoundKontor' });
    expect(applyCommand(state, { type: 'FoundKontor' }).result.ok).toBe(false);
    runDays(state, KONTOR.buildDays + 1);
    expect(state.player.kontors.NewArk).toBeDefined();
  });

  it('Lagerüberlauf kostet Miete', () => {
    const state = setupGame({ kontorIn: ['NewArk'], kontorGoods: { Wood: KONTOR.capacity + 100 } });
    expect(dailyPlayerCosts(state)).toBe(100);
  });

  it('Verwalter handelt täglich nach Daueraufträgen', () => {
    const state = setupGame({
      rank: 'distanceMerchant',
      money: 50_000,
      kontorIn: ['NewArk'],
      kontorGoods: { Silk: 50 },
    });
    run(state, { type: 'HireManager' });
    const city = state.cities.NewArk;
    run(state, {
      type: 'SetStandingOrder',
      cityId: 'NewArk',
      good: 'Silk',
      order: { buyBelow: null, buyUpTo: 0, sellAbove: sellPrice(city, 'Silk') * 0.7, keepMin: 10 },
    });
    run(state, {
      type: 'SetStandingOrder',
      cityId: 'NewArk',
      good: 'Grain',
      order: { buyBelow: buyPrice(city, 'Grain') * 1.5, buyUpTo: 20, sellAbove: null, keepMin: 0 },
    });
    runDays(state, 1);
    const storage = state.player.kontors.NewArk!.storage;
    expect(amountOf(storage, 'Silk')).toBeLessThan(50);
    expect(amountOf(storage, 'Silk')).toBeGreaterThanOrEqual(10);
    expect(amountOf(storage, 'Grain')).toBeGreaterThan(0);
  });

  it('ungültige Daueraufträge werden abgelehnt', () => {
    const state = setupGame({ rank: 'distanceMerchant', money: 50_000, kontorIn: ['NewArk'] });
    run(state, { type: 'HireManager' });
    const outcome = applyCommand(state, {
      type: 'SetStandingOrder',
      cityId: 'NewArk',
      good: 'Wood',
      order: { buyBelow: 200, buyUpTo: 10, sellAbove: 100, keepMin: 0 },
    });
    expect(outcome.result.ok).toBe(false);
  });
});

describe('Geldverleiher', () => {
  it('Darlehen mit Wochenzins, Rückzahlung am Stück', () => {
    const state = setupGame({ money: 100 });
    state.player.netWorth = 10_000;
    run(state, { type: 'TakeLoan', termIndex: 0, amount: 2000 });
    expect(state.player.money).toBe(2100);
    const loan = Object.values(state.loans)[0]!;
    runDays(state, 7);
    expect(loan.owed).toBeGreaterThan(2000);
    state.player.money = 10_000;
    run(state, { type: 'RepayLoan', loanId: loan.id as LoanId });
    expect(Object.keys(state.loans)).toHaveLength(0);
  });

  it('höchstens drei Darlehen und nur im Kreditrahmen', () => {
    const state = setupGame();
    state.player.netWorth = 100_000;
    expect(
      applyCommand(state, { type: 'TakeLoan', termIndex: 2, amount: LENDER.maxCredit + 1 }).result.ok,
    ).toBe(false);
    for (let i = 0; i < 3; i++) run(state, { type: 'TakeLoan', termIndex: 1, amount: 1000 });
    expect(applyCommand(state, { type: 'TakeLoan', termIndex: 1, amount: 1000 }).result.ok).toBe(false);
  });

  it('unbezahlte Darlehen werden gepfändet und kosten Ansehen', () => {
    const state = setupGame({ money: 0, kontorIn: ['NewArk'], kontorGoods: { Tools: 100 } });
    state.player.netWorth = 10_000;
    run(state, { type: 'TakeLoan', termIndex: 0, amount: 2000 });
    state.player.money = 0;
    runDays(state, 4 * 7 + LENDER.graceDays + 2);
    expect(Object.keys(state.loans)).toHaveLength(0);
    expect(amountOf(state.player.kontors.NewArk!.storage, 'Tools')).toBeLessThan(100);
    expect(state.player.reputation.NewArk.societal).toBeLessThan(0);
  });

  it('eigene Darlehen vergeben bringt Zinsen (oder einen Ausfall)', () => {
    const state = setupGame({ money: 100_000 });
    const offer = state.cities.NewArk.borrowerOffers[0]!;
    run(state, { type: 'GrantLoan', offerId: offer.id });
    expect(Object.keys(state.lentLoans)).toHaveLength(1);
    runDays(state, offer.weeks * 7 + 12);
    expect(Object.keys(state.lentLoans)).toHaveLength(0);
  });
});
