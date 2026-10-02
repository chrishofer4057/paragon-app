/**
 * Gebrandete ID-Typen für Laufzeit-Entitäten. Statische IDs (Waren, Städte, Betriebsarten…)
 * sind String-Literal-Typen aus sim/data.
 */

type Brand<K extends string> = string & { readonly __brand: K };

export type BusinessId = Brand<'BusinessId'>;
export type HouseId = Brand<'HouseId'>;
export type ShipId = Brand<'ShipId'>;
export type LoanId = Brand<'LoanId'>;
export type ContractId = Brand<'ContractId'>;
export type JobId = Brand<'JobId'>;
export type QuestId = Brand<'QuestId'>;
export type MotionId = Brand<'MotionId'>;
export type NotableId = Brand<'NotableId'>;
export type MessageId = Brand<'MessageId'>;
export type OfferId = Brand<'OfferId'>;
export type ShipmentId = Brand<'ShipmentId'>;
