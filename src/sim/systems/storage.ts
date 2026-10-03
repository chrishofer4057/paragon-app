import { GATHERING } from '../data/balance';
import { KONTOR, WAREHOUSE } from '../data/buildings';
import type { CityId } from '../data/cities';
import type { GoodAmounts, GoodId } from '../data/goods';
import type { GameState, KontorState, ShipState } from '../state/gameState';
import type { ShipId } from '../state/ids';

/**
 * Lagerorte: Rucksack der Figur, Kontor in einer Stadt, Laderaum eines Schiffs.
 * Alle drei funktionieren gleich, nur Kapazität und Ort unterscheiden sich.
 */

export type StorageRef =
  | { kind: 'inventory' }
  | { kind: 'kontor'; cityId: CityId }
  | { kind: 'ship'; shipId: ShipId }
  | { kind: 'hold'; cityId: CityId };

export function amountOf(storage: GoodAmounts, good: GoodId): number {
  return storage[good] ?? 0;
}

export function totalAmount(storage: GoodAmounts): number {
  let total = 0;
  for (const value of Object.values(storage)) total += value ?? 0;
  return total;
}

export function addGoods(storage: GoodAmounts, good: GoodId, amount: number): void {
  storage[good] = (storage[good] ?? 0) + amount;
}

/** Entfernt Ware; Reste unter 0,0001 werden gelöscht, damit keine Rundungsleichen bleiben. */
export function removeGoods(storage: GoodAmounts, good: GoodId, amount: number): void {
  const updated = (storage[good] ?? 0) - amount;
  if (updated <= 1e-4) delete storage[good];
  else storage[good] = updated;
}

export function kontorCapacity(kontor: KontorState): number {
  return KONTOR.capacity + kontor.warehouses * WAREHOUSE.capacity;
}

export function resolveStorage(state: GameState, ref: StorageRef): GoodAmounts | undefined {
  switch (ref.kind) {
    case 'inventory':
      return state.player.inventory;
    case 'kontor':
      return state.player.kontors[ref.cityId]?.storage;
    case 'ship':
      return state.ships[ref.shipId]?.cargo;
    case 'hold':
      return state.player.holds[ref.cityId];
  }
}

/**
 * Freier Platz. Das Kontor ist praktisch unbegrenzt (Überlauf wird gemietet,
 * Tippsammlung 2.1.1.1.10.9), Rucksack und Schiff sind hart begrenzt.
 */
export function freeCapacity(state: GameState, ref: StorageRef): number {
  switch (ref.kind) {
    case 'inventory':
      return Math.max(0, GATHERING.inventoryCapacity - totalAmount(state.player.inventory));
    case 'kontor':
      return state.player.kontors[ref.cityId] ? Number.POSITIVE_INFINITY : 0;
    case 'ship': {
      const ship = state.ships[ref.shipId];
      return ship ? Math.max(0, ship.capacity - totalAmount(ship.cargo)) : 0;
    }
    case 'hold':
      // Ins Hafenlager wird nur ausgeladen, nicht eingelagert.
      return 0;
  }
}

export function shipInPort(ship: ShipState): CityId | null {
  return ship.location.kind === 'port' ? ship.location.cityId : null;
}

/** Ist ein Lagerort in der Stadt erreichbar (Rucksack nur bei Anwesenheit, Schiff nur im Hafen)? */
export function storageInCity(state: GameState, ref: StorageRef, cityId: CityId): boolean {
  switch (ref.kind) {
    case 'inventory':
      return state.player.location.kind === 'city' && state.player.location.cityId === cityId;
    case 'kontor':
      return ref.cityId === cityId && state.player.kontors[cityId] !== undefined;
    case 'ship': {
      const ship = state.ships[ref.shipId];
      return ship !== undefined && shipInPort(ship) === cityId && ship.repairUntilTick === null;
    }
    case 'hold':
      return (
        ref.cityId === cityId &&
        state.player.holds[cityId] !== undefined &&
        state.player.location.kind === 'city' &&
        state.player.location.cityId === cityId
      );
  }
}
