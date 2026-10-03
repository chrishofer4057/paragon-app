/**
 * Speicherformat 2 → 3: Fraktionen (Wohlwollen, Bündnis) und Verruf kamen hinzu.
 * Alte Spielstände starten neutral: kein Wohlwollen, kein Bündnis, kein Verruf.
 */
interface V2Player {
  factions?: Record<string, number>;
  pledge?: string | null;
  pledgeChangedTick?: number;
  notoriety?: number;
}

export function migrate_2_to_3(state: unknown): unknown {
  const s = state as { player: V2Player };
  const p = s.player;
  p.factions ??= { merchants: 0, temple: 0, harbour: 0 };
  p.pledge ??= null;
  p.pledgeChangedTick ??= -1_000_000;
  p.notoriety ??= 0;
  return s;
}
