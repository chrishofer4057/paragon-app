import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { GameService } from '../../bridge/game.service';
import { KONTOR, WAREHOUSE } from '../../sim/data/buildings';
import { GOODS, type GoodAmounts, type GoodId } from '../../sim/data/goods';
import { amountRows, businessOptions, canDo, houseOptions, possessionsView } from '../../sim/selectors';
import { FORMAT_PIPES } from '../shared/format';
import { PanelFrame } from '../shared/panel-frame';
import { useCity } from '../shared/use-city';

type Tab = 'businesses' | 'houses' | 'public' | 'kontor';

/**
 * Bauhof: alle Bauaufträge an einem Ort – Kontor, Lagerhaus, Betriebe, Wohnhäuser,
 * gestiftete Infrastruktur. Material kommt aus Kontor/Schiffen, der Rest vom Markt.
 */
@Component({
  selector: 'app-construction-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PanelFrame, ...FORMAT_PIPES],
  template: `
    <app-panel-frame
      title="Bauhof"
      subtitle="Bauaufträge binden einen Bautrupp der Stadt. Fehlendes Material wird auf dem Markt gekauft."
    >
      <nav class="tabs">
        <button type="button" [class.active]="tab() === 'kontor'" (click)="tab.set('kontor')">
          Kontor & Lager
        </button>
        <button type="button" [class.active]="tab() === 'businesses'" (click)="tab.set('businesses')">
          Betriebe
        </button>
        <button type="button" [class.active]="tab() === 'houses'" (click)="tab.set('houses')">
          Wohnhäuser
        </button>
        <button type="button" [class.active]="tab() === 'public'" (click)="tab.set('public')">
          Infrastruktur stiften
        </button>
      </nav>
      @if (city(); as c) {
        @switch (tab()) {
          @case ('kontor') {
            <div class="card">
              <h3>{{ kontor.name }}</h3>
              <p class="muted">
                Lager für {{ kontor.capacity }} Einheiten, Grundsteuer
                {{ kontor.landTaxPerWeek | gold }}/Woche. Voraussetzung für Betriebe, Verwalter und Feste.
              </p>
              <p>{{ kontor.cost | gold }} + {{ mats(kontor.materials) }} · {{ kontor.buildDays }} Tage</p>
              <button type="button" (click)="game.send({ type: 'FoundKontor' })">Kontor bauen</button>
            </div>
            <div class="card">
              <h3>{{ warehouse.name }}</h3>
              <p class="muted">
                +{{ warehouse.capacity }} Lagerplatz, Grundsteuer {{ warehouse.landTaxPerWeek | gold }}/Woche,
                erhöht das Einbruchsrisiko.
              </p>
              <p>
                {{ warehouse.cost | gold }} + {{ mats(warehouse.materials) }} · {{ warehouse.buildDays }} Tage
              </p>
              <button type="button" (click)="game.send({ type: 'BuildWarehouse' })">Lagerhaus bauen</button>
            </div>
          }
          @case ('businesses') {
            @if (!canBuild()) {
              <p class="warn">Betriebe dürft Ihr erst als Kaufmann errichten.</p>
            }
            <table class="table">
              <tr>
                <th>Betrieb</th>
                <th>Erzeugt/Woche</th>
                <th>Braucht/Woche</th>
                <th class="num">Löhne/Wo.</th>
                <th class="num">Kosten</th>
                <th class="num">Tage</th>
                <th></th>
              </tr>
              @for (b of businesses(); track b.type) {
                <tr [class.disabled]="!b.allowed">
                  <td>
                    {{ b.name }}
                    @if (b.owned > 0) {
                      <span class="tag">{{ b.owned }}×</span>
                    }
                    @if (!b.allowed) {
                      <span class="tag red">nicht möglich</span>
                    } @else if (!b.effective) {
                      <span class="tag orange" title="halber Ausstoß bei gleichen Kosten">ineffektiv</span>
                    }
                  </td>
                  <td>{{ list(b.outputs) }}</td>
                  <td class="muted">{{ list(b.inputs) || '–' }}</td>
                  <td class="num">{{ b.wagesPerWeek + 280 | gold }}</td>
                  <td class="num" [title]="'Material: ' + list(b.materials)">{{ b.cost | gold }}</td>
                  <td class="num">{{ b.buildDays }}</td>
                  <td>
                    <button
                      type="button"
                      [disabled]="!b.allowed || !canBuild()"
                      (click)="game.send({ type: 'BuildBusiness', businessType: b.type })"
                    >
                      Bauen
                    </button>
                  </td>
                </tr>
              }
            </table>
          }
          @case ('houses') {
            @for (h of houses; track h.type) {
              <div class="card">
                <h3>{{ h.name }}</h3>
                <p class="muted">
                  Für {{ h.capacity }} {{ h.tenantClass }}. Bringt Miete und Platz für Zuzug.
                </p>
                <p>{{ h.cost | gold }} + {{ list(h.materials) }} · {{ h.buildDays }} Tage</p>
                <button type="button" (click)="game.send({ type: 'BuildHouse', houseType: h.type })">
                  Bauen
                </button>
              </div>
            }
          }
          @case ('public') {
            <p class="muted">Gestiftete Bauten gehören der Stadt – und bringen Euch dauerhaftes Ansehen.</p>
            <table class="table">
              <tr>
                <th>Bauwerk</th>
                <th class="num">Bestand</th>
                <th class="num">Bedarf</th>
                <th class="num">Kosten</th>
                <th>Material</th>
                <th></th>
              </tr>
              @for (i of c.infrastructure; track i.id) {
                <tr>
                  <td>{{ i.name }}</td>
                  <td class="num">{{ i.count }}{{ i.pending ? ' (+' + i.pending + ')' : '' }}</td>
                  <td class="num">{{ i.needed ?? '–' }}</td>
                  <td class="num">{{ i.cost | gold }}</td>
                  <td class="muted">{{ list(i.materials) }}</td>
                  <td>
                    <button
                      type="button"
                      (click)="game.send({ type: 'FundInfrastructure', infrastructure: i.id })"
                    >
                      Stiften
                    </button>
                  </td>
                </tr>
              }
            </table>
          }
        }
        <h3>Laufende Bauaufträge</h3>
        @for (j of constructions(); track $index) {
          <div class="row-item">
            <span>{{ j.name }} in {{ j.cityName }}</span
            ><span class="muted">{{ j.status }}</span> <progress [value]="j.progress" max="1"></progress>
          </div>
        } @empty {
          <p class="muted">Keine.</p>
        }
      }
    </app-panel-frame>
  `,
})
export class ConstructionPanel {
  protected readonly game = inject(GameService);
  private readonly ref = useCity(this.game);
  protected readonly city = this.ref.city;
  protected readonly tab = signal<Tab>('kontor');
  protected readonly kontor = KONTOR;
  protected readonly warehouse = WAREHOUSE;
  protected readonly houses = houseOptions();
  protected readonly canBuild = computed(
    () => !!this.game.state() && canDo(this.game.state()!, 'buildBusinesses'),
  );
  protected readonly businesses = computed(() => {
    const s = this.game.state();
    const id = this.ref.cityId();
    return s && id ? businessOptions(s, id) : [];
  });
  protected readonly constructions = computed(() => possessionsView(this.game.state()!).constructions);

  protected list(rows: { name: string; amount: number }[]): string {
    return rows.map((r) => `${+r.amount.toFixed(2)} ${r.name}`).join(', ');
  }

  protected mats(materials: GoodAmounts): string {
    return this.list(amountRows(materials));
  }

  protected goodName(g: GoodId): string {
    return GOODS[g].name;
  }
}
