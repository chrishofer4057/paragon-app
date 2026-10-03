import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import type { PanelId } from '../bridge/bridge';
import type { Speed } from '../bridge/clock';
import { GameService } from '../bridge/game.service';
import { clockView, playerView } from '../sim/selectors';
import { FORMAT_PIPES } from './shared/format';

/** Kopfleiste: Zeit, Geld, Rang, Ort, Geschwindigkeit, Menü. */
@Component({
  selector: 'app-hud',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [...FORMAT_PIPES],
  template: `
    @if (view(); as v) {
      <header class="hud">
        <div class="hud-block clock" [class.winter]="clock()!.winter">
          <span class="icon">{{ clock()!.daylight > 0.3 ? '☀' : '☾' }}</span> {{ clock()!.text }}
        </div>
        <div class="hud-block speed" role="group" aria-label="Geschwindigkeit">
          @for (s of speeds; track s.value) {
            <button
              type="button"
              [class.active]="game.speed() === s.value"
              [title]="s.title"
              (click)="game.speed.set(s.value)"
            >
              {{ s.label }}
            </button>
          }
          @if (game.effectiveSpeed() !== game.speed()) {
            <span class="muted small">vorgespult</span>
          }
        </div>
        <div class="hud-block money" title="Bargeld (Unternehmenswert in Klammern)">
          💰 {{ v.money | gold }} <span class="muted">({{ v.netWorth | gold }})</span>
        </div>
        <div class="hud-block rank" title="Rang und Fiera-Stufe">
          {{ v.rankName }} <span class="muted">· Stufe {{ v.stage }} {{ v.stageName }}</span>
        </div>
        <div class="hud-block where">
          📍 {{ v.locationText }}
          @if (v.traveling) {
            <progress [value]="v.travelProgress" max="1"></progress>
          }
          @if (v.busyHours > 0) {
            <span class="muted"> · beschäftigt ({{ v.busyHours }} Std.)</span>
          }
        </div>
        <nav class="hud-menu">
          @for (m of menu; track m.panel) {
            <button type="button" [title]="m.title + ' [' + m.key + ']'" (click)="open(m.panel)">
              {{ m.label }}
            </button>
          }
        </nav>
      </header>
      <aside class="inventory" title="Rucksack">
        <strong>Rucksack {{ v.inventoryUsed | qty }}/{{ v.inventoryCapacity }}</strong>
        @for (i of v.inventory; track i.good) {
          <span>{{ i.name }} {{ i.amount | qty }}</span>
        } @empty {
          <span class="muted">leer</span>
        }
      </aside>
    }
  `,
})
export class Hud {
  protected readonly game = inject(GameService);
  protected readonly view = computed(() => (this.game.state() ? playerView(this.game.state()!) : null));
  protected readonly clock = computed(() => (this.game.state() ? clockView(this.game.state()!) : null));
  protected readonly speeds: { value: Speed; label: string; title: string }[] = [
    { value: 0, label: '⏸', title: 'Pause [Leertaste mit Shift]' },
    { value: 1, label: '▶', title: 'Normal (1 Tag ≈ 1 Minute)' },
    { value: 2, label: '⏩', title: 'Schnell' },
    { value: 3, label: '⏭', title: 'Sehr schnell' },
  ];
  protected readonly menu: { panel: PanelId; label: string; title: string; key: string }[] = [
    { panel: 'travel', label: '🗺 Reisen', title: 'Weltkarte und Reisen', key: 'K' },
    { panel: 'possessions', label: '🏠 Besitz', title: 'Kontore, Betriebe, Schiffe', key: 'B' },
    { panel: 'reputation', label: '⭐ Ansehen', title: 'Ansehen und Aufstieg', key: 'R' },
    { panel: 'messages', label: '📜 Schreiben', title: 'Amtliche Schreiben', key: 'N' },
    { panel: 'save', label: '💾', title: 'Speichern / Laden', key: 'P' },
  ];

  protected open(panel: PanelId): void {
    if (this.game.panel() === panel) this.game.closePanel();
    else this.game.openPanel(panel);
  }
}
