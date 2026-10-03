import { describe, expect, it } from 'vitest';
import { FACTIONS, FACTION_BALANCE, NOTORIETY, SMUGGLING } from '../data/factions';
import { applyCommand } from '../engine';
import { run, runDays, setupGame } from '../testing/fixtures';
import { electionForecast } from './politics';
import { personalPriceBonus } from './market';
import { factionsView } from '../selectors';
import { addFavor, smuggleCatchChance, smuggleQuote } from './factions';

describe('Fraktionen', () => {
  it('neue Spiele starten mit Wohlwollen je nach Figur', () => {
    expect(setupGame({ characterId: 'duri' }).player.factions.harbour).toBeGreaterThan(0);
    expect(setupGame({ characterId: 'mengia' }).player.factions.merchants).toBeGreaterThan(0);
    const gian = setupGame({ characterId: 'gian' });
    expect(gian.player.pledge).toBeNull();
    expect(gian.player.notoriety).toBe(0);
  });

  it('Wohlwollen bleibt zwischen −100 und 100', () => {
    const state = setupGame();
    addFavor(state, 'temple', 500);
    expect(state.player.factions.temple).toBe(FACTION_BALANCE.maxFavor);
    addFavor(state, 'temple', -1000);
    expect(state.player.factions.temple).toBe(FACTION_BALANCE.minFavor);
  });

  it('ein Bündnis braucht Wohlwollen und verärgert den Rivalen', () => {
    const state = setupGame();
    expect(applyCommand(state, { type: 'PledgeFaction', faction: 'merchants' }).result.ok).toBe(false);
    addFavor(state, 'merchants', FACTION_BALANCE.pledgeMinFavor);
    const rival = FACTIONS.merchants.rival;
    const before = state.player.factions[rival];
    run(state, { type: 'PledgeFaction', faction: 'merchants' });
    expect(state.player.pledge).toBe('merchants');
    expect(state.player.factions[rival]).toBe(before - FACTION_BALANCE.pledgeRivalPenalty);
  });

  it('das Bündnis lässt sich nicht beliebig oft wechseln', () => {
    const state = setupGame();
    addFavor(state, 'merchants', 50);
    addFavor(state, 'temple', 50);
    run(state, { type: 'PledgeFaction', faction: 'merchants' });
    expect(applyCommand(state, { type: 'PledgeFaction', faction: 'temple' }).result.ok).toBe(false);
    runDays(state, FACTION_BALANCE.pledgeCooldownDays + 1);
    run(state, { type: 'PledgeFaction', faction: 'temple' });
    expect(state.player.pledge).toBe('temple');
    // Wer die Gilde verlässt, verliert dort Wohlwollen
    expect(state.player.factions.merchants).toBeLessThan(50);
  });

  it('die Kaufmannsgilde verbessert als Verbündete die Handelspreise', () => {
    const state = setupGame();
    const base = personalPriceBonus(state);
    addFavor(state, 'merchants', 30);
    run(state, { type: 'PledgeFaction', faction: 'merchants' });
    expect(personalPriceBonus(state)).toBeCloseTo(base + FACTION_BALANCE.merchantTradeBonusPledged);
  });

  it('Gildenbeitritt und Spenden bringen Wohlwollen bei Gilde und Tempel', () => {
    const state = setupGame({ rank: 'merchant', money: 100_000 });
    run(state, { type: 'JoinGuild' });
    expect(state.player.factions.merchants).toBeGreaterThan(0);
    run(state, { type: 'Donate', amount: 1000 });
    expect(state.player.factions.temple).toBeGreaterThan(0);
  });
});

describe('Schmuggel', () => {
  function smuggler() {
    const state = setupGame({ rank: 'huckster', money: 100 });
    state.player.inventory.Wood = 10;
    addFavor(state, 'harbour', SMUGGLING.minHarbourFavor);
    return state;
  }

  it('geht nur mit Kontakten zur Hafenbruderschaft', () => {
    const state = setupGame({ rank: 'huckster' });
    state.player.inventory.Wood = 10;
    const rng = { ...state.rng };
    const result = applyCommand(state, {
      type: 'Smuggle',
      good: 'Wood',
      amount: 5,
      storage: { kind: 'inventory' },
    }).result;
    expect(result.ok).toBe(false);
    expect(state.rng).toEqual(rng); // ungültige Commands berühren den Zufall nicht
  });

  it('bringt mehr als der Markt, kostet Zeit und Leumund', () => {
    const state = smuggler();
    const quote = smuggleQuote(state, 'NewArk', 'Wood', 5);
    expect(quote.value).toBeGreaterThan(quote.marketValue);
    let caught = false;
    let earned = false;
    // Über viele Seeds kommen beide Ausgänge vor
    for (let seed = 1; seed < 80 && !(caught && earned); seed++) {
      const s = smuggler();
      s.rng.seed = seed;
      s.rng.state = seed;
      const money = s.player.money;
      run(s, { type: 'Smuggle', good: 'Wood', amount: 5, storage: { kind: 'inventory' } });
      expect(s.player.inventory.Wood ?? 0).toBeCloseTo(5);
      expect(s.player.busyUntilTick).toBeGreaterThan(s.tick);
      if (s.player.money > money) {
        earned = true;
        expect(s.player.notoriety).toBe(NOTORIETY.smuggleSuccess);
      } else {
        caught = true;
        expect(s.player.money).toBeLessThan(money);
        expect(s.player.notoriety).toBe(NOTORIETY.smuggleCaught);
      }
    }
    expect(caught && earned).toBe(true);
  });

  it('ein Bündnis mit dem Hafen senkt das Risiko, Verruf erhöht es', () => {
    const state = smuggler();
    const base = smuggleCatchChance(state);
    addFavor(state, 'harbour', 30);
    run(state, { type: 'PledgeFaction', faction: 'harbour' });
    expect(smuggleCatchChance(state)).toBeLessThan(base);
    state.player.notoriety = 80;
    expect(smuggleCatchChance(state)).toBeGreaterThan(
      smuggleCatchChance({ ...state, player: { ...state.player, notoriety: 0 } }),
    );
  });
});

describe('Verruf', () => {
  it('Bestechung erhöht den Verruf und verärgert den Tempel', () => {
    const state = setupGame({ money: 1_000_000 });
    const temple = state.player.factions.temple;
    // an einem Tag mit empfänglichem Ratsherrn bestechen
    for (let i = 0; i < 40; i++) {
      if (applyCommand(state, { type: 'Bribe' }).result.ok) break;
      runDays(state, 1);
    }
    expect(state.player.notoriety).toBe(NOTORIETY.bribe);
    expect(state.player.factions.temple).toBeLessThan(temple);
  });

  it('klingt Woche für Woche ab', () => {
    const state = setupGame();
    state.player.notoriety = 10;
    runDays(state, 14);
    expect(state.player.notoriety).toBeLessThan(10);
  });

  it('kostet Stimmen bei der Wahl', () => {
    const state = setupGame({ rank: 'patrician', money: 1_000_000 });
    state.player.reputation.NewArk.social = 40;
    state.player.reputation.NewArk.societal = 40;
    const score = () => electionForecast(state, 'NewArk').find((c) => c.isPlayer)?.score ?? 0;
    const clean = score();
    state.player.notoriety = 60;
    expect(score()).toBeLessThan(clean);
  });
});

describe('Anzeige der Fraktionen', () => {
  it('zeigt Ansehen, Bündnis und Wartezeit', () => {
    const state = setupGame({ characterId: 'duri' });
    let view = factionsView(state);
    expect(view.rows.map((r) => r.id)).toEqual(['merchants', 'temple', 'harbour']);
    expect(view.rows.find((r) => r.id === 'harbour')!.standing).toBe('wohlgesinnt');
    expect(view.notorietyText).toBe('unbescholten');
    addFavor(state, 'harbour', 20);
    expect(factionsView(state).rows.find((r) => r.id === 'harbour')!.canPledge).toBe(true);
    run(state, { type: 'PledgeFaction', faction: 'harbour' });
    view = factionsView(state);
    expect(view.pledge).toBe('harbour');
    expect(view.cooldownDays).toBe(FACTION_BALANCE.pledgeCooldownDays);
    expect(view.rows.every((r) => !r.canPledge)).toBe(true);
  });
});
