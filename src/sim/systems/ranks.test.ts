import { describe, expect, it } from 'vitest';
import { RANKS } from '../data/ranks';
import { createContext } from '../context';
import { runDays, setupGame } from '../testing/fixtures';
import { displayRank, hasLocalPermission, localRank, runRankCheckMonth } from './ranks';

function grant(
  state: ReturnType<typeof setupGame>,
  social: number,
  societal: number,
  netWorth: number,
): void {
  state.player.reputation.NewArk.socialBase = social;
  state.player.reputation.NewArk.societalBase = societal;
  state.player.money = netWorth;
  state.player.netWorth = netWorth;
}

describe('Ränge', () => {
  it('Aufstieg braucht Vermögen UND Ansehen', () => {
    const rich = setupGame();
    grant(rich, 0, 0, 1_000_000);
    runRankCheckMonth(createContext(rich));
    expect(rich.player.rank).toBe('dayLaborer');

    const famous = setupGame();
    grant(famous, 60, 60, 0);
    runRankCheckMonth(createContext(famous));
    expect(famous.player.rank).toBe('dayLaborer');

    const both = setupGame();
    grant(both, RANKS.huckster.social, RANKS.huckster.societal, RANKS.huckster.netWorth);
    runRankCheckMonth(createContext(both));
    expect(both.player.rank).toBe('huckster');
  });

  it('höchstens ein Aufstieg pro Monat in der Heimatstadt', () => {
    const state = setupGame();
    grant(state, 60, 60, 2_000_000);
    state.player.guilds.push('NewArk');
    runRankCheckMonth(createContext(state));
    expect(state.player.rank).toBe('huckster');
    runRankCheckMonth(createContext(state));
    expect(state.player.rank).toBe('trader');
  });

  it('wird am Monatsersten automatisch geprüft', () => {
    const state = setupGame();
    grant(state, 5, 5, 5000);
    runDays(state, 31);
    expect(state.player.rank).not.toBe('dayLaborer');
  });

  it('Fernkaufmann erfordert die Gilde der Heimatstadt', () => {
    const state = setupGame();
    state.player.rank = 'merchant';
    grant(state, 20, 20, 200_000);
    runRankCheckMonth(createContext(state));
    expect(state.player.rank).toBe('merchant');
    expect(state.messages.some((m) => m.title === 'Gilde erforderlich')).toBe(true);
    state.player.guilds.push('NewArk');
    runRankCheckMonth(createContext(state));
    expect(state.player.rank).toBe('distanceMerchant');
  });

  it('Ränge sinken nie, auch wenn das Ansehen schwindet', () => {
    const state = setupGame();
    state.player.rank = 'trader';
    grant(state, 0, 0, 0);
    runRankCheckMonth(createContext(state));
    expect(state.player.rank).toBe('trader');
  });

  it('verschickt einen Hinweisbrief, wenn nur das Vermögen fehlt', () => {
    const state = setupGame();
    grant(state, 10, 10, 0);
    runRankCheckMonth(createContext(state));
    expect(state.messages[0]?.title).toBe('Euer Ansehen reicht');
  });

  it('lokaler Rang gilt für Anträge in fremden Städten', () => {
    const state = setupGame();
    state.player.rank = 'councilor';
    state.player.netWorth = 600_000;
    expect(hasLocalPermission(state, 'NewArk', 'councilMotions')).toBe(true);
    expect(localRank(state, 'Reach')).toBe('dayLaborer');
    expect(hasLocalPermission(state, 'Reach', 'councilMotions')).toBe(false);
  });

  it('Ämter überstrahlen den Rang', () => {
    const state = setupGame();
    state.player.rank = 'patrician';
    state.cities.NewArk.mayor = { kind: 'player' };
    expect(displayRank(state)).toBe('mayor');
  });
});
