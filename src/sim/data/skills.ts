/**
 * Fertigkeiten (CLAUDE.md §2.3 "Selbst gemacht lehrt andere"): Wer eine Tätigkeit oft
 * selbst ausführt, wird besser darin – und bringt das später angestellten Arbeitern bei.
 */

export const SKILL_IDS = [
  'woodcutting',
  'fishing',
  'gathering',
  'quarrying',
  'trading',
  'seafaring',
] as const;
export type SkillId = (typeof SKILL_IDS)[number];

export const SKILL_NAMES: Readonly<Record<SkillId, string>> = {
  woodcutting: 'Holzfällen',
  fishing: 'Fischen',
  gathering: 'Sammeln',
  quarrying: 'Steinbrechen',
  trading: 'Handeln',
  seafaring: 'Seefahrt',
};

export const MAX_SKILL_LEVEL = 10;

/** Erfahrungspunkte, die für Stufe n+1 insgesamt nötig sind. */
export function xpForLevel(level: number): number {
  return 10 * level * (level + 1);
}

/** Ertragsbonus der eigenen Handarbeit je Stufe. */
export const SKILL_YIELD_PER_LEVEL = 0.06;
/** Produktionsbonus für eigene Betriebe der passenden Art je Stufe ("lehrt andere"). */
export const SKILL_BUSINESS_BONUS_PER_LEVEL = 0.01;
