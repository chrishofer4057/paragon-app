import type { BusinessTypeId } from '../data/businesses';
import type { HouseTypeId, InfrastructureId } from '../data/buildings';
import type { CharacterId } from '../data/characters';
import type { CityId } from '../data/cities';
import type { GoodAmounts, GoodId } from '../data/goods';
import type { RankId } from '../data/ranks';
import type { ShipTypeId } from '../data/ships';
import type { SkillId } from '../data/skills';
import type { RngState } from '../rng';
import type {
  BusinessId,
  ContractId,
  HouseId,
  JobId,
  LoanId,
  MessageId,
  MotionId,
  NotableId,
  OfferId,
  QuestId,
  ShipId,
  ShipmentId,
} from './ids';

/**
 * Der vollständige Spielzustand. Reines, serialisierbares JSON: keine Klassen, keine
 * Funktionen, keine zyklischen Referenzen. Beziehungen nur über IDs (CLAUDE.md §5.1).
 */
export interface GameState {
  tick: number;
  rng: RngState;
  /** Zähler für deterministische Entitäts-IDs. */
  nextId: number;
  cities: Record<CityId, CityState>;
  player: PlayerState;
  ships: Record<string, ShipState>;
  constructions: Record<string, ConstructionJob>;
  loans: Record<string, LoanState>;
  lentLoans: Record<string, LentLoanState>;
  npcShipments: NpcShipment[];
  lia: LiaState;
  messages: Message[];
}

// ---------------------------------------------------------------------------
// Städte
// ---------------------------------------------------------------------------

export interface ClassValues {
  rich: number;
  wealthy: number;
  poor: number;
}

export interface Population extends ClassValues {
  /** Bettler zählen nicht zur Schichtung, sind aber Arbeits- und Matrosenreservoir. */
  beggars: number;
}

export type InfrastructureCounts = Record<InfrastructureId, number>;

export interface TempleState {
  /** Bereits fertig ausgebaute Stufen (0–3). */
  stage: number;
  /** Gesammelte Spenden für die nächste Stufe. */
  donations: number;
  /** Vom Priester bereits eingekaufte Baumaterialien. */
  materials: GoodAmounts;
  /** Laufender Ausbau, sobald Geld und Material da sind. */
  buildingUntilTick: number | null;
}

export interface Notable {
  id: NotableId;
  name: string;
  /** Ansehen in der Stadt (gleiche Skala wie beim Spieler). */
  reputation: number;
}

export type MayorRef = { kind: 'notable'; notableId: NotableId } | { kind: 'player' };

export type MotionKind = { kind: 'headTax'; rate: number } | { kind: 'specialTax'; amount: number };

export interface Motion {
  id: MotionId;
  motion: MotionKind;
  proposedTick: number;
  sessionTick: number;
}

export type ContractKind = 'priceGuarantee' | 'tender';

export interface CityContract {
  id: ContractId;
  good: GoodId;
  amount: number;
  delivered: number;
  pricePerUnit: number;
  kind: ContractKind;
  expiresTick: number;
  acceptedByPlayer: boolean;
}

export interface DayJob {
  id: OfferId;
  title: string;
  wage: number;
}

export type QuestKind =
  | { kind: 'passenger'; destination: CityId; reward: number }
  | { kind: 'buyer'; good: GoodId; amount: number; reward: number };

export interface TavernQuest {
  id: QuestId;
  cityId: CityId;
  quest: QuestKind;
  /** Frist ab Annahme (Tage). */
  days: number;
  acceptedTick: number | null;
  deadlineTick: number | null;
}

export interface PeddlerOffer {
  good: GoodId;
  amount: number;
  pricePerUnit: number;
}

export interface TavernState {
  captainAvailable: boolean;
  dayJobs: DayJob[];
  quests: TavernQuest[];
  peddler: PeddlerOffer | null;
}

export interface GateDemand {
  good: GoodId;
  remaining: number;
  pricePerUnit: number;
}

export interface BorrowerOffer {
  id: OfferId;
  borrowerName: string;
  amount: number;
  weeks: number;
  weeklyRate: number;
}

export interface ShipyardState {
  level: number;
  xp: number;
  lastOrderTick: number;
}

export interface CityState {
  id: CityId;
  /** Marktbestand je Ware. */
  market: Record<GoodId, number>;
  /** Produktion städtischer Betriebe pro Tag (bei vollem Rohstoffangebot). */
  cityProduction: GoodAmounts;
  population: Population;
  /** Zufriedenheitswert je Schicht (0 … 1.25). */
  happiness: ClassValues;
  /** Städtischer Wohnraum (Personen) je Schicht – Spielerhäuser kommen dazu. */
  housing: ClassValues;
  /** Arbeitsplätze in städtischen Betrieben (fix, Städte bauen keine Betriebe). */
  cityJobs: number;
  infrastructure: InfrastructureCounts;
  temple: TempleState;
  treasury: number;
  treasuryMonthStart: number;
  headTax: number;
  mayor: MayorRef;
  mayorSinceTick: number;
  notables: Notable[];
  electionDayOfYear: number;
  /** Im Badehaus gekaufte Stimmen für die nächste Wahl. */
  bribeVotes: number;
  monument: boolean;
  motions: Motion[];
  contracts: CityContract[];
  contractLockoutUntilTick: number;
  tavern: TavernState;
  gate: GateDemand[];
  borrowerOffers: BorrowerOffer[];
  shipyard: ShipyardState;
  festival: { tick: number } | null;
  festivalBoostUntilTick: number;
  almsBoostDay: number | null;
  plagueUntilTick: number | null;
}

// ---------------------------------------------------------------------------
// Spieler
// ---------------------------------------------------------------------------

export type PlayerLocation =
  | { kind: 'city'; cityId: CityId }
  | {
      kind: 'travel';
      from: CityId;
      to: CityId;
      departTick: number;
      arriveTick: number;
      shipId: ShipId | null;
    };

export interface CityReputation {
  /** Zeitlich begrenztes Ansehen bei den Armen (klingt ab). */
  social: number;
  /** Zeitlich begrenztes Ansehen bei den Reichen (klingt ab). */
  societal: number;
  /** Dauerhaftes Ansehen (z. B. gestiftete Infrastruktur). */
  socialBase: number;
  societalBase: number;
}

export interface SkillState {
  level: number;
  xp: number;
}

export interface StandingOrder {
  /** Kaufen, solange der Stadtpreis höchstens so hoch ist … */
  buyBelow: number | null;
  /** … bis zu diesem Bestand im Kontor. */
  buyUpTo: number;
  /** Verkaufen, solange der Stadtpreis mindestens so hoch ist … */
  sellAbove: number | null;
  /** … aber nie unter diesen Bestand (Reserve für Betriebe/Bau). */
  keepMin: number;
}

export interface KontorState {
  cityId: CityId;
  storage: GoodAmounts;
  warehouses: number;
  guards: number;
  manager: { orders: Partial<Record<GoodId, StandingOrder>> } | null;
}

export interface BusinessState {
  id: BusinessId;
  type: BusinessTypeId;
  cityId: CityId;
  effective: boolean;
  workers: number;
  /** Gewünschte Auslastung 0 … 1. */
  utilization: number;
}

export interface HouseState {
  id: HouseId;
  type: HouseTypeId;
  cityId: CityId;
  rentLevel: number;
  tenants: number;
}

export interface MissionState {
  kind: MissionKind;
  cityId: CityId;
  startTick: number;
  deadlineTick: number;
  targetPopulation: number;
  delivered: GoodAmounts;
}

export type MissionKind = 'cityGlory' | 'landRoute';

export interface CargoConsignment {
  id: ShipmentId;
  good: GoodId;
  amount: number;
  from: CityId;
  to: CityId;
  arriveTick: number;
}

export interface PlayerState {
  name: string;
  characterId: CharacterId;
  homeCityId: CityId;
  money: number;
  /** Erarbeiteter Rang (sinkt nie). Ämter werden separat aus Stadt/Lia abgeleitet. */
  rank: RankId;
  location: PlayerLocation;
  busyUntilTick: number;
  /** Was die Figur selbst trägt (Rucksack/Handkarren). */
  inventory: GoodAmounts;
  skills: Record<SkillId, SkillState>;
  reputation: Record<CityId, CityReputation>;
  guilds: CityId[];
  kontors: Partial<Record<CityId, KontorState>>;
  businesses: Record<string, BusinessState>;
  houses: Record<string, HouseState>;
  stalls: Partial<Record<CityId, { paidUntilTick: number }>>;
  lastPrayerTick: number;
  lastBathTick: number;
  /** Tageskäufe je Ware (Tagelöhner-Limit) und Standverkäufe. */
  dailyLedger: { day: number; bought: GoodAmounts; stallSold: GoodAmounts };
  netWorth: number;
  quests: TavernQuest[];
  consignments: CargoConsignment[];
  mission: MissionState | null;
  missionsCompleted: number;
  missionLockoutUntilTick: number;
  liaInvited: boolean;
  /** Ränge, für die bereits ein "fast geschafft"-Brief verschickt wurde (keine Wiederholung). */
  rankHints: RankId[];
}

// ---------------------------------------------------------------------------
// Schiffe, Bau, Kredite, Lia
// ---------------------------------------------------------------------------

export type ShipLocation =
  | { kind: 'port'; cityId: CityId }
  | { kind: 'sea'; from: CityId; to: CityId; departTick: number; arriveTick: number };

export interface ShipState {
  id: ShipId;
  name: string;
  type: ShipTypeId;
  capacity: number;
  /** Zustand 0 … 100. */
  condition: number;
  crew: number;
  hasCaptain: boolean;
  cargo: GoodAmounts;
  location: ShipLocation;
  /** In der Werft zur Reparatur bis … */
  repairUntilTick: number | null;
}

export type ConstructionKind =
  | { type: 'business'; businessType: BusinessTypeId; effective: boolean }
  | { type: 'house'; houseType: HouseTypeId }
  | { type: 'kontor' }
  | { type: 'warehouse' }
  | { type: 'infrastructure'; infrastructure: InfrastructureId }
  | { type: 'ship'; shipType: ShipTypeId; name: string }
  | { type: 'templeStage'; stage: number };

export interface ConstructionJob {
  id: JobId;
  cityId: CityId;
  kind: ConstructionKind;
  durationDays: number;
  orderedTick: number;
  startTick: number | null;
  readyTick: number | null;
}

export interface LoanState {
  id: LoanId;
  cityId: CityId;
  principal: number;
  owed: number;
  weeklyRate: number;
  takenTick: number;
  dueTick: number;
  reminded: boolean;
}

export interface LentLoanState {
  id: LoanId;
  cityId: CityId;
  borrowerName: string;
  principal: number;
  weeklyRate: number;
  weeks: number;
  dueTick: number;
  /** Ausgefallen: Spieler muss bis zu diesem Tick pfänden oder erlassen. */
  defaultedUntilTick: number | null;
}

export interface NpcShipment {
  id: ShipmentId;
  good: GoodId;
  amount: number;
  to: CityId;
  arriveTick: number;
}

export interface LiaState {
  /** Sitz des Landammanns (Lia-Kanzlei). */
  capital: CityId;
  landammann: { kind: 'notable'; name: string } | { kind: 'player' };
  nextElectionTick: number;
}

export type MessageKind = 'info' | 'success' | 'warning' | 'danger';

export interface Message {
  id: MessageId;
  tick: number;
  kind: MessageKind;
  title: string;
  body: string;
  cityId: CityId | null;
}
