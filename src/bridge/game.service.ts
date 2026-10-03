import { Injectable, computed, isDevMode, signal } from '@angular/core';
import { IndexedDbSaveStorage } from '../persistence/indexedDbStorage';
import { createSaveFile, loadSave, serializeSave, type SaveFile } from '../persistence/saveFile';
import type { Command, CommandResult } from '../sim/commands/commands';
import type { CharacterId } from '../sim/data/characters';
import type { CityId } from '../sim/data/cities';
import { applyCommand, createNewGame, tick } from '../sim/engine';
import type { SimEvent } from '../sim/events/events';
import type { GameState } from '../sim/state/gameState';
import { HOURS_PER_DAY } from '../sim/time';
import type { GameBridge, PanelId } from './bridge';
import { effectiveSpeed, GameClock, type Speed } from './clock';

export interface Toast {
  id: number;
  text: string;
  kind: 'info' | 'success' | 'warning' | 'danger';
}

export const GAME_VERSION = '0.2.0';
const AUTOSAVE_SLOT = 'Autosave';
const AUTOSAVE_EVERY_DAYS = 7;
const LOOP_MS = 50;

/**
 * Verbindet Simulation, 3D-Welt und Angular (CLAUDE.md §5.1). Hält den Spielzustand,
 * treibt die Uhr an und stellt alles als Signals bereit. Der Zustand selbst wird von der
 * Simulation verändert; `state` meldet nach jedem Schritt eine Änderung.
 */
@Injectable({ providedIn: 'root' })
export class GameService implements GameBridge {
  /** Gleichheit aus: Derselbe (veränderte) Zustand soll trotzdem neu auswerten. */
  private readonly stateSignal = signal<GameState | null>(null, { equal: () => false });
  readonly state = this.stateSignal.asReadonly();
  readonly running = computed(() => this.state() !== null);

  readonly speed = signal<Speed>(1);
  readonly panel = signal<PanelId | null>(null);
  readonly toasts = signal<Toast[]>([]);
  readonly saveSlots = signal<SaveFile['meta'][]>([]);

  private readonly storage = typeof indexedDB !== 'undefined' ? new IndexedDbSaveStorage() : null;
  private readonly clock = new GameClock();
  private readonly listeners = new Set<(events: SimEvent[]) => void>();
  private loop: ReturnType<typeof setInterval> | null = null;
  private lastFrame = 0;
  private lastAutosaveDay = 0;
  private toastId = 0;

  constructor() {
    void this.refreshSlots();
    // Nur im Entwicklungsmodus: Zugriff für Browser-Tests und Konsole (window.fiera).
    if (isDevMode()) (globalThis as unknown as Record<string, unknown>)['fiera'] = this;
  }

  // --- GameBridge -----------------------------------------------------------

  getState(): GameState {
    const state = this.stateSignal();
    if (!state) throw new Error('Kein Spiel geladen');
    return state;
  }

  send(command: Command): CommandResult {
    const state = this.getState();
    const { result, events } = applyCommand(state, command);
    if (result.ok) {
      if (result.message) this.notify(result.message, 'success');
      this.publish(events);
    } else {
      this.notify(result.reason, 'warning');
    }
    this.stateSignal.set(state);
    return result;
  }

  onEvents(listener: (events: SimEvent[]) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  openPanel(panel: PanelId): void {
    this.panel.set(panel);
  }

  closePanel(): void {
    this.panel.set(null);
  }

  isPanelOpen(): boolean {
    return this.panel() !== null;
  }

  notify(text: string, kind: Toast['kind'] = 'info'): void {
    const toast: Toast = { id: ++this.toastId, text, kind };
    this.toasts.update((list) => [...list.slice(-4), toast]);
    setTimeout(() => this.toasts.update((list) => list.filter((t) => t.id !== toast.id)), 4500);
  }

  // --- Spiel starten / laden / speichern -------------------------------------

  newGame(characterId: CharacterId, playerName: string): void {
    // Der Seed kommt von außen – die Simulation selbst kennt keine Systemzeit.
    const seed = Math.floor(Math.random() * 2 ** 31);
    this.start(createNewGame({ seed, characterId, playerName }));
  }

  async loadGame(slotName: string): Promise<void> {
    if (!this.storage) return;
    const json = await this.storage.load(slotName);
    if (!json) {
      this.notify('Spielstand nicht gefunden.', 'danger');
      return;
    }
    try {
      this.start(loadSave(json).state);
      this.notify(`Spielstand "${slotName}" geladen.`, 'success');
    } catch (error) {
      this.notify(`Laden fehlgeschlagen: ${(error as Error).message}`, 'danger');
    }
  }

  async saveGame(slotName: string): Promise<void> {
    const state = this.stateSignal();
    if (!state || !this.storage) return;
    const save = createSaveFile(state, slotName, GAME_VERSION, new Date().toISOString());
    await this.storage.save(slotName, serializeSave(save));
    await this.refreshSlots();
    if (slotName !== AUTOSAVE_SLOT) this.notify(`Gespeichert: ${slotName}`, 'success');
  }

  async deleteSave(slotName: string): Promise<void> {
    await this.storage?.remove(slotName);
    await this.refreshSlots();
  }

  quitToTitle(): void {
    this.stopLoop();
    this.panel.set(null);
    this.stateSignal.set(null);
  }

  private async refreshSlots(): Promise<void> {
    if (!this.storage) return;
    try {
      this.saveSlots.set(await this.storage.list());
    } catch {
      this.saveSlots.set([]);
    }
  }

  private start(state: GameState): void {
    this.stopLoop();
    this.stateSignal.set(state);
    this.lastAutosaveDay = Math.floor(state.tick / HOURS_PER_DAY);
    this.panel.set(null);
    this.speed.set(1);
    this.lastFrame = performance.now();
    this.loop = setInterval(() => this.frame(), LOOP_MS);
  }

  private stopLoop(): void {
    if (this.loop) clearInterval(this.loop);
    this.loop = null;
  }

  // --- Uhr --------------------------------------------------------------------

  /** Aktuelle wirksame Geschwindigkeit (Beschäftigung/Reisen spulen vor). */
  readonly effectiveSpeed = computed(() => {
    const state = this.state();
    if (!state) return 0 as Speed;
    const busy = state.player.busyUntilTick > state.tick;
    const traveling = state.player.location.kind === 'travel';
    return effectiveSpeed(this.speed(), busy, traveling);
  });

  private frame(): void {
    const state = this.stateSignal();
    if (!state) return;
    const now = performance.now();
    const elapsed = now - this.lastFrame;
    this.lastFrame = now;
    const busy = state.player.busyUntilTick > state.tick;
    const traveling = state.player.location.kind === 'travel';
    const hours = this.clock.advance(elapsed, effectiveSpeed(this.speed(), busy, traveling));
    if (hours <= 0) return;
    const events = tick(state, hours);
    this.publish(events);
    this.stateSignal.set(state);
    const day = Math.floor(state.tick / HOURS_PER_DAY);
    if (day - this.lastAutosaveDay >= AUTOSAVE_EVERY_DAYS) {
      this.lastAutosaveDay = day;
      void this.saveGame(AUTOSAVE_SLOT);
    }
  }

  /** Nur Meldungen aus Städten, in denen die Figur ist oder Besitz hat, poppen auf. */
  private concernsPlayer(state: GameState, cityId: CityId | null): boolean {
    if (cityId === null) return true;
    const loc = state.player.location;
    if (loc.kind === 'city' && loc.cityId === cityId) return true;
    return state.player.kontors[cityId] !== undefined || cityId === state.player.homeCityId;
  }

  private publish(events: SimEvent[]): void {
    if (events.length === 0) return;
    const state = this.stateSignal();
    for (const event of events) {
      if (
        event.type === 'MessagePosted' &&
        event.kind !== 'info' &&
        state &&
        this.concernsPlayer(state, event.cityId)
      ) {
        this.notify(event.title, event.kind);
      }
      if (event.type === 'RankChanged') this.notify('Gesellschaftlicher Aufstieg!', 'success');
    }
    for (const listener of this.listeners) listener(events);
  }
}
