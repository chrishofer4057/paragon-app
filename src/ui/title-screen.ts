import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { GameService } from '../bridge/game.service';
import { CHARACTER_IDS, CHARACTERS, type CharacterId } from '../sim/data/characters';
import { FORMAT_PIPES } from './shared/format';

/** Titel: neues Spiel mit Figurenwahl (CLAUDE.md §2.1) oder Spielstand laden. */
@Component({
  selector: 'app-title-screen',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [...FORMAT_PIPES],
  template: `
    <main class="title">
      <h1>Fiera</h1>
      <p class="tagline">Vom Tagelöhner zum Landammann der Lia</p>
      <section class="characters">
        @for (c of characters; track c.id) {
          <button
            type="button"
            class="character"
            [class.selected]="selected() === c.id"
            (click)="select(c.id)"
          >
            <strong>{{ c.name }}</strong>
            <em>{{ c.title }}</em>
            <span>{{ c.description }}</span>
            <span class="muted">Startkapital {{ c.startMoney | gold }}</span>
          </button>
        }
      </section>
      <div class="start">
        <label
          >Name
          <input type="text" [value]="name()" (input)="name.set($any($event.target).value)" maxlength="30"
        /></label>
        <button type="button" class="primary" (click)="game.newGame(selected(), name())">Neues Spiel</button>
      </div>
      @if (game.saveSlots().length > 0) {
        <section class="loads">
          <h2>Spielstand laden</h2>
          @for (s of game.saveSlots(); track s.slotName) {
            <button type="button" (click)="game.loadGame(s.slotName)">
              {{ s.slotName }} – Tag {{ s.gameDay }}, {{ s.money | gold }}
            </button>
          }
        </section>
      }
      <p class="controls muted">
        Steuerung: Linksklick laufen/betreten/sammeln (gedrückt halten folgt der Maus) · Rechte Maustaste
        ziehen dreht · Mausrad zoomt · Esc schließt Fenster · K Reisen · B Besitz · R Ansehen · N Schreiben
      </p>
      <p class="legal muted">Alle Grafiken sind Platzhalter.</p>
    </main>
  `,
})
export class TitleScreen {
  protected readonly game = inject(GameService);
  protected readonly characters = CHARACTER_IDS.map((id) => CHARACTERS[id]);
  protected readonly selected = signal<CharacterId>('gian');
  protected readonly name = signal(CHARACTERS.gian.name);

  protected select(id: CharacterId): void {
    this.selected.set(id);
    this.name.set(CHARACTERS[id].name);
  }
}
