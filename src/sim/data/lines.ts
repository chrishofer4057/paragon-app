import type { CityId } from './cities';

/**
 * Linienschiffe (CLAUDE.md §2.5): feste Rundkurse mit Fahrplan. Jede Linie wird von
 * mehreren Schiffen im gleichen Abstand befahren; nach der letzten Station geht es zurück
 * zur ersten. Fahrplanzeiten werden aus der Spielzeit berechnet – kein Zustand nötig.
 */

export const LINE_IDS = ['southeast', 'eastcoast', 'central', 'northwest', 'southwest', 'grand'] as const;
export type LineId = (typeof LINE_IDS)[number];

export interface LineDef {
  id: LineId;
  name: string;
  stops: readonly CityId[];
  /** Anzahl Schiffe auf dem Rundkurs (gleichmäßig verteilt). */
  ships: number;
}

export const LINES: Readonly<Record<LineId, LineDef>> = {
  southeast: {
    id: 'southeast',
    name: 'Südostlinie',
    stops: ['NewArk', 'PortNyx', 'Nexara', 'Eos', 'Moira'],
    ships: 2,
  },
  eastcoast: {
    id: 'eastcoast',
    name: 'Ostküstenlinie',
    stops: ['NewArk', 'Bastion', 'Ebonfall', 'TheSpire', 'Emberstead', 'Kargath', 'Druumora'],
    ships: 2,
  },
  central: {
    id: 'central',
    name: 'Mittellinie',
    stops: ['NewArk', 'Stormwatch', 'Whiteridge', 'Ashenharbor', 'Umber', 'Reach', 'Volthaven', 'Nexara'],
    ships: 3,
  },
  northwest: {
    id: 'northwest',
    name: 'Nordwestlinie',
    stops: ['Reach', 'Aetherion', 'Valtirock', 'Zor', 'Asteer', 'Umber'],
    ships: 2,
  },
  southwest: {
    id: 'southwest',
    name: 'Südwestlinie',
    stops: ['Volthaven', 'Asteer', 'Asteria', 'Eldrath', 'Brenton', 'Riverrun', 'Eldrosa', 'Eos'],
    ships: 2,
  },
  grand: {
    id: 'grand',
    name: 'Große Runde',
    stops: ['NewArk', 'Nexara', 'Asteria', 'Aetherion', 'Bastion'],
    ships: 2,
  },
};

export const LINER = {
  speedPerDay: 14,
  /** Liegezeit je Station in Stunden. */
  stopHours: 12,
  farePerDistance: 1,
  cargoPerUnitPerDistance: 0.08,
} as const;
