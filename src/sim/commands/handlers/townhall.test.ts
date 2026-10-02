import { describe, expect, it } from 'vitest';
import { createContext } from '../../context';
import { applyCommand } from '../../engine';
import type { CityContract } from '../../state/gameState';
import type { ContractId } from '../../state/ids';
import { run, runDays, setupGame } from '../../testing/fixtures';
import { daysToTicks, toDate } from '../../time';
import { electionForecast, runPoliticsDay } from '../../systems/politics';

function addContract(state: ReturnType<typeof setupGame>, kind: CityContract['kind']): CityContract {
  const contract: CityContract = {
    id: 'c999' as ContractId,
    good: 'Fish',
    amount: 10,
    delivered: 0,
    pricePerUnit: 900,
    kind,
    expiresTick: state.tick + daysToTicks(14),
    acceptedByPlayer: false,
  };
  state.cities.NewArk.contracts.push(contract);
  return contract;
}

describe('Aushang (Lieferaufträge)', () => {
  it('Preisgarantie zahlt sofort nach der letzten Lieferung', () => {
    const state = setupGame({ rank: 'huckster' });
    state.player.reputation.NewArk.societalBase = 1;
    const contract = addContract(state, 'priceGuarantee');
    state.player.inventory.Fish = 10;
    run(state, { type: 'AcceptContract', contractId: contract.id });
    run(state, { type: 'DeliverContract', contractId: contract.id, amount: 4, from: { kind: 'inventory' } });
    const money = state.player.money;
    run(state, { type: 'DeliverContract', contractId: contract.id, amount: 6, from: { kind: 'inventory' } });
    expect(state.player.money).toBe(money + 9000);
    expect(state.cities.NewArk.contracts).toHaveLength(0);
  });

  it('Lieferausschreibung zahlt erst zum Fristende', () => {
    const state = setupGame({ rank: 'huckster' });
    state.player.reputation.NewArk.societalBase = 1;
    const contract = addContract(state, 'tender');
    state.player.inventory.Fish = 10;
    run(state, { type: 'AcceptContract', contractId: contract.id });
    run(state, { type: 'DeliverContract', contractId: contract.id, amount: 10, from: { kind: 'inventory' } });
    const money = state.player.money;
    runDays(state, 15);
    expect(state.player.money).toBeGreaterThan(money + 8000);
  });

  it('verpasste Aufträge sperren neue für eine Weile', () => {
    const state = setupGame({ rank: 'huckster' });
    state.player.reputation.NewArk.societalBase = 1;
    const contract = addContract(state, 'priceGuarantee');
    run(state, { type: 'AcceptContract', contractId: contract.id });
    runDays(state, 15);
    expect(state.cities.NewArk.contractLockoutUntilTick).toBeGreaterThan(state.tick);
    const next = addContract(state, 'priceGuarantee');
    expect(applyCommand(state, { type: 'AcceptContract', contractId: next.id }).result.ok).toBe(false);
  });

  it('Tagelöhner dürfen noch keine Aufträge annehmen', () => {
    const state = setupGame();
    const contract = addContract(state, 'priceGuarantee');
    expect(applyCommand(state, { type: 'AcceptContract', contractId: contract.id }).result.ok).toBe(false);
  });
});

describe('Stadtrat', () => {
  it('Ratsherren beantragen die Kopfsteuer, der Rat entscheidet nach 14 Tagen', () => {
    const state = setupGame({ rank: 'councilor' });
    state.player.netWorth = 600_000;
    run(state, { type: 'ProposeMotion', motion: { kind: 'headTax', rate: 0.04 } });
    expect(
      applyCommand(state, { type: 'ProposeMotion', motion: { kind: 'headTax', rate: 0.05 } }).result.ok,
    ).toBe(false);
    runDays(state, 15);
    expect(state.cities.NewArk.motions).toHaveLength(0);
    expect(state.messages.some((m) => /Kopfsteuer|abgelehnt/.test(m.title))).toBe(true);
  });

  it('nur Ratsherren dürfen Anträge stellen', () => {
    const state = setupGame({ rank: 'merchant' });
    expect(
      applyCommand(state, { type: 'ProposeMotion', motion: { kind: 'headTax', rate: 0.04 } }).result.ok,
    ).toBe(false);
  });

  it('niedrigere Kopfsteuer macht die Bürger zufriedener', async () => {
    const { computeHappiness } = await import('../../systems/population');
    const state = setupGame();
    const city = state.cities.NewArk;
    const high = computeHappiness(state, city, 'poor');
    city.headTax = 0.02;
    expect(computeHappiness(state, city, 'poor')).toBeGreaterThan(high);
  });
});

describe('Wahl zum Schultheiss', () => {
  function electionDay(state: ReturnType<typeof setupGame>): void {
    const city = state.cities.NewArk;
    city.electionDayOfYear = toDate(state.tick).dayOfYear;
    runPoliticsDay(createContext(state));
  }

  it('ein beliebter Patrizier gewinnt, ein unbekannter nicht', () => {
    const famous = setupGame();
    famous.player.rank = 'patrician';
    famous.player.reputation.NewArk.socialBase = 150;
    famous.player.reputation.NewArk.societalBase = 150;
    electionDay(famous);
    expect(famous.cities.NewArk.mayor).toEqual({ kind: 'player' });

    const unknown = setupGame();
    unknown.player.rank = 'patrician';
    electionDay(unknown);
    expect(unknown.cities.NewArk.mayor.kind).toBe('notable');
  });

  it('Kaufleute stehen gar nicht auf der Liste', () => {
    const state = setupGame();
    state.player.rank = 'merchant';
    state.player.reputation.NewArk.socialBase = 500;
    expect(electionForecast(state, 'NewArk').some((c) => c.isPlayer)).toBe(false);
  });

  it('Bestechungsstimmen zählen bei der Wahl und werden verbraucht', () => {
    const state = setupGame();
    state.player.rank = 'patrician';
    const best = Math.max(...state.cities.NewArk.notables.map((n) => n.reputation));
    state.player.reputation.NewArk.socialBase = best - 10;
    state.player.reputation.NewArk.societalBase = best - 10;
    state.cities.NewArk.bribeVotes = 20;
    electionDay(state);
    expect(state.cities.NewArk.mayor).toEqual({ kind: 'player' });
    expect(state.cities.NewArk.bribeVotes).toBe(0);
  });

  it('der Schultheiss verwaltet die Stadtkasse', () => {
    const state = setupGame({ money: 10_000 });
    expect(applyCommand(state, { type: 'TreasuryTransfer', amount: 1000 }).result.ok).toBe(false);
    state.cities.NewArk.mayor = { kind: 'player' };
    const treasury = state.cities.NewArk.treasury;
    run(state, { type: 'TreasuryTransfer', amount: -500 });
    expect(state.cities.NewArk.treasury).toBe(treasury - 500);
    expect(state.player.money).toBe(10_500);
  });
});
