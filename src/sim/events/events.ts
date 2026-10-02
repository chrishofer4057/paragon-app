import type { BusinessTypeId } from '../data/businesses';
import type { CityId } from '../data/cities';
import type { GoodId } from '../data/goods';
import type { RankId } from '../data/ranks';
import type { ConstructionKind, MessageKind } from '../state/gameState';
import type { ContractId, JobId, ShipId } from '../state/ids';

/**
 * Ereignisse, auf die Phaser und Angular reagieren können. Sie verändern nichts –
 * der Zustand ist bereits aktualisiert, wenn sie ausgegeben werden.
 */
export type SimEvent =
  | { type: 'DayStarted'; day: number }
  | {
      type: 'GoodsTraded';
      cityId: CityId;
      good: GoodId;
      amount: number;
      totalPrice: number;
      direction: 'buy' | 'sell';
    }
  | { type: 'GoodsGathered'; cityId: CityId; good: GoodId; amount: number }
  | { type: 'ConstructionStarted'; jobId: JobId; cityId: CityId; kind: ConstructionKind }
  | { type: 'ConstructionCompleted'; jobId: JobId; cityId: CityId; kind: ConstructionKind }
  | { type: 'BusinessIdle'; cityId: CityId; businessType: BusinessTypeId; missing: GoodId }
  | { type: 'RankChanged'; from: RankId; to: RankId }
  | { type: 'ElectionHeld'; cityId: CityId; winner: string; playerWon: boolean }
  | { type: 'ContractOffered'; cityId: CityId; contractId: ContractId; good: GoodId }
  | { type: 'ShipArrived'; shipId: ShipId; cityId: CityId }
  | { type: 'PlayerArrived'; cityId: CityId }
  | { type: 'FireBrokeOut'; cityId: CityId }
  | { type: 'PlagueStarted'; cityId: CityId }
  | { type: 'PlagueEnded'; cityId: CityId }
  | { type: 'FestivalHeld'; cityId: CityId; success: number }
  | { type: 'MessagePosted'; kind: MessageKind; title: string; cityId: CityId | null };
