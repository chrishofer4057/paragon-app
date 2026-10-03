/**
 * Echtzeit → Spielzeit. Reine Rechenlogik ohne Timer, damit sie testbar ist.
 *
 * Stufen: 0 = Pause, 1 = normal (ein Spieltag ≈ 1 Minute), 2 = schnell, 3 = sehr schnell.
 * Ist die Figur beschäftigt, wird mindestens "schnell" gespielt; auf Reisen "sehr schnell"
 * (CLAUDE.md §5.2: "Auf Reisen wird automatisch vorgespult").
 */

export type Speed = 0 | 1 | 2 | 3;

/** Echte Millisekunden pro Spielstunde je Stufe. */
export const MS_PER_HOUR: Readonly<Record<Exclude<Speed, 0>, number>> = {
  1: 2500,
  2: 300,
  3: 40,
};

/** Obergrenze je Aufruf, damit ein zurückkehrender Tab nicht Wochen am Stück rechnet. */
export const MAX_HOURS_PER_STEP = 48;

export function effectiveSpeed(chosen: Speed, busy: boolean, traveling: boolean): Speed {
  if (traveling) return 3;
  if (busy) return Math.max(chosen, 2) as Speed;
  return chosen;
}

export class GameClock {
  private carry = 0;

  /** Wie viele Spielstunden sind nach `elapsedMs` fällig? */
  advance(elapsedMs: number, speed: Speed): number {
    if (speed === 0) {
      this.carry = 0;
      return 0;
    }
    this.carry += elapsedMs / MS_PER_HOUR[speed];
    const hours = Math.min(MAX_HOURS_PER_STEP, Math.floor(this.carry));
    this.carry -= hours;
    if (this.carry > MAX_HOURS_PER_STEP) this.carry = 0;
    return hours;
  }

  /** Bruchteil der laufenden Stunde (für flüssige Animationen). */
  get fraction(): number {
    return this.carry;
  }
}
