/**
 * Bewertung der kleinen Geschicklichkeitsspiele (CLAUDE.md §2.3.6). Rein und testbar;
 * die Szene liefert nur Positionen bzw. Reaktionszeiten.
 */

/** Zeitspiel: Markierung (0..1) trifft eine Zone. 1 = genau in der Mitte, 0 = weit daneben. */
export function timingQuality(marker: number, zoneCenter: number, zoneHalfWidth: number): number {
  const distance = Math.abs(marker - zoneCenter);
  if (distance <= zoneHalfWidth) return 1 - (distance / zoneHalfWidth) * 0.3;
  const outside = distance - zoneHalfWidth;
  return Math.max(0, 0.7 - outside * 2.5);
}

/** Angeln: schnelle Reaktion auf den Biss. Unter 250 ms perfekt, ab 1,2 s nichts. */
export function reactionQuality(reactionMs: number): number {
  if (reactionMs < 0) return 0; // zu früh gezogen
  if (reactionMs <= 250) return 1;
  return Math.max(0, 1 - (reactionMs - 250) / 950);
}

/** Pendelbewegung der Markierung (0..1) über die Zeit. */
export function markerPosition(elapsedMs: number, periodMs: number): number {
  const phase = (elapsedMs % periodMs) / periodMs;
  return phase < 0.5 ? phase * 2 : 2 - phase * 2;
}
