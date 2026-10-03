import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { GameService } from '../../bridge/game.service';
import { TAVERN } from '../../sim/data/balance';
import { CITIES } from '../../sim/data/cities';
import { GOODS } from '../../sim/data/goods';
import { CAPTAIN_HIRE_FEE } from '../../sim/data/ships';
import { shipView } from '../../sim/selectors';
import type { TavernQuest } from '../../sim/state/gameState';
import type { ShipId } from '../../sim/state/ids';
import { shipInPort } from '../../sim/systems/storage';
import { FORMAT_PIPES } from '../shared/format';
import { SmuggleSection } from './smuggle-section';
import { PanelFrame } from '../shared/panel-frame';
import { storageOptions, resolveOption } from '../shared/storage-picker';
import { useCity } from '../shared/use-city';

/** Taverne (Kneipe, Tippsammlung 2.1.1.1). */
@Component({
  selector: 'app-tavern-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PanelFrame, SmuggleSection, ...FORMAT_PIPES],
  template: `
    <app-panel-frame title="Taverne" subtitle="Arbeit, Matrosen, Kapitäne und allerlei Gestalten">
      @if (tavern(); as t) {
        <h3>Tagelöhnerarbeit</h3>
        @for (job of t.dayJobs; track job.id) {
          <div class="row-item">
            <span>{{ job.title }}</span
            ><span class="muted">8 Stunden</span><strong>{{ job.wage | gold }}</strong>
            <button type="button" (click)="game.send({ type: 'WorkDayJob', jobId: job.id })">Annehmen</button>
          </div>
        } @empty {
          <p class="muted">Heute sucht niemand Hilfe. Morgen vielleicht.</p>
        }

        <h3>Nebenraum – Aufträge</h3>
        @for (q of t.quests; track q.id) {
          <div class="row-item">
            <span>{{ describe(q) }}</span
            ><span class="muted">{{ q.days }} Tage Zeit</span>
            <button type="button" (click)="game.send({ type: 'AcceptQuest', questId: q.id })">
              Annehmen
            </button>
          </div>
        } @empty {
          <p class="muted">Der Nebenraum ist leer.</p>
        }

        @if (myQuests().length > 0) {
          <h3>Eure Aufträge</h3>
          @for (q of myQuests(); track q.id) {
            <div class="row-item">
              <span>{{ describe(q) }}</span>
              @if (q.quest.kind === 'buyer' && q.cityId === cityId()) {
                <button type="button" (click)="deliver(q)">Liefern</button>
              }
            </div>
          }
        }

        @if (t.peddler; as p) {
          <h3>Fliegender Händler</h3>
          <div class="row-item">
            <span>{{ p.amount }} {{ goodName(p.good) }} zu je {{ p.pricePerUnit | gold }}</span>
            <button type="button" (click)="game.send({ type: 'BuyFromPeddler' })">
              Kaufen ({{ p.amount * p.pricePerUnit | gold }})
            </button>
          </div>
        }

        <h3>Informant</h3>
        <div class="row-item">
          <span>Wo fehlt was, wo gibt es Überfluss?</span>
          <button type="button" (click)="game.send({ type: 'BuyInformation' })">
            Fragen ({{ informantFee | gold }})
          </button>
        </div>

        <h3>Matrosen und Kapitäne</h3>
        <p class="muted">
          Am Tresen: ca. {{ sailors() }} arbeitswillige Matrosen.
          {{ t.captainAvailable ? 'Ein Kapitän sucht Arbeit!' : 'Kein Kapitän da.' }}
        </p>
        @for (s of ships(); track s.id) {
          <div class="row-item">
            <span
              ><strong>{{ s.name }}</strong> ({{ s.typeName }}) – Besatzung {{ s.crew }}/{{ s.maxCrew }},
              mind. {{ s.minCrew }}{{ s.hasCaptain ? ', mit Kapitän' : '' }}</span
            >
            <input
              class="qty"
              type="number"
              min="1"
              [value]="crewAmount()"
              (input)="crewAmount.set($any($event.target).valueAsNumber || 1)"
            />
            <button
              type="button"
              (click)="game.send({ type: 'HireSailors', shipId: s.id, count: crewAmount() })"
            >
              Anheuern
            </button>
            <button
              type="button"
              (click)="game.send({ type: 'DismissSailors', shipId: s.id, count: crewAmount() })"
            >
              Entlassen
            </button>
            @if (t.captainAvailable && !s.hasCaptain) {
              <button type="button" (click)="game.send({ type: 'HireCaptain', shipId: s.id })">
                Kapitän ({{ captainFee | gold }})
              </button>
            }
          </div>
        } @empty {
          <p class="muted">Keines Eurer Schiffe liegt hier im Hafen.</p>
        }
      }
      @if (cityId(); as c) {
        <app-smuggle-section [cityId]="c" />
      }
    </app-panel-frame>
  `,
})
export class TavernPanel {
  protected readonly game = inject(GameService);
  protected readonly cityId = useCity(this.game).cityId;
  protected readonly informantFee = TAVERN.informantFee;
  protected readonly captainFee = CAPTAIN_HIRE_FEE;
  protected readonly crewAmount = signal(5);
  protected readonly tavern = computed(() => {
    const state = this.game.state();
    const id = this.cityId();
    return state && id ? state.cities[id].tavern : null;
  });
  protected readonly sailors = computed(() => {
    const state = this.game.state();
    const id = this.cityId();
    return state && id ? Math.floor(state.cities[id].population.beggars * TAVERN.sailorShareOfBeggars) : 0;
  });
  protected readonly myQuests = computed(() => this.game.state()?.player.quests ?? []);
  protected readonly ships = computed(() => {
    const state = this.game.state();
    const id = this.cityId();
    if (!state || !id) return [];
    return Object.values(state.ships)
      .filter((s) => shipInPort(s) === id)
      .map((s) => shipView(state, s.id as ShipId));
  });

  protected goodName(good: keyof typeof GOODS): string {
    return GOODS[good].name;
  }

  protected describe(q: TavernQuest): string {
    if (q.quest.kind === 'passenger') {
      return `Ein Reisender muss nach ${CITIES[q.quest.destination].name} – zahlt ${q.quest.reward} GS.`;
    }
    return `Ein Händler in ${CITIES[q.cityId].name} sucht ${q.quest.amount} ${GOODS[q.quest.good].name} – zahlt ${q.quest.reward} GS.`;
  }

  protected deliver(q: TavernQuest): void {
    const id = this.cityId();
    if (!id) return;
    const options = storageOptions(this.game, id);
    const kontor = options.find((o) => o.key === 'kontor');
    this.game.send({
      type: 'DeliverQuestGoods',
      questId: q.id,
      from: kontor?.ref ?? resolveOption(options, 'inventory'),
    });
  }
}
