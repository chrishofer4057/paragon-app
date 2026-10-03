import { POLITICS, REPUTATION } from '../data/balance';
import { notorietyElectionPenalty } from './factions';
import { CITIES, CITY_IDS, type CityId } from '../data/cities';
import { rankIndex } from '../data/ranks';
import { emit, postMessage, type SimContext } from '../context';
import { chance, nextRange } from '../rng';
import type { CityState, GameState, Motion } from '../state/gameState';
import { DAYS_PER_YEAR, daysToTicks, dayOf, toDate } from '../time';
import { totalPopulation } from './demand';
import { ownBuildingsInCity } from './finance';
import { isLandammann, isMayorOf } from './ranks';
import {
  addReputation,
  addReputationEverywhere,
  combinedReputation,
  effectiveReputation,
  hanseReputation,
} from './reputation';

/**
 * Stadthaus und Lia (Tippsammlung 2.1.1.3, 6.2, 6.4):
 * - jährliche Wahl des Schultheiss (Bürgermeister) je Stadt
 * - Anträge im Stadtrat (Kopfsteuer, Sondersteuer), Sitzung 14 Tage später
 * - Stadtkasse, Denkmal nach 1,5 Jahren im Amt
 * - Einladung in die Lia-Kanzlei, Missionen, Wahl des Landammanns
 */

export function mayorName(state: GameState, city: CityState): string {
  if (city.mayor.kind === 'player') return state.player.name;
  const notableId = city.mayor.notableId;
  return city.notables.find((n) => n.id === notableId)?.name ?? 'unbekannt';
}

/** Darf der Spieler in dieser Stadt kandidieren (Patrizier, Heimatstadt)? */
export function canRunForMayor(state: GameState, cityId: CityId): boolean {
  return cityId === state.player.homeCityId && rankIndex(state.player.rank) >= rankIndex('patrician');
}

export interface Candidate {
  name: string;
  score: number;
  isPlayer: boolean;
}

/** Kandidatenliste, nach Aussichten sortiert – die Stadtinfo-Prognose (2.1.1.3.3). */
export function electionForecast(state: GameState, cityId: CityId): Candidate[] {
  const city = state.cities[cityId];
  const candidates: Candidate[] = city.notables.map((n) => ({
    name: n.name,
    score: n.reputation + (city.mayor.kind === 'notable' && city.mayor.notableId === n.id ? 5 : 0),
    isPlayer: false,
  }));
  if (canRunForMayor(state, cityId)) {
    const rep = effectiveReputation(state, cityId);
    const incumbency = isMayorOf(state, cityId) ? 5 : 0;
    candidates.push({
      name: state.player.name,
      score: combinedReputation(rep) + city.bribeVotes + incumbency - notorietyElectionPenalty(state),
      isPlayer: true,
    });
  }
  return candidates.sort((a, b) => b.score - a.score).slice(0, 4 + (canRunForMayor(state, cityId) ? 1 : 0));
}

function holdMayorElection(ctx: SimContext, city: CityState): void {
  const { state } = ctx;
  const forecast = electionForecast(state, city.id);
  const winner = forecast[0];
  if (!winner) return;
  const wasPlayer = isMayorOf(state, city.id);
  if (winner.isPlayer) {
    if (!wasPlayer) city.mayorSinceTick = state.tick;
    city.mayor = { kind: 'player' };
  } else {
    const notable = city.notables.find((n) => n.name === winner.name)!;
    if (city.mayor.kind !== 'notable' || city.mayor.notableId !== notable.id)
      city.mayorSinceTick = state.tick;
    city.mayor = { kind: 'notable', notableId: notable.id };
  }
  city.bribeVotes = 0;
  emit(ctx, { type: 'ElectionHeld', cityId: city.id, winner: winner.name, playerWon: winner.isPlayer });
  const cityName = CITIES[city.id].name;
  if (winner.isPlayer && !wasPlayer) {
    postMessage(
      ctx,
      'success',
      'Zum Schultheiss gewählt',
      `Die Bürger von ${cityName} haben Euch zum Schultheiss gewählt!`,
      city.id,
    );
  } else if (!winner.isPlayer && wasPlayer) {
    postMessage(
      ctx,
      'danger',
      'Abgewählt',
      `${winner.name} löst Euch als Schultheiss von ${cityName} ab.`,
      city.id,
    );
  } else if (canRunForMayor(state, city.id) && !winner.isPlayer) {
    postMessage(
      ctx,
      'warning',
      'Wahl verloren',
      `${winner.name} wurde Schultheiss von ${cityName}.`,
      city.id,
    );
  }
}

function councilVotes(state: GameState, cityId: CityId): number {
  if (isLandammann(state)) return 3;
  if (isMayorOf(state, cityId)) return 2;
  return 1;
}

/** Sondersteuer: Anteil des Spielers nach seinem Gebäudeanteil, höchstens 70 % (2.1.1.3.3). */
export function specialTaxShare(state: GameState, cityId: CityId): number {
  const own = ownBuildingsInCity(state, cityId);
  const others = totalPopulation(state.cities[cityId]) / 100;
  return own + others > 0 ? Math.min(0.7, own / (own + others)) : 0;
}

function resolveMotion(ctx: SimContext, city: CityState, motion: Motion): void {
  const { state } = ctx;
  const notables = city.notables.length;
  let yes = councilVotes(state, city.id);
  let no = 0;
  const m = motion.motion;
  for (let i = 0; i < notables; i++) {
    let approve: boolean;
    if (m.kind === 'headTax') approve = chance(state.rng, 0.9);
    else {
      const pop = totalPopulation(city);
      const treasuryLow = city.treasury < pop * POLITICS.specialTaxMaxShareOfPopulation;
      approve = treasuryLow && m.amount <= pop * POLITICS.specialTaxMaxShareOfPopulation;
    }
    if (approve) yes += 1;
    else no += 1;
  }
  const cityName = CITIES[city.id].name;
  if (yes <= no) {
    postMessage(
      ctx,
      'warning',
      'Antrag abgelehnt',
      `Der Rat von ${cityName} hat Euren Antrag abgelehnt.`,
      city.id,
    );
    return;
  }
  if (m.kind === 'headTax') {
    city.headTax = m.rate;
    postMessage(
      ctx,
      'success',
      'Kopfsteuer geändert',
      `Der Rat von ${cityName} setzt die Kopfsteuer auf ${Math.round(m.rate * 100)} %.`,
      city.id,
    );
  } else {
    const playerShare = specialTaxShare(state, city.id) * m.amount;
    state.player.money -= playerShare;
    city.treasury += m.amount;
    postMessage(
      ctx,
      'info',
      'Sondersteuer erhoben',
      `Die Sondersteuer von ${Math.round(m.amount)} GS ist beschlossen. Euer Anteil: ${Math.round(playerShare)} GS.`,
      city.id,
    );
  }
}

function runMotions(ctx: SimContext, city: CityState): void {
  const due = city.motions.filter((m) => m.sessionTick <= ctx.state.tick);
  if (due.length === 0) return;
  city.motions = city.motions.filter((m) => m.sessionTick > ctx.state.tick);
  for (const motion of due) resolveMotion(ctx, city, motion);
}

export function motionSessionTick(state: GameState): number {
  return state.tick + daysToTicks(POLITICS.motionDelayDays);
}

export function runPoliticsDay(ctx: SimContext): void {
  const { state } = ctx;
  const { dayOfYear } = toDate(state.tick);
  for (const cityId of CITY_IDS) {
    const city = state.cities[cityId];
    runMotions(ctx, city);
    if (dayOfYear === city.electionDayOfYear && dayOf(state.tick) > 0) holdMayorElection(ctx, city);
    if (
      isMayorOf(state, cityId) &&
      !city.monument &&
      state.tick - city.mayorSinceTick >= daysToTicks(POLITICS.monumentDays)
    ) {
      city.monument = true;
      postMessage(
        ctx,
        'success',
        'Ein Denkmal für Euch',
        `${CITIES[cityId].name} errichtet Euch zu Ehren ein Denkmal auf dem Marktplatz.`,
        cityId,
      );
    }
  }
  runLiaDay(ctx);
}

export function runPoliticsMonth(ctx: SimContext): void {
  const { state } = ctx;
  for (const cityId of CITY_IDS) {
    const city = state.cities[cityId];
    for (const notable of city.notables) {
      notable.reputation = Math.min(
        POLITICS.notableReputationMax + 10,
        Math.max(
          POLITICS.notableReputationMin,
          notable.reputation + nextRange(state.rng, -1, 1) * POLITICS.notableDriftPerMonth,
        ),
      );
    }
    // Defizit der Stadtkasse unter dem eigenen Schultheiss kostet etwas Ansehen (2.1.1.3.6).
    if (isMayorOf(state, cityId) && city.treasury < city.treasuryMonthStart) {
      addReputation(state, cityId, {
        social: -REPUTATION.treasuryDeficitPenalty,
        societal: -REPUTATION.treasuryDeficitPenalty,
      });
    }
    city.treasuryMonthStart = city.treasury;
  }
}

// ---------------------------------------------------------------------------
// Lia (Hanse): Einladung, Missionen, Landammann
// ---------------------------------------------------------------------------

export const MISSIONS = {
  cityGlory: { name: 'Einer Stadt zu neuem Glanz verhelfen', days: 365, growth: 600, reward: 10_000 },
  landRoute: {
    name: 'Bau eines Landwegs',
    days: 180,
    materials: { Wood: 60, Stone: 80, Tools: 20 },
    reward: 5_000,
  },
} as const;

/** Die kleinste Stadt der Lia ist Ziel der Mission "neuer Glanz" (6.4.5). */
export function smallestCity(state: GameState): CityId {
  return CITY_IDS.reduce((best, id) =>
    totalPopulation(state.cities[id]) < totalPopulation(state.cities[best]) ? id : best,
  );
}

function completeMission(ctx: SimContext, title: string, reward: number): void {
  const { state } = ctx;
  state.player.mission = null;
  state.player.missionsCompleted += 1;
  state.player.money += reward;
  addReputationEverywhere(state, { social: 3, societal: 3 }, true);
  postMessage(ctx, 'success', 'Auftrag der Lia erfüllt', `${title}: Die Lia dankt Euch mit ${reward} GS.`);
}

function runMissions(ctx: SimContext): void {
  const { state } = ctx;
  const mission = state.player.mission;
  if (!mission) return;
  if (mission.kind === 'cityGlory') {
    if (totalPopulation(state.cities[mission.cityId]) >= mission.targetPopulation) {
      completeMission(ctx, MISSIONS.cityGlory.name, MISSIONS.cityGlory.reward);
      return;
    }
  }
  if (state.tick > mission.deadlineTick) {
    state.player.mission = null;
    state.player.missionLockoutUntilTick = state.tick + daysToTicks(42);
    postMessage(
      ctx,
      'danger',
      'Auftrag der Lia gescheitert',
      'Die Frist ist verstrichen. Für einige Wochen gibt es keine neuen Aufträge.',
    );
  }
}

/** Landwegs-Mission abschließen, wenn alles geliefert ist (vom Command-Handler aufgerufen). */
export function checkLandRouteComplete(ctx: SimContext): void {
  const mission = ctx.state.player.mission;
  if (!mission || mission.kind !== 'landRoute') return;
  const done = (
    Object.entries(MISSIONS.landRoute.materials) as [keyof typeof MISSIONS.landRoute.materials, number][]
  ).every(([good, amount]) => (mission.delivered[good] ?? 0) >= amount);
  if (done) completeMission(ctx, MISSIONS.landRoute.name, MISSIONS.landRoute.reward);
}

function holdLiaElection(ctx: SimContext): void {
  const { state } = ctx;
  const p = state.player;
  const playerEligible =
    isMayorOf(state, p.homeCityId) && p.missionsCompleted >= POLITICS.missionsForCandidacy;
  const incumbentScore = 80 + nextRange(state.rng, 0, 20) + (state.lia.landammann.kind === 'notable' ? 5 : 0);
  const playerScore = hanseReputation(state) + (isLandammann(state) ? 5 : 0);
  if (playerEligible && playerScore > incumbentScore) {
    const newly = !isLandammann(state);
    state.lia.landammann = { kind: 'player' };
    state.lia.capital = p.homeCityId;
    if (newly)
      postMessage(
        ctx,
        'success',
        'Landammann der Lia',
        'Der Liatag hat Euch zum Landammann gewählt – das höchste Amt der Lia!',
      );
  } else if (isLandammann(state)) {
    const { name } = state.cities[state.lia.capital].notables[0] ?? { name: 'ein Rivale' };
    state.lia.landammann = { kind: 'notable', name };
    postMessage(ctx, 'danger', 'Nicht wiedergewählt', `${name} ist neuer Landammann der Lia.`);
  }
  state.lia.nextElectionTick = state.tick + daysToTicks(DAYS_PER_YEAR);
}

function runLiaDay(ctx: SimContext): void {
  const { state } = ctx;
  const p = state.player;
  if (
    !p.liaInvited &&
    isMayorOf(state, p.homeCityId) &&
    hanseReputation(state) >= POLITICS.liaInvitationGlobal
  ) {
    p.liaInvited = true;
    postMessage(
      ctx,
      'success',
      'Einladung in die Lia-Kanzlei',
      `Der Landammann lädt Euch nach ${CITIES[state.lia.capital].name} ein, um Aufgaben zum Wohle der Lia zu übernehmen.`,
    );
  }
  runMissions(ctx);
  if (state.tick >= state.lia.nextElectionTick) holdLiaElection(ctx);
}
