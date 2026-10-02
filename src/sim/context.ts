import { MESSAGES } from './data/balance';
import type { CityId } from './data/cities';
import type { SimEvent } from './events/events';
import type { GameState, MessageKind } from './state/gameState';
import type { MessageId } from './state/ids';

/** Arbeitskontext eines Ticks oder Commands: Zustand plus gesammelte Ereignisse. */
export interface SimContext {
  state: GameState;
  events: SimEvent[];
}

export function createContext(state: GameState): SimContext {
  return { state, events: [] };
}

export function emit(ctx: SimContext, event: SimEvent): void {
  ctx.events.push(event);
}

/** Erzeugt eine deterministische, eindeutige ID. */
export function newId<T extends string>(state: GameState, prefix: string): T {
  const id = `${prefix}${state.nextId}`;
  state.nextId += 1;
  return id as T;
}

/** Amtliches Schreiben an den Spieler (Nachrichtenliste, neueste zuerst). */
export function postMessage(
  ctx: SimContext,
  kind: MessageKind,
  title: string,
  body: string,
  cityId: CityId | null = null,
): void {
  const { state } = ctx;
  state.messages.unshift({ id: newId<MessageId>(state, 'm'), tick: state.tick, kind, title, body, cityId });
  if (state.messages.length > MESSAGES.maxStored) state.messages.length = MESSAGES.maxStored;
  emit(ctx, { type: 'MessagePosted', kind, title, cityId });
}
