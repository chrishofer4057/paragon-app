import type { FactionId } from './factions';
import type { CityId } from './cities';
import type { GoodId } from './goods';
import type { SkillId } from './skills';

/**
 * Die vier wählbaren Figuren (CLAUDE.md §3.1). Jede begünstigt einen anderen Weg durch
 * die frühen Stufen: Sammeln, Feilschen, Seefahrt/Kontakte, Ansehen.
 */

export const CHARACTER_IDS = ['gian', 'ursina', 'duri', 'mengia'] as const;
export type CharacterId = (typeof CHARACTER_IDS)[number];

export interface StartReputation {
  cityId: CityId;
  social: number;
  societal: number;
}

export interface CharacterDef {
  id: CharacterId;
  name: string;
  title: string;
  description: string;
  startCity: CityId;
  startMoney: number;
  /** Multiplikator auf Sammelerträge je Ware. */
  gatherYield: Partial<Record<GoodId, number>>;
  /** Startstufen in Fertigkeiten. */
  startSkills: Partial<Record<SkillId, number>>;
  /** Preisvorteil beim persönlichen Handel (0.04 = 4 % besser). */
  personalTradeBonus: number;
  startReputation: readonly StartReputation[];
  /** Faktor auf die Gildengebühr. */
  guildFeeFactor: number;
  /** Faktor auf Frachtmiete und Überfahrten. */
  freightFactor: number;
  /** Wohlwollen der Fraktionen zu Spielbeginn. */
  startFavor: Partial<Record<FactionId, number>>;
}

export const CHARACTERS: Readonly<Record<CharacterId, CharacterDef>> = {
  gian: {
    id: 'gian',
    name: 'Gian Caduff',
    title: 'Holzfäller aus den Bergtälern',
    description:
      'Kräftig und ausdauernd. Sammelt Holz und Stein deutlich schneller und kennt sich mit der Axt aus – ' +
      'der schnellste Weg zum ersten Kapital.',
    startCity: 'NewArk',
    startMoney: 25,
    gatherYield: { Wood: 1.5, Stone: 1.5 },
    startSkills: { woodcutting: 2 },
    personalTradeBonus: 0,
    startReputation: [{ cityId: 'NewArk', social: 0.2, societal: 0 }],
    guildFeeFactor: 1,
    freightFactor: 1,
    startFavor: { temple: 5 },
  },
  ursina: {
    id: 'ursina',
    name: 'Ursina Cathomen',
    title: 'Tochter einer Marktfrau',
    description:
      'Ist auf dem Markt aufgewachsen und feilscht wie keine Zweite. Bessere Preise beim persönlichen ' +
      'Handel – ideal für den frühen Aufstieg zur Stadthändlerin.',
    startCity: 'NewArk',
    startMoney: 40,
    gatherYield: {},
    startSkills: { trading: 2 },
    personalTradeBonus: 0.05,
    startReputation: [],
    guildFeeFactor: 1,
    freightFactor: 1,
    startFavor: { merchants: 8 },
  },
  duri: {
    id: 'duri',
    name: 'Duri Pult',
    title: 'Fischer von der Küste',
    description:
      'Kennt Wind und Wasser. Fängt mehr Fisch, zahlt weniger für Frachtraum und Überfahrten und hat ' +
      'Freunde in den Hafenstädten Port Nyx und Stormwatch.',
    startCity: 'NewArk',
    startMoney: 30,
    gatherYield: { Fish: 1.5 },
    startSkills: { fishing: 2, seafaring: 1 },
    personalTradeBonus: 0,
    startReputation: [
      { cityId: 'PortNyx', social: 0.5, societal: 0.3 },
      { cityId: 'Stormwatch', social: 0.5, societal: 0.3 },
    ],
    guildFeeFactor: 1,
    freightFactor: 0.75,
    startFavor: { harbour: 15 },
  },
  mengia: {
    id: 'mengia',
    name: 'Mengia da Lumbrein',
    title: 'Verarmte Patriziertochter',
    description:
      'Der Familienname öffnet noch Türen, das Vermögen ist dahin. Startet mit Ansehen bei den Reichen ' +
      'und zahlt nur die halbe Gildengebühr.',
    startCity: 'NewArk',
    startMoney: 60,
    gatherYield: {},
    startSkills: {},
    personalTradeBonus: 0,
    startReputation: [{ cityId: 'NewArk', social: 0.3, societal: 1.5 }],
    guildFeeFactor: 0.5,
    freightFactor: 1,
    startFavor: { merchants: 12, temple: 5 },
  },
};

export function isCharacterId(value: string): value is CharacterId {
  return (CHARACTER_IDS as readonly string[]).includes(value);
}
