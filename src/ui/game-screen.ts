import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  afterNextRender,
  isDevMode,
  inject,
  viewChild,
  type OnDestroy,
} from '@angular/core';
import type { PanelId } from '../bridge/bridge';
import { GameService } from '../bridge/game.service';
import { createWorld3D, type WorldHandle } from '../game/three/createWorld';
import { Hud } from './hud';
import { PanelHost } from './panels/panel-host';

const HOTKEYS: Record<string, PanelId> = {
  k: 'travel',
  b: 'possessions',
  r: 'reputation',
  n: 'messages',
  p: 'save',
};

/** Spielansicht: 3D-Welt (Three.js), darüber HUD, Fenster und Meldungen. */
@Component({
  selector: 'app-game-screen',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Hud, PanelHost],
  template: `
    <div class="stage" #stage></div>
    <app-hud />
    <app-panel-host />
    <div class="toasts" aria-live="polite">
      @for (t of game.toasts(); track t.id) {
        <div class="toast" [attr.data-kind]="t.kind">{{ t.text }}</div>
      }
    </div>
  `,
})
export class GameScreen implements OnDestroy {
  protected readonly game = inject(GameService);
  private readonly stage = viewChild.required<ElementRef<HTMLDivElement>>('stage');
  private world: WorldHandle | null = null;

  constructor() {
    afterNextRender(() => {
      this.world = createWorld3D(this.stage().nativeElement, this.game);
      if (isDevMode()) (globalThis as unknown as Record<string, unknown>)['fieraWorld'] = this.world;
    });
  }

  @HostListener('window:keydown', ['$event'])
  protected onKey(event: KeyboardEvent): void {
    const target = event.target as HTMLElement | null;
    if (target && ['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName)) {
      if (event.key === 'Escape') target.blur();
      return;
    }
    if (event.key === 'Escape') {
      this.game.closePanel();
      return;
    }
    const panel = HOTKEYS[event.key.toLowerCase()];
    if (panel) {
      if (this.game.panel() === panel) this.game.closePanel();
      else this.game.openPanel(panel);
    }
  }

  ngOnDestroy(): void {
    this.world?.destroy();
    this.world = null;
  }
}
