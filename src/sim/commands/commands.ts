import type { FactionId } from '../data/factions';
import type { BusinessTypeId } from '../data/businesses';
import type { HouseTypeId, InfrastructureId } from '../data/buildings';
import type { CityId } from '../data/cities';
import type { GoodAmounts, GoodId } from '../data/goods';
import type { LineId } from '../data/lines';
import type { ShipTypeId } from '../data/ships';
import type { MissionKind, MotionKind, StandingOrder } from '../state/gameState';
import type { BusinessId, ContractId, HouseId, LoanId, OfferId, QuestId, ShipId } from '../state/ids';
import type { StorageRef } from '../systems/storage';

/**
 * Alle Spieleraktionen. Phaser und Angular senden ausschließlich diese Commands an die
 * Simulation (CLAUDE.md §5.1). Ortsgebundene Aktionen gelten für die Stadt, in der sich
 * die Figur gerade befindet.
 */

export type GatherActivity = 'wood' | 'stone' | 'fish' | 'herbs' | 'faerybloom';

export type Command =
  // --- Tagelöhner ---
  | { type: 'Gather'; activity: GatherActivity; quality: number }
  | { type: 'ChopWood'; quality: number }
  | { type: 'WorkDayJob'; jobId: OfferId }
  // --- Markt & Handel ---
  | { type: 'BuyGoods'; good: GoodId; amount: number; into: StorageRef }
  | { type: 'SellGoods'; good: GoodId; amount: number; from: StorageRef }
  | { type: 'TransferGoods'; good: GoodId; amount: number; from: StorageRef; to: StorageRef }
  | { type: 'RentStall' }
  | { type: 'SellAtStall'; good: GoodId; amount: number; from: StorageRef }
  | { type: 'BuyFromPeddler' }
  | { type: 'SellToLord'; good: GoodId; amount: number; from: StorageRef }
  | {
      type: 'Haggle';
      good: GoodId;
      amount: number;
      direction: 'buy' | 'sell';
      pricePerUnit: number;
      storage: StorageRef;
    }
  // --- Fraktionen ---
  | { type: 'PledgeFaction'; faction: FactionId | null }
  | { type: 'Smuggle'; good: GoodId; amount: number; storage: StorageRef }
  // --- Kontor ---
  | { type: 'FoundKontor' }
  | { type: 'BuildWarehouse' }
  | { type: 'SetGuards'; cityId: CityId; count: number }
  | { type: 'HireManager' }
  | { type: 'FireManager'; cityId: CityId }
  | { type: 'SetStandingOrder'; cityId: CityId; good: GoodId; order: StandingOrder | null }
  // --- Betriebe, Häuser, Infrastruktur ---
  | { type: 'BuildBusiness'; businessType: BusinessTypeId }
  | { type: 'SetUtilization'; businessId: BusinessId; utilization: number }
  | { type: 'DemolishBusiness'; businessId: BusinessId }
  | { type: 'BuildHouse'; houseType: HouseTypeId }
  | { type: 'SetRentLevel'; houseId: HouseId; level: number }
  | { type: 'FundInfrastructure'; infrastructure: InfrastructureId }
  // --- Tempel, Badehaus, Gilde, Marktplatz ---
  | { type: 'Pray' }
  | { type: 'Donate'; amount: number }
  | { type: 'GiveAlms'; goods: GoodAmounts; from: StorageRef }
  | { type: 'TakeBath' }
  | { type: 'Bribe' }
  | { type: 'JoinGuild' }
  | { type: 'AnnounceFestival' }
  // --- Stadthaus & Lia ---
  | { type: 'AcceptContract'; contractId: ContractId }
  | { type: 'DeliverContract'; contractId: ContractId; amount: number; from: StorageRef }
  | { type: 'ProposeMotion'; motion: MotionKind }
  | { type: 'SetHeadTax'; rate: number }
  | { type: 'TreasuryTransfer'; amount: number }
  | { type: 'AcceptMission'; mission: MissionKind }
  | { type: 'DeliverMissionGoods'; good: GoodId; amount: number; from: StorageRef }
  // --- Geldverleiher ---
  | { type: 'TakeLoan'; termIndex: number; amount: number }
  | { type: 'RepayLoan'; loanId: LoanId }
  | { type: 'GrantLoan'; offerId: OfferId }
  | { type: 'ResolveDefault'; loanId: LoanId; choice: 'seize' | 'forgive' }
  // --- Taverne ---
  | { type: 'AcceptQuest'; questId: QuestId }
  | { type: 'DeliverQuestGoods'; questId: QuestId; from: StorageRef }
  | { type: 'BuyInformation' }
  | { type: 'HireSailors'; shipId: ShipId; count: number }
  | { type: 'DismissSailors'; shipId: ShipId; count: number }
  | { type: 'HireCaptain'; shipId: ShipId }
  // --- Werft, Schiffe, Reisen ---
  | { type: 'OrderShip'; shipType: ShipTypeId; name: string }
  | { type: 'RepairShip'; shipId: ShipId }
  | { type: 'RenameShip'; shipId: ShipId; name: string }
  | { type: 'SendShip'; shipId: ShipId; destination: CityId }
  | { type: 'Travel'; destination: CityId; shipId?: ShipId }
  | {
      type: 'BookLiner';
      lineId: LineId;
      destination: CityId;
      cargo?: { good: GoodId; amount: number; from: StorageRef };
    }
  | { type: 'CancelLiner' }
  | { type: 'ShipCargo'; good: GoodId; amount: number; destination: CityId; from: StorageRef };

export type CommandType = Command['type'];

/**
 * Ergebnis eines Commands. `tag` unterscheidet gültige Ausgänge, die die UI verschieden
 * darstellen soll (z. B. Feilschen: 'accepted' oder 'rejected').
 */
export type CommandResult = { ok: true; message?: string; tag?: string } | { ok: false; reason: string };

export function ok(message?: string, tag?: string): CommandResult {
  const result: CommandResult = { ok: true };
  if (message !== undefined) result.message = message;
  if (tag !== undefined) result.tag = tag;
  return result;
}

export function fail(reason: string): CommandResult {
  return { ok: false, reason };
}
