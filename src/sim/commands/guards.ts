import { CITIES, type CityId } from '../data/cities';
import { GOODS, type GoodId } from '../data/goods';
import { RANKS, type Permission, type RankId } from '../data/ranks';
import type { GameState } from '../state/gameState';
import { hasPermission } from '../systems/ranks';
import { amountOf, resolveStorage, storageInCity, type StorageRef } from '../systems/storage';
import { fail, type CommandResult } from './commands';

/**
 * Wiederverwendbare Vorbedingungen. Jede Funktion liefert entweder einen Fehler
 * oder `null` (= in Ordnung). Handler prüfen alles, bevor sie den Zustand ändern.
 */

export type Check = CommandResult | null;

export function currentCity(state: GameState): CityId | null {
  return state.player.location.kind === 'city' ? state.player.location.cityId : null;
}

export function requireCity(state: GameState): { cityId: CityId } | { error: CommandResult } {
  const cityId = currentCity(state);
  return cityId ? { cityId } : { error: fail('Ihr seid gerade auf Reisen.') };
}

export function requireNotBusy(state: GameState): Check {
  if (state.player.busyUntilTick > state.tick) return fail('Eure Figur ist noch beschäftigt.');
  return null;
}

/** Niedrigster Rang, der ein Recht gewährt – für verständliche Fehlermeldungen. */
function rankGranting(permission: Permission): RankId | undefined {
  return Object.values(RANKS).find((r) => r.grants.includes(permission))?.id;
}

export function requirePermission(state: GameState, permission: Permission): Check {
  if (hasPermission(state, permission)) return null;
  const rank = rankGranting(permission);
  return fail(
    rank ? `Dafür müsst Ihr mindestens ${RANKS[rank].name} sein.` : 'Dazu seid Ihr nicht berechtigt.',
  );
}

export function requirePositiveAmount(amount: number): Check {
  if (!Number.isFinite(amount) || amount <= 0) return fail('Die Menge muss positiv sein.');
  if (!Number.isInteger(amount)) return fail('Gehandelt werden nur ganze Einheiten.');
  return null;
}

export function requireMoney(state: GameState, cost: number): Check {
  if (state.player.money + 1e-6 < cost) return fail(`Dafür fehlt Euch Geld (${Math.ceil(cost)} GS nötig).`);
  return null;
}

/** Lagerort muss in der Stadt erreichbar sein und genug Ware enthalten. */
export function requireGoodsAt(
  state: GameState,
  ref: StorageRef,
  cityId: CityId,
  good: GoodId,
  amount: number,
): Check {
  if (!storageInCity(state, ref, cityId)) return fail('Dieser Lagerort ist hier nicht erreichbar.');
  const storage = resolveStorage(state, ref);
  if (!storage || amountOf(storage, good) + 1e-6 < amount) {
    return fail(`Nicht genug ${GOODS[good].name} vorhanden.`);
  }
  return null;
}

export function cityName(cityId: CityId): string {
  return CITIES[cityId].name;
}

export function firstError(...checks: Check[]): CommandResult | null {
  for (const check of checks) if (check) return check;
  return null;
}
