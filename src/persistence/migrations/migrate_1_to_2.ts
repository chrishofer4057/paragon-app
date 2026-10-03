/**
 * Speicherformat 1 → 2: Feilschen (Händlerlaune, Versuche pro Tag) und Linienschiffe
 * (Buchung, Hafenlager) kamen hinzu.
 */
interface V1Player {
  dailyLedger: { day: number; bought: object; stallSold: object; haggles?: object };
  merchantMood?: object;
  linerBooking?: unknown;
  holds?: object;
}

export function migrate_1_to_2(state: unknown): unknown {
  const s = state as { player: V1Player };
  const p = s.player;
  p.dailyLedger = { ...p.dailyLedger, haggles: p.dailyLedger.haggles ?? {} };
  p.merchantMood ??= {};
  p.linerBooking ??= null;
  p.holds ??= {};
  return s;
}
