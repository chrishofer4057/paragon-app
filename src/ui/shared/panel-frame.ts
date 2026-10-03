import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { GameService } from '../../bridge/game.service';

/** Rahmen für alle Fenster: Titel, Untertitel, Schließen-Knopf, Inhalt. */
@Component({
  selector: 'app-panel-frame',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="panel" role="dialog" [attr.aria-label]="title()">
      <header class="panel-head">
        <div>
          <h2>{{ title() }}</h2>
          @if (subtitle()) {
            <p class="subtitle">{{ subtitle() }}</p>
          }
        </div>
        <button class="close" type="button" (click)="game.closePanel()" title="Schließen (Esc)">✕</button>
      </header>
      <div class="panel-body"><ng-content /></div>
    </section>
  `,
})
export class PanelFrame {
  protected readonly game = inject(GameService);
  readonly title = input.required<string>();
  readonly subtitle = input('');
}
