import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { GameService } from '../../bridge/game.service';
import type { FactionId } from '../../sim/data/factions';
import { factionsView } from '../../sim/selectors';

/** Bündnisse und Verruf (im Ansehen-Fenster). */
@Component({
  selector: 'app-factions-section',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (view(); as v) {
      <h3>Bündnisse</h3>
      <p class="muted">
        Nur ein Bündnis zur Zeit. Wer sich verbündet, verärgert die Rivalen.
        @if (v.cooldownDays > 0) {
          Ein Wechsel ist erst in {{ v.cooldownDays }} Tagen möglich.
        }
      </p>
      @for (f of v.rows; track f.id) {
        <div class="faction" [class.pledged]="f.pledged">
          <div class="faction-head">
            <strong>{{ f.name }}</strong>
            <span class="tag" [class.red]="f.favor < -10">{{ f.standing }}</span>
            <meter min="-100" max="100" low="-10" high="25" optimum="100" [value]="f.favor"></meter>
          </div>
          <div class="muted small">{{ f.description }}</div>
          <div class="small">
            Bündnis: {{ f.pledgeBenefit }} <span class="muted">Rivale: {{ f.rivalName }}</span>
          </div>
          @if (f.pledged) {
            <button type="button" [disabled]="v.cooldownDays > 0" (click)="pledge(null)">
              Bündnis lösen
            </button>
          } @else {
            <button type="button" [disabled]="!f.canPledge" (click)="pledge(f.id)">Verbünden</button>
          }
        </div>
      }
      <h3>Leumund</h3>
      <p>
        Ihr geltet als <strong>{{ v.notorietyText }}</strong>
        <meter min="0" max="100" low="10" high="30" optimum="0" [value]="v.notoriety"></meter>
      </p>
      <p class="muted small">
        Bestechung und Schmuggel bringen Verruf. Wer verrufen ist, gerät in Ermittlungen der Stadtwache und
        verliert Stimmen bei Wahlen. Verruf klingt mit der Zeit ab.
      </p>
    }
  `,
})
export class FactionsSection {
  private readonly game = inject(GameService);
  protected readonly view = computed(() => {
    const s = this.game.state();
    return s ? factionsView(s) : null;
  });

  protected pledge(faction: FactionId | null): void {
    this.game.send({ type: 'PledgeFaction', faction });
  }
}
