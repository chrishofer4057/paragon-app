import { describe, expect, it } from 'vitest';
import { ACCUSATIONS } from '../../data/balance';
import { TEMPLE_STAGES } from '../../data/buildings';
import { createContext } from '../../context';
import { applyCommand, tick } from '../../engine';
import { run, runDays, setupGame } from '../../testing/fixtures';
import { dayOf, daysToTicks } from '../../time';
import { runAccusationsWeek } from '../../systems/risks';
import { almsValueNeeded, guildFee } from './civic';

describe('Tempel', () => {
  it('Spenden sammeln sich, der Priester kauft Material und baut aus', () => {
    const state = setupGame({ money: 50_000 });
    const city = state.cities.NewArk;
    for (const [good, amount] of Object.entries(TEMPLE_STAGES[0]!.materials)) {
      city.market[good as keyof typeof city.market] += (amount ?? 0) * 3;
    }
    const message = run(state, { type: 'Donate', amount: TEMPLE_STAGES[0]!.donationsNeeded });
    expect(message).toMatch(/beginnen bald/);
    expect(state.player.reputation.NewArk.social).toBeGreaterThan(0);
    runDays(state, 2);
    expect(city.temple.buildingUntilTick).not.toBeNull();
    runDays(state, TEMPLE_STAGES[0]!.buildDays + 1);
    expect(city.temple.stage).toBe(1);
  });

  it('Armenspeisung lockt für einen Tag viele Bettler an', () => {
    const state = setupGame({ kontorIn: ['NewArk'] });
    const needed = almsValueNeeded(state, 'NewArk');
    state.player.kontors.NewArk!.storage.Grain = Math.ceil(needed / 150);
    run(state, {
      type: 'GiveAlms',
      goods: { Grain: Math.ceil(needed / 150) },
      from: { kind: 'kontor', cityId: 'NewArk' },
    });
    expect(state.cities.NewArk.almsBoostDay).toBe(dayOf(state.tick));
    expect(state.player.reputation.NewArk.social).toBeGreaterThan(0);
  });

  it('Armenspeisung nimmt keine Luxuswaren', () => {
    const state = setupGame();
    state.player.inventory.Silk = 1;
    expect(
      applyCommand(state, { type: 'GiveAlms', goods: { Silk: 1 }, from: { kind: 'inventory' } }).result.ok,
    ).toBe(false);
  });
});

describe('Beten und Baden schützen vor Anklagen', () => {
  it('wer drei Wochen nicht betet und badet, riskiert Bußgelder', () => {
    let accused = 0;
    for (let seed = 0; seed < 40; seed++) {
      const state = setupGame({ seed, money: 1000 });
      state.tick += daysToTicks(ACCUSATIONS.graceDays + 1);
      runAccusationsWeek(createContext(state));
      if (state.player.money < 1000) accused++;
    }
    expect(accused).toBeGreaterThan(0);

    for (let seed = 0; seed < 40; seed++) {
      const state = setupGame({ seed, money: 1000 });
      state.tick += daysToTicks(ACCUSATIONS.graceDays + 1);
      run(state, { type: 'Pray' });
      tick(state, 1);
      run(state, { type: 'TakeBath' });
      runAccusationsWeek(createContext(state));
      expect(state.player.money).toBe(1000);
    }
  });
});

describe('Gilde', () => {
  it('Beitrag richtet sich nach dem Vermögen, Heimatstadt ist billiger, gedeckelt bei 75.000', () => {
    const state = setupGame();
    state.player.netWorth = 100_000;
    expect(guildFee(state, 'NewArk')).toBeLessThan(guildFee(state, 'Reach'));
    state.player.netWorth = 100_000_000;
    expect(guildFee(state, 'Reach')).toBe(75_000);
  });

  it('Mengia zahlt nur die halbe Gebühr', () => {
    const gian = setupGame({ characterId: 'gian' });
    const mengia = setupGame({ characterId: 'mengia' });
    expect(guildFee(mengia, 'NewArk')).toBe(Math.round(guildFee(gian, 'NewArk') / 2));
  });

  it('Beitritt kostet einmalig und gilt pro Stadt', () => {
    const state = setupGame({ money: 5000 });
    run(state, { type: 'JoinGuild' });
    expect(state.player.guilds).toEqual(['NewArk']);
    expect(applyCommand(state, { type: 'JoinGuild' }).result.ok).toBe(false);
  });
});

describe('Fest', () => {
  it('wird drei Wochen vorher angekündigt und bewirtet aus dem Kontor', () => {
    const state = setupGame({
      kontorIn: ['NewArk'],
      kontorGoods: { Faerybloom: 200, Wine: 200, Fish: 20, Meat: 20, Grain: 30, Honey: 100 },
    });
    run(state, { type: 'AnnounceFestival' });
    expect(applyCommand(state, { type: 'AnnounceFestival' }).result.ok).toBe(false);
    runDays(state, 22);
    expect(state.cities.NewArk.festival).toBeNull();
    expect(state.player.kontors.NewArk!.storage.Wine ?? 0).toBeLessThan(200);
    expect(state.player.reputation.NewArk.social).toBeGreaterThan(1);
    expect(state.messages.some((m) => m.title === 'Fest gefeiert')).toBe(true);
  });
});

describe('Badehaus', () => {
  it('Bestechung kauft Stimmen für die nächste Wahl (wenn ein Ratsherr da ist)', () => {
    let bribed = false;
    for (let seed = 0; seed < 10 && !bribed; seed++) {
      const state = setupGame({ seed, money: 100_000 });
      const before = JSON.stringify(state);
      const { result } = applyCommand(state, { type: 'Bribe' });
      if (result.ok) {
        bribed = true;
        expect(state.cities.NewArk.bribeVotes).toBeGreaterThan(0);
      } else {
        expect(JSON.stringify(state)).toBe(before);
      }
    }
    expect(bribed).toBe(true);
  });
});
