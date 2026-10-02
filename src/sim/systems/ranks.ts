import { CITY_IDS, type CityId } from '../data/cities';
import { EARNED_RANKS, RANKS, permissionsUpTo, rankIndex, type Permission, type RankId } from '../data/ranks';
import { emit, postMessage, type SimContext } from '../context';
import type { GameState } from '../state/gameState';
import { effectiveReputation, type ReputationValue } from './reputation';

/**
 * Rangaufstieg (Tippsammlung 6.1): Geprüft wird am Monatsersten in der Heimatstadt.
 * Ränge sind ein ewiger Titel und sinken nie. Ämter (Schultheiss, Landammann) werden
 * gewählt und daraus abgeleitet.
 */

export interface RankCheck {
  rank: RankId;
  netWorthOk: boolean;
  reputationOk: boolean;
  guildOk: boolean;
}

export function checkRank(state: GameState, rank: RankId, reputation: ReputationValue): RankCheck {
  const def = RANKS[rank];
  return {
    rank,
    netWorthOk: state.player.netWorth >= def.netWorth,
    reputationOk: reputation.social >= def.social && reputation.societal >= def.societal,
    guildOk: !def.requiresHomeGuild || state.player.guilds.includes(state.player.homeCityId),
  };
}

/** Rang, den der Spieler hätte, wenn `cityId` seine Heimatstadt wäre ("Persönliches", 2.2.1.6). */
export function localRank(state: GameState, cityId: CityId): RankId {
  const reputation = effectiveReputation(state, cityId);
  let best: RankId = 'dayLaborer';
  for (const rank of EARNED_RANKS) {
    const c = checkRank(state, rank, reputation);
    const guildOk = !RANKS[rank].requiresHomeGuild || state.player.guilds.includes(cityId);
    if (c.netWorthOk && c.reputationOk && guildOk) best = rank;
    else break;
  }
  return best;
}

export function isMayorOf(state: GameState, cityId: CityId): boolean {
  return state.cities[cityId].mayor.kind === 'player';
}

export function isMayorAnywhere(state: GameState): boolean {
  return CITY_IDS.some((id) => isMayorOf(state, id));
}

export function isLandammann(state: GameState): boolean {
  return state.lia.landammann.kind === 'player';
}

/** Angezeigter Titel: höchstes Amt oder erarbeiteter Rang. */
export function displayRank(state: GameState): RankId {
  if (isLandammann(state)) return 'landammann';
  if (isMayorOf(state, state.player.homeCityId)) return 'mayor';
  return state.player.rank;
}

export function hasPermission(state: GameState, permission: Permission): boolean {
  return (
    permissionsUpTo(displayRank(state)).has(permission) || permissionsUpTo(state.player.rank).has(permission)
  );
}

/**
 * Lokale Rechte (Anträge im Stadtrat, Landesherr): Ratsherr muss man in DIESER Stadt sein.
 * Der Landammann darf überall (Tippsammlung 6.2.5).
 */
export function hasLocalPermission(state: GameState, cityId: CityId, permission: Permission): boolean {
  if (isLandammann(state)) return true;
  if (isMayorOf(state, cityId)) return true;
  const rank = cityId === state.player.homeCityId ? state.player.rank : localRank(state, cityId);
  return permissionsUpTo(rank).has(permission);
}

export function runRankCheckMonth(ctx: SimContext): void {
  const { state } = ctx;
  const p = state.player;
  const reputation = effectiveReputation(state, p.homeCityId);
  const currentIndex = rankIndex(p.rank);
  let next: RankId | null = null;
  for (const rank of EARNED_RANKS) {
    if (rankIndex(rank) <= currentIndex) continue;
    const check = checkRank(state, rank, reputation);
    if (check.netWorthOk && check.reputationOk && check.guildOk) {
      next = rank;
      continue;
    }
    // "Fast geschafft"-Briefe (6.1.3.1), je Rang nur einmal.
    if (next === null && !p.rankHints.includes(rank)) {
      if (check.reputationOk && !check.netWorthOk) {
        p.rankHints.push(rank);
        postMessage(
          ctx,
          'info',
          'Euer Ansehen reicht',
          `Euer Ansehen reicht für den Rang ${RANKS[rank].name}. Leider seid Ihr noch nicht vermögend genug.`,
        );
      } else if (check.netWorthOk && !check.reputationOk) {
        p.rankHints.push(rank);
        postMessage(
          ctx,
          'info',
          'Euer Vermögen reicht',
          `Euer Vermögen reicht für den Rang ${RANKS[rank].name}, doch die Bürger kennen Euch noch zu wenig.`,
        );
      } else if (check.netWorthOk && check.reputationOk && !check.guildOk) {
        p.rankHints.push(rank);
        postMessage(
          ctx,
          'info',
          'Gilde erforderlich',
          `Für den Rang ${RANKS[rank].name} müsst Ihr der Gilde Eurer Heimatstadt beitreten.`,
        );
      }
    }
    break;
  }
  // Nur ein Aufstieg pro Monat in der Heimatstadt (6.1.1).
  if (next !== null) {
    const nextIndex = Math.min(rankIndex(next), currentIndex + 1);
    const target = EARNED_RANKS.find((r) => rankIndex(r) === nextIndex) ?? next;
    const from = p.rank;
    p.rank = target;
    emit(ctx, { type: 'RankChanged', from, to: target });
    postMessage(ctx, 'success', 'Gesellschaftlicher Aufstieg', `Ihr seid nun ${RANKS[target].name}.`);
  }
}
