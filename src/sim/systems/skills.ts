import { MAX_SKILL_LEVEL, xpForLevel, type SkillId } from '../data/skills';
import type { GameState } from '../state/gameState';

/** Erfahrung sammeln; steigt die Stufe, wird true zurückgegeben. */
export function gainSkillXp(state: GameState, skill: SkillId, xp: number): boolean {
  const s = state.player.skills[skill];
  if (s.level >= MAX_SKILL_LEVEL) return false;
  s.xp += xp;
  let leveled = false;
  while (s.level < MAX_SKILL_LEVEL && s.xp >= xpForLevel(s.level + 1)) {
    s.level += 1;
    leveled = true;
  }
  return leveled;
}
