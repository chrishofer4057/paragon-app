import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { GameService } from '../../bridge/game.service';
import { CITIES } from '../../sim/data/cities';
import { playerView, possessionsView, rankProgress, reputationTable, skillViews } from '../../sim/selectors';
import type { BusinessId } from '../../sim/state/ids';
import { formatDate } from '../../sim/time';
import { FORMAT_PIPES } from '../shared/format';
import { FactionsSection } from './factions-section';
import { PanelFrame } from '../shared/panel-frame';

/** Ansehen, Ränge und Fertigkeiten (Tippsammlung Kap. 6). */
@Component({
  selector: 'app-reputation-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PanelFrame, FactionsSection, ...FORMAT_PIPES],
  template: `
    @if (progress(); as p) {
      <app-panel-frame
        title="Ansehen & Aufstieg"
        [subtitle]="'Heimatstadt ' + p.home + ' · geprüft wird am Monatsersten'"
      >
        <div class="cols">
          <div>
            <h3>Aufstiegsleiter</h3>
            <table class="table ranks">
              <tr>
                <th>Rang</th>
                <th class="num">Vermögen</th>
                <th class="num">sozial</th>
                <th class="num">gesellsch.</th>
              </tr>
              @for (r of p.steps; track r.id) {
                <tr [class.reached]="r.reached" [class.current]="r.current">
                  <td>
                    {{ r.name }} <span class="muted">({{ r.stage }} · {{ r.stageName }})</span>
                    @if (r.requiresGuild) {
                      <span class="tag" [class.red]="!r.guildOk">Gilde</span>
                    }
                  </td>
                  <td class="num" [class.ok]="r.netWorthOk">{{ r.netWorth | gold }}</td>
                  <td class="num" [class.ok]="r.socialOk">{{ r.social | rep }}</td>
                  <td class="num" [class.ok]="r.societalOk">{{ r.societal | rep }}</td>
                </tr>
              }
            </table>
            <p>
              Euer Stand: Vermögen {{ p.netWorth | gold }} · sozial {{ p.reputation.social | rep }} ·
              gesellschaftlich {{ p.reputation.societal | rep }}
            </p>
            <p class="muted">
              Lia-weites Ansehen: {{ p.hanse | rep }}{{ p.isMayor ? ' · Ihr seid Schultheiss' : ''
              }}{{ p.isLandammann ? ' · Ihr seid Landammann!' : '' }}
            </p>
            <h3>Fertigkeiten</h3>
            @for (s of skills(); track s.id) {
              <div class="skill">
                <span>{{ s.name }}</span
                ><span>Stufe {{ s.level }}</span
                ><progress [value]="s.progress" max="1"></progress>
              </div>
            }
            <app-factions-section />
          </div>
          <div>
            <h3>Was die Bürger von Euch halten</h3>
            <table class="table">
              <tr>
                <th>Stadt</th>
                <th>Arme</th>
                <th>Reiche</th>
                <th>lokaler Rang</th>
              </tr>
              @for (row of table(); track row.cityId) {
                <tr>
                  <td>{{ row.name }}</td>
                  <td [title]="row.social | rep">{{ row.socialOpinion }}</td>
                  <td [title]="row.societal | rep">{{ row.societalOpinion }}</td>
                  <td class="muted">{{ row.localRank }}</td>
                </tr>
              }
            </table>
          </div>
        </div>
      </app-panel-frame>
    }
  `,
})
export class ReputationPanel {
  private readonly game = inject(GameService);
  protected readonly progress = computed(() => (this.game.state() ? rankProgress(this.game.state()!) : null));
  protected readonly table = computed(() => (this.game.state() ? reputationTable(this.game.state()!) : []));
  protected readonly skills = computed(() => (this.game.state() ? skillViews(this.game.state()!) : []));
}

/** Alles, was dem Spieler gehört – überall in der Lia. */
@Component({
  selector: 'app-possessions-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PanelFrame, ...FORMAT_PIPES],
  template: `
    @if (view(); as v) {
      <app-panel-frame
        title="Besitz"
        [subtitle]="
          'Laufende Kosten ca. ' + (dailyCosts() | gold) + ' pro Tag zzgl. Löhne und Steuern pro Woche'
        "
      >
        <h3>Kontore</h3>
        @for (k of v.kontors; track k.cityId) {
          <div class="row-item">
            <span
              ><strong>{{ k.cityName }}</strong
              >: {{ k.used | qty }}/{{ k.capacity }} belegt, {{ k.warehouses }} Lagerhäuser,
              {{ k.guards }} Wachen{{ k.manager ? ', Verwalter' : '' }}</span
            >
          </div>
        } @empty {
          <p class="muted">Noch kein Kontor.</p>
        }
        <h3>Betriebe</h3>
        @for (b of v.businesses; track b.id) {
          <div class="row-item">
            <span
              >{{ b.name }} in {{ b.cityName }}{{ b.effective ? '' : ' (ineffektiv)' }}: {{ b.workers }}/{{
                b.maxWorkers
              }}
              Arbeiter</span
            >
            <label
              >{{ b.utilization | pct }}
              <input
                type="range"
                min="0"
                max="100"
                step="10"
                [value]="b.utilization * 100"
                (change)="
                  game.send({
                    type: 'SetUtilization',
                    businessId: asBusiness(b.id),
                    utilization: $any($event.target).valueAsNumber / 100,
                  })
                "
              />
            </label>
          </div>
        } @empty {
          <p class="muted">Keine.</p>
        }
        <h3>Wohnhäuser</h3>
        @for (h of v.houses; track h.id) {
          <div class="row-item">
            <span>{{ h.name }} in {{ h.cityName }}: {{ h.tenants }}/{{ h.capacity }} Mieter</span>
          </div>
        } @empty {
          <p class="muted">Keine.</p>
        }
        <h3>Schiffe</h3>
        @for (s of v.ships; track s.id) {
          <div class="row-item">
            <span
              ><strong>{{ s.name }}</strong> ({{ s.typeName }}) {{ s.where }} – Zustand
              {{ s.condition | qty }} %, Besatzung {{ s.crew }}/{{ s.minCrew }}, Ladung
              {{ s.cargoUsed | qty }}/{{ s.capacity }}</span
            >
          </div>
        } @empty {
          <p class="muted">Keine.</p>
        }
        <h3>Bauaufträge</h3>
        @for (j of v.constructions; track $index) {
          <div class="row-item">
            <span>{{ j.name }} in {{ j.cityName }}</span
            ><span class="muted">{{ j.status }}</span
            ><progress [value]="j.progress" max="1"></progress>
          </div>
        } @empty {
          <p class="muted">Keine.</p>
        }
      </app-panel-frame>
    }
  `,
})
export class PossessionsPanel {
  protected readonly game = inject(GameService);
  protected readonly view = computed(() => (this.game.state() ? possessionsView(this.game.state()!) : null));
  protected readonly dailyCosts = computed(() => {
    const s = this.game.state();
    return s ? playerView(s).dailyCosts : 0;
  });

  protected asBusiness(id: string): BusinessId {
    return id as BusinessId;
  }
}

/** Amtliche Schreiben. */
@Component({
  selector: 'app-messages-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PanelFrame],
  template: `
    <app-panel-frame title="Amtliche Schreiben">
      @for (m of messages(); track m.id) {
        <article class="message" [attr.data-kind]="m.kind">
          <header>
            <strong>{{ m.title }}</strong
            ><span class="muted">{{ date(m.tick) }}{{ m.cityId ? ' · ' + cityName(m.cityId) : '' }}</span>
          </header>
          <p>{{ m.body }}</p>
        </article>
      } @empty {
        <p class="muted">Keine Nachrichten.</p>
      }
    </app-panel-frame>
  `,
})
export class MessagesPanel {
  private readonly game = inject(GameService);
  protected readonly messages = computed(() => this.game.state()?.messages ?? []);

  protected date(tick: number): string {
    return formatDate(tick);
  }

  protected cityName(id: keyof typeof CITIES): string {
    return CITIES[id].name;
  }
}

/** Speichern, Laden, zum Titel. */
@Component({
  selector: 'app-save-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PanelFrame, ...FORMAT_PIPES],
  template: `
    <app-panel-frame title="Spielstand" subtitle="Alle sieben Spieltage wird automatisch gespeichert">
      <div class="row-item">
        <input type="text" [value]="slot()" (input)="slot.set($any($event.target).value)" maxlength="30" />
        <button type="button" (click)="game.saveGame(slot())">Speichern</button>
      </div>
      <h3>Spielstände</h3>
      @for (s of game.saveSlots(); track s.slotName) {
        <div class="row-item">
          <span
            ><strong>{{ s.slotName }}</strong>
            <span class="muted">Tag {{ s.gameDay }} · {{ s.money | gold }}</span></span
          >
          <button type="button" (click)="game.loadGame(s.slotName)">Laden</button>
          <button type="button" (click)="game.saveGame(s.slotName)">Überschreiben</button>
          <button type="button" (click)="game.deleteSave(s.slotName)">Löschen</button>
        </div>
      } @empty {
        <p class="muted">Noch keine Spielstände.</p>
      }
      <h3>Spiel</h3>
      <button type="button" (click)="game.quitToTitle()">Zum Titelbildschirm</button>
    </app-panel-frame>
  `,
})
export class SavePanel {
  protected readonly game = inject(GameService);
  protected readonly slot = signal('Spielstand 1');
}
