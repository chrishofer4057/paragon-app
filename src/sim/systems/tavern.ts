import { REPUTATION, TAVERN } from '../data/balance';
import { CITIES, CITY_IDS, mapDistance, type CityId } from '../data/cities';
import { GOOD_IDS, GOODS } from '../data/goods';
import { newId, postMessage, type SimContext } from '../context';
import { chance, nextInt, nextRange, pick } from '../rng';
import type { DayJob, TavernQuest } from '../state/gameState';
import type { OfferId, QuestId } from '../state/ids';
import { daysToTicks } from '../time';
import { isShortage, targetStock } from './demand';
import { addReputation } from './reputation';

/**
 * Taverne (Kneipe, Tippsammlung 2.1.1.1): Tagelöhnerarbeit, Kapitäne, fliegende Händler
 * und Aufträge aus dem Nebenraum (Reisender, Warenkäufer). Die Angebote wechseln täglich.
 */

const DAY_JOB_TITLES = [
  'Fässer am Hafen verladen',
  'Beim Zimmermann aushelfen',
  'Ställe ausmisten',
  'Netze flicken',
  'Säcke in die Markthalle tragen',
  'Dem Schmied den Blasebalg treten',
] as const;

function createDayJobs(ctx: SimContext): DayJob[] {
  const { state } = ctx;
  const jobs: DayJob[] = [];
  const count = chance(state.rng, TAVERN.dailyJobOfferChance) ? nextInt(state.rng, 1, 3) : 0;
  for (let i = 0; i < count; i++) {
    jobs.push({
      id: newId<OfferId>(state, 'o'),
      title: pick(state.rng, DAY_JOB_TITLES),
      wage: nextInt(state.rng, TAVERN.dayJobWageMin, TAVERN.dayJobWageMax),
    });
  }
  return jobs;
}

function createQuest(ctx: SimContext, cityId: CityId): TavernQuest | null {
  const { state } = ctx;
  const days = nextInt(state.rng, TAVERN.questDaysMin, TAVERN.questDaysMax);
  if (chance(state.rng, 0.5)) {
    const destination = pick(
      state.rng,
      CITY_IDS.filter((id) => id !== cityId),
    );
    const reward = Math.round(mapDistance(cityId, destination) * TAVERN.passengerRewardPerDistance);
    return {
      id: newId<QuestId>(state, 'q'),
      cityId,
      days,
      acceptedTick: null,
      deadlineTick: null,
      quest: { kind: 'passenger', destination, reward },
    };
  }
  const city = state.cities[cityId];
  const candidates = GOOD_IDS.filter((g) => GOODS[g].category !== 'material' && isShortage(city, g));
  if (candidates.length === 0) return null;
  const good = pick(state.rng, candidates);
  const amount = Math.max(2, Math.round(targetStock(city, good) * nextRange(state.rng, 0.05, 0.15)));
  return {
    id: newId<QuestId>(state, 'q'),
    cityId,
    days,
    acceptedTick: null,
    deadlineTick: null,
    quest: {
      kind: 'buyer',
      good,
      amount,
      reward: Math.round(amount * GOODS[good].basePrice * TAVERN.buyerPriceFactor),
    },
  };
}

export function runTavernDay(ctx: SimContext): void {
  const { state } = ctx;
  for (const cityId of CITY_IDS) {
    const tavern = state.cities[cityId].tavern;
    tavern.dayJobs = createDayJobs(ctx);
    if (!tavern.captainAvailable) tavern.captainAvailable = chance(state.rng, TAVERN.captainAppearChance);
    else if (chance(state.rng, 0.1)) tavern.captainAvailable = false;
    tavern.quests = tavern.quests.filter(() => !chance(state.rng, 0.15));
    if (tavern.quests.length < TAVERN.maxQuestsPerCity && chance(state.rng, TAVERN.questOfferChance)) {
      const quest = createQuest(ctx, cityId);
      if (quest) tavern.quests.push(quest);
    }
    tavern.peddler = null;
    if (chance(state.rng, TAVERN.peddlerChance)) {
      const city = state.cities[cityId];
      const surplus = GOOD_IDS.filter((g) => city.market[g] > targetStock(city, g) * 1.3);
      if (surplus.length > 0) {
        const good = pick(state.rng, surplus);
        tavern.peddler = {
          good,
          amount: nextInt(state.rng, 2, 12),
          pricePerUnit: Math.round(GOODS[good].basePrice * TAVERN.peddlerDiscount),
        };
      }
    }
  }
  expireQuests(ctx);
}

function expireQuests(ctx: SimContext): void {
  const { state } = ctx;
  const p = state.player;
  const expired = p.quests.filter((q) => q.deadlineTick !== null && q.deadlineTick < state.tick);
  if (expired.length === 0) return;
  p.quests = p.quests.filter((q) => !expired.includes(q));
  for (const quest of expired) {
    addReputation(state, quest.cityId, { societal: -REPUTATION.questFlat });
    postMessage(
      ctx,
      'warning',
      'Auftrag verfallen',
      'Ein Auftrag aus der Taverne ist abgelaufen.',
      quest.cityId,
    );
  }
}

/** Reisende erreichen ihr Ziel, wenn der Spieler dort ankommt. */
export function completePassengerQuests(ctx: SimContext, arrivedAt: CityId): void {
  const { state } = ctx;
  const p = state.player;
  const done = p.quests.filter((q) => q.quest.kind === 'passenger' && q.quest.destination === arrivedAt);
  for (const quest of done) {
    if (quest.quest.kind !== 'passenger') continue;
    p.money += quest.quest.reward;
    addReputation(state, arrivedAt, { social: REPUTATION.questFlat, societal: REPUTATION.questFlat });
    postMessage(
      ctx,
      'success',
      'Reisender abgeliefert',
      `Euer Fahrgast bedankt sich in ${CITIES[arrivedAt].name} mit ${quest.quest.reward} GS.`,
      arrivedAt,
    );
  }
  p.quests = p.quests.filter((q) => !done.includes(q));
}

export function questDeadline(stateTick: number, days: number): number {
  return stateTick + daysToTicks(days);
}
