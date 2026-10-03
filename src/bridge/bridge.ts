import type { Command, CommandResult } from '../sim/commands/commands';
import type { SimEvent } from '../sim/events/events';
import type { GameState } from '../sim/state/gameState';

/**
 * Schnittstelle zwischen Spielwelt (3D, Three.js) und dem Rest. Die Spielwelt kennt nur dieses Interface,
 * nicht Angular – so bleiben die Schichten getrennt (CLAUDE.md §5.1).
 */

export type PanelId =
  | 'market'
  | 'tavern'
  | 'temple'
  | 'bathhouse'
  | 'guild'
  | 'townhall'
  | 'lender'
  | 'shipyard'
  | 'gate'
  | 'marketplace'
  | 'kontor'
  | 'construction'
  | 'city'
  | 'reputation'
  | 'possessions'
  | 'messages'
  | 'travel'
  | 'save';

export interface GameBridge {
  getState(): GameState;
  send(command: Command): CommandResult;
  /** Ereignisse aus Simulationsschritten; liefert eine Abmeldefunktion. */
  onEvents(listener: (events: SimEvent[]) => void): () => void;
  openPanel(panel: PanelId): void;
  /** Ist gerade ein Fenster offen? Dann bewegt die Spielwelt die Figur nicht. */
  isPanelOpen(): boolean;
  notify(text: string, kind?: 'info' | 'success' | 'warning' | 'danger'): void;
}
