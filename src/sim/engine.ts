import { FACTION_IDS, type FactionId } from './data/factions';
import { runFactionsWeek } from './systems/factions';
import { CITY_HOUSING_BUILD_THRESHOLD } from './data/buildings';
import { CHARACTERS, type CharacterId } from './data/characters';
import { CITIES, CITY_IDS, type CityId } from './data/cities';
import { SKILL_IDS, type SkillId } from './data/skills';
import type { Command, CommandResult } from './commands/commands';
import { dispatch } from './commands/dispatch';
import { createContext, emit, postMessage, type SimContext } from './context';
import type { SimEvent } from './events/events';
import { createRng } from './rng';
import type { CityReputation, GameState, SkillState } from './state/gameState';
import { runHiringDay, runBusinessesHour } from './systems/businesses';
import { runConstructionHour, runShipyardDecayWeek } from './systems/construction';
import { runContractsDay } from './systems/contracts';
import { runDisastersDay } from './systems/disasters';
import { runCityEconomyHour } from './systems/economy';
import { runFestivalsHour } from './systems/festival';
import { computeNetWorth, runFinanceDay, runFinanceWeek, updateTenants } from './systems/finance';
import { runGateMonth } from './systems/gate';
import { runBorrowerOffersWeek, runLoansDay, runLoansWeek } from './systems/lender';
import { runManagersDay } from './systems/manager';
import { deliverNpcShipments, runNpcTradeDay } from './systems/npcTrade';
import { runPoliticsDay, runPoliticsMonth } from './systems/politics';
import { runCityHousingWeek, runPopulationDay } from './systems/population';
import { runRankCheckMonth } from './systems/ranks';
import { decayReputation, addReputation } from './systems/reputation';
import { recoverMerchantMood } from './systems/haggle';
import { runAccusationsWeek, runBurglaryWeek } from './systems/risks';
import { runTavernDay } from './systems/tavern';
import { runTempleDay } from './systems/temple';
import { runTravelHour } from './systems/travel';
import { runLinersHour } from './systems/liners';
import {
  DAYS_PER_YEAR,
  START_TICK,
  dayOf,
  daysToTicks,
  isStartOfDay,
  isStartOfMonth,
  isStartOfWeek,
} from './time';
import { createCities } from './world/createWorld';

/**
 * Einstiegspunkte der Simulation (CLAUDE.md §5.1):
 *   createNewGame – neuen Spielzustand erzeugen
 *   applyCommand  – Spieleraktion ausführen (ungültig = keine Änderung + Grund)
 *   tick          – Spielzeit um eine Stunde voranbringen
 *
 * Aus Performancegründen verändern applyCommand und tick den übergebenen Zustand direkt
 * und geben die Ereignisse zurück. Wer Unveränderlichkeit braucht (z. B. für Signals),
 * nutzt `applyCommandPure` oder klont vorher (siehe Entscheidungslog).
 */

export interface NewGameOptions {
  seed: number;
  characterId: CharacterId;
  playerName?: string;
}

function emptyReputation(): Record<CityId, CityReputation> {
  return Object.fromEntries(
    CITY_IDS.map((id) => [id, { social: 0, societal: 0, socialBase: 0, societalBase: 0 }]),
  ) as Record<CityId, CityReputation>;
}

export function createNewGame(options: NewGameOptions): GameState {
  const character = CHARACTERS[options.characterId];
  const state: GameState = {
    tick: START_TICK,
    rng: createRng(options.seed),
    nextId: 1,
    cities: {} as GameState['cities'],
    player: {
      name: options.playerName?.trim() || character.name,
      characterId: character.id,
      homeCityId: character.startCity,
      money: character.startMoney,
      rank: 'dayLaborer',
      location: { kind: 'city', cityId: character.startCity },
      busyUntilTick: 0,
      inventory: {},
      skills: Object.fromEntries(
        SKILL_IDS.map((id) => [id, { level: character.startSkills[id] ?? 0, xp: 0 }]),
      ) as Record<SkillId, SkillState>,
      reputation: emptyReputation(),
      guilds: [],
      kontors: {},
      businesses: {},
      houses: {},
      stalls: {},
      lastPrayerTick: START_TICK,
      lastBathTick: START_TICK,
      dailyLedger: { day: dayOf(START_TICK), bought: {}, stallSold: {}, haggles: {} },
      merchantMood: {},
      linerBooking: null,
      holds: {},
      netWorth: character.startMoney,
      quests: [],
      consignments: [],
      mission: null,
      missionsCompleted: 0,
      missionLockoutUntilTick: 0,
      liaInvited: false,
      rankHints: [],
      factions: Object.fromEntries(FACTION_IDS.map((id) => [id, character.startFavor[id] ?? 0])) as Record<
        FactionId,
        number
      >,
      pledge: null,
      pledgeChangedTick: -1_000_000,
      notoriety: 0,
    },
    ships: {},
    constructions: {},
    loans: {},
    lentLoans: {},
    npcShipments: [],
    lia: { capital: 'Aetherion', landammann: { kind: 'notable', name: '' }, nextElectionTick: 0 },
    messages: [],
  };
  state.cities = createCities(state);
  for (const start of character.startReputation) {
    addReputation(state, start.cityId, { social: start.social, societal: start.societal }, true);
  }
  const capital = state.cities[state.lia.capital];
  state.lia.landammann = { kind: 'notable', name: capital.notables[0]?.name ?? 'Gion Cadonau' };
  state.lia.nextElectionTick = START_TICK + daysToTicks(DAYS_PER_YEAR);

  const ctx = createContext(state);
  runTavernDay(ctx);
  runGateMonth(ctx);
  runBorrowerOffersWeek(ctx);
  postMessage(
    ctx,
    'info',
    'Willkommen in Fiera',
    `${state.player.name} kommt mittellos in ${CITIES[character.startCity].name} an. ` +
      'Sammelt Holz im Umland, verkauft es auf dem Markt – und arbeitet Euch hoch bis zum Landammann der Lia.',
  );
  return state;
}

export interface CommandOutcome {
  result: CommandResult;
  events: SimEvent[];
}

/** Führt einen Command aus. Ungültige Commands verändern den Zustand nicht. */
export function applyCommand(state: GameState, command: Command): CommandOutcome {
  const ctx = createContext(state);
  const result = dispatch(ctx, command);
  return { result, events: result.ok ? ctx.events : [] };
}

/** Wie applyCommand, aber auf einer Kopie – der Eingabezustand bleibt unberührt. */
export function applyCommandPure(state: GameState, command: Command): CommandOutcome & { state: GameState } {
  const copy = structuredClone(state);
  const outcome = applyCommand(copy, command);
  return { ...outcome, state: outcome.result.ok ? copy : state };
}

function runDaily(ctx: SimContext): void {
  const { state } = ctx;
  emit(ctx, { type: 'DayStarted', day: dayOf(state.tick) });
  runPopulationDay(state);
  runHiringDay(state);
  updateTenants(state);
  decayReputation(state);
  recoverMerchantMood(state);
  runManagersDay(ctx);
  runTempleDay(ctx);
  runContractsDay(ctx);
  runTavernDay(ctx);
  runNpcTradeDay(ctx);
  runDisastersDay(ctx);
  runFinanceDay(ctx);
  runLoansDay(ctx);
  state.player.netWorth = computeNetWorth(state);
  runPoliticsDay(ctx);
}

function runWeekly(ctx: SimContext): void {
  const { state } = ctx;
  runFinanceWeek(ctx);
  runLoansWeek(state);
  runCityHousingWeek(state, CITY_HOUSING_BUILD_THRESHOLD);
  runAccusationsWeek(ctx);
  runBurglaryWeek(ctx);
  runFactionsWeek(ctx);
  runBorrowerOffersWeek(ctx);
  runShipyardDecayWeek(state);
}

function runMonthly(ctx: SimContext): void {
  runRankCheckMonth(ctx);
  runGateMonth(ctx);
  runPoliticsMonth(ctx);
}

/** Bringt die Spielzeit um `hours` Stunden voran und liefert alle Ereignisse. */
export function tick(state: GameState, hours = 1): SimEvent[] {
  const ctx = createContext(state);
  for (let i = 0; i < hours; i++) {
    state.tick += 1;
    runCityEconomyHour(state);
    runBusinessesHour(state);
    deliverNpcShipments(ctx);
    runTravelHour(ctx);
    runLinersHour(ctx);
    runConstructionHour(ctx);
    runFestivalsHour(ctx);
    if (isStartOfDay(state.tick)) runDaily(ctx);
    if (isStartOfWeek(state.tick)) runWeekly(ctx);
    if (isStartOfMonth(state.tick)) runMonthly(ctx);
  }
  return ctx.events;
}
