import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { GameService } from '../../bridge/game.service';
import { MAX_GUARDS, RENT_LEVELS } from '../../sim/data/buildings';
import { GOOD_IDS, GOODS, type GoodId } from '../../sim/data/goods';
import { amountRows, canDo, possessionsView } from '../../sim/selectors';
import type { StandingOrder } from '../../sim/state/gameState';
import type { BusinessId, HouseId } from '../../sim/state/ids';
import { buyPrice, sellPrice } from '../../sim/systems/prices';
import { FORMAT_PIPES } from '../shared/format';
import { PanelFrame } from '../shared/panel-frame';
import { storageOptions } from '../shared/storage-picker';
import { useCity } from '../shared/use-city';

type Tab = 'storage' | 'manager' | 'property';

/** Eigenes Kontor (Tippsammlung 2.2.1): Lager, Wachen, Verwalter, Betriebe und Häuser der Stadt. */
@Component({
  selector: 'app-kontor-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PanelFrame, ...FORMAT_PIPES],
  template: `
    <app-panel-frame title="Euer Kontor" [subtitle]="subtitle()">
      <nav class="tabs">
        <button type="button" [class.active]="tab() === 'storage'" (click)="tab.set('storage')">Lager</button>
        <button type="button" [class.active]="tab() === 'manager'" (click)="tab.set('manager')">
          Verwalter
        </button>
        <button type="button" [class.active]="tab() === 'property'" (click)="tab.set('property')">
          Betriebe & Häuser
        </button>
      </nav>
      @if (kontor(); as k) {
        @switch (tab()) {
          @case ('storage') {
            <p class="muted">
              Über der Kapazität wird Lagerraum automatisch für 1 GS je Einheit und Tag gemietet.
            </p>
            <table class="table">
              <tr>
                <th>Ware</th>
                <th class="num">Menge</th>
                <th>Umladen</th>
              </tr>
              @for (row of storageRows(); track row.good) {
                <tr>
                  <td>{{ row.name }}</td>
                  <td class="num">{{ row.amount | qty }}</td>
                  <td class="actions">
                    <input
                      class="qty"
                      type="number"
                      min="1"
                      [value]="moveAmount()"
                      (input)="moveAmount.set($any($event.target).valueAsNumber || 1)"
                    />
                    @for (t of targets(); track t.key) {
                      <button type="button" (click)="move(row.good, t.key, true)">→ {{ t.label }}</button>
                      <button type="button" (click)="move(row.good, t.key, false)">← {{ t.label }}</button>
                    }
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="3" class="muted">Das Kontor ist leer.</td>
                </tr>
              }
            </table>
            <h3>Wachen</h3>
            <div class="row-item">
              <span
                >{{ k.guards }} Wachen (10 GS/Tag je Mann) – senken das Einbruchsrisiko bei
                Lagerhäusern.</span
              >
              <button
                type="button"
                [disabled]="k.guards <= 0"
                (click)="game.send({ type: 'SetGuards', cityId: k.cityId, count: k.guards - 1 })"
              >
                −
              </button>
              <button
                type="button"
                [disabled]="k.guards >= maxGuards"
                (click)="game.send({ type: 'SetGuards', cityId: k.cityId, count: k.guards + 1 })"
              >
                +
              </button>
            </div>
          }
          @case ('manager') {
            @if (!k.manager) {
              <p>
                Ein Verwalter handelt täglich nach Euren Daueraufträgen: kaufen bis zu einem Preis, verkaufen
                ab einem Preis, Reserve behalten.
              </p>
              <button type="button" [disabled]="!canHire()" (click)="game.send({ type: 'HireManager' })">
                Verwalter einstellen (500 GS)
              </button>
              @if (!canHire()) {
                <p class="muted">Erst als Fernkaufmann.</p>
              }
            } @else {
              <p class="muted">
                Lohn: {{ managerWage() | gold }}/Tag. Leere Felder = nicht kaufen/verkaufen.
              </p>
              <table class="table">
                <tr>
                  <th>Ware</th>
                  <th class="num">Markt K/V</th>
                  <th>Kaufen bis Preis</th>
                  <th>… bis Bestand</th>
                  <th>Verkaufen ab Preis</th>
                  <th>Reserve</th>
                  <th></th>
                </tr>
                @for (g of goods; track g) {
                  <tr>
                    <td>{{ goodName(g) }}</td>
                    <td class="num muted">{{ prices(g) }}</td>
                    <td>
                      <input
                        class="qty"
                        type="number"
                        min="0"
                        [value]="order(g).buyBelow ?? ''"
                        (change)="edit(g, 'buyBelow', $any($event.target).value)"
                      />
                    </td>
                    <td>
                      <input
                        class="qty"
                        type="number"
                        min="0"
                        [value]="order(g).buyUpTo"
                        (change)="edit(g, 'buyUpTo', $any($event.target).value)"
                      />
                    </td>
                    <td>
                      <input
                        class="qty"
                        type="number"
                        min="0"
                        [value]="order(g).sellAbove ?? ''"
                        (change)="edit(g, 'sellAbove', $any($event.target).value)"
                      />
                    </td>
                    <td>
                      <input
                        class="qty"
                        type="number"
                        min="0"
                        [value]="order(g).keepMin"
                        (change)="edit(g, 'keepMin', $any($event.target).value)"
                      />
                    </td>
                    <td>
                      @if (k.manager.orders[g]) {
                        <button type="button" (click)="clear(g)">✕</button>
                      }
                    </td>
                  </tr>
                }
              </table>
              <button type="button" (click)="game.send({ type: 'FireManager', cityId: k.cityId })">
                Verwalter entlassen
              </button>
            }
          }
          @case ('property') {
            <h3>Betriebe</h3>
            @for (b of businesses(); track b.id) {
              <div class="row-item">
                <span
                  ><strong>{{ b.name }}</strong
                  >{{ b.effective ? '' : ' (ineffektiv)' }} – {{ b.workers }}/{{
                    b.maxWorkers
                  }}
                  Arbeiter</span
                >
                <label
                  >Auslastung {{ b.utilization | pct }}
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
                <button type="button" (click)="demolish(b.id, b.name)">Abreißen</button>
              </div>
            } @empty {
              <p class="muted">Keine Betriebe in dieser Stadt. Baut welche im Bauhof.</p>
            }
            <h3>Wohnhäuser</h3>
            @for (h of houses(); track h.id) {
              <div class="row-item">
                <span
                  ><strong>{{ h.name }}</strong> – {{ h.tenants }}/{{ h.capacity }} Mieter</span
                >
                <label
                  >Miete
                  <select
                    [value]="h.rentLevel"
                    (change)="
                      game.send({
                        type: 'SetRentLevel',
                        houseId: asHouse(h.id),
                        level: +$any($event.target).value,
                      })
                    "
                  >
                    @for (l of rentLevels; track $index) {
                      <option [value]="$index">{{ rentNames[$index] }}</option>
                    }
                  </select>
                </label>
              </div>
            } @empty {
              <p class="muted">Keine Wohnhäuser in dieser Stadt.</p>
            }
          }
        }
      } @else {
        <p>Ihr habt hier kein Kontor.</p>
      }
    </app-panel-frame>
  `,
})
export class KontorPanel {
  protected readonly game = inject(GameService);
  private readonly ref = useCity(this.game);
  protected readonly tab = signal<Tab>('storage');
  protected readonly moveAmount = signal(10);
  protected readonly maxGuards = MAX_GUARDS;
  protected readonly goods = GOOD_IDS;
  protected readonly rentLevels = RENT_LEVELS;
  protected readonly rentNames = ['sehr niedrig', 'niedrig', 'normal', 'hoch', 'sehr hoch'];

  protected readonly kontor = computed(() => {
    const s = this.game.state();
    const id = this.ref.cityId();
    return s && id ? (s.player.kontors[id] ?? null) : null;
  });
  private readonly view = computed(() => possessionsView(this.game.state()!));
  protected readonly subtitle = computed(() => {
    const k = this.view().kontors.find((x) => x.cityId === this.ref.cityId());
    return k
      ? `${k.cityName} · belegt ${Math.round(k.used)}/${k.capacity} · ${k.warehouses} Lagerhäuser`
      : '';
  });
  protected readonly managerWage = computed(
    () => this.view().kontors.find((x) => x.cityId === this.ref.cityId())?.managerWage ?? 0,
  );
  protected readonly storageRows = computed(() => amountRows(this.kontor()?.storage ?? {}));
  protected readonly targets = computed(() => {
    const id = this.ref.cityId();
    return id ? storageOptions(this.game, id).filter((o) => o.key !== 'kontor') : [];
  });
  protected readonly canHire = computed(
    () => !!this.game.state() && canDo(this.game.state()!, 'hireManager'),
  );
  protected readonly businesses = computed(() => {
    const name = this.view().kontors.find((x) => x.cityId === this.ref.cityId())?.cityName;
    return this.view().businesses.filter((b) => b.cityName === name);
  });
  protected readonly houses = computed(() => {
    const name = this.view().kontors.find((x) => x.cityId === this.ref.cityId())?.cityName;
    return this.view().houses.filter((h) => h.cityName === name);
  });

  protected goodName(g: GoodId): string {
    return GOODS[g].name;
  }

  protected prices(g: GoodId): string {
    const s = this.game.state();
    const id = this.ref.cityId();
    if (!s || !id) return '';
    return `${Math.round(buyPrice(s.cities[id], g))} / ${Math.round(sellPrice(s.cities[id], g))}`;
  }

  protected order(g: GoodId): StandingOrder {
    return this.kontor()?.manager?.orders[g] ?? { buyBelow: null, buyUpTo: 0, sellAbove: null, keepMin: 0 };
  }

  protected edit(g: GoodId, field: keyof StandingOrder, raw: string): void {
    const k = this.kontor();
    if (!k) return;
    const value = raw === '' ? null : Math.max(0, Number(raw));
    const next: StandingOrder = { ...this.order(g) };
    if (field === 'buyBelow' || field === 'sellAbove') next[field] = value;
    else next[field] = value ?? 0;
    this.game.send({ type: 'SetStandingOrder', cityId: k.cityId, good: g, order: next });
  }

  protected clear(g: GoodId): void {
    const k = this.kontor();
    if (k) this.game.send({ type: 'SetStandingOrder', cityId: k.cityId, good: g, order: null });
  }

  protected move(good: GoodId, targetKey: string, outOfKontor: boolean): void {
    const id = this.ref.cityId();
    if (!id) return;
    const target = storageOptions(this.game, id).find((o) => o.key === targetKey);
    if (!target) return;
    const kontorRef = { kind: 'kontor' as const, cityId: id };
    this.game.send({
      type: 'TransferGoods',
      good,
      amount: this.moveAmount(),
      from: outOfKontor ? kontorRef : target.ref,
      to: outOfKontor ? target.ref : kontorRef,
    });
  }

  protected demolish(id: string, name: string): void {
    if (confirm(`${name} wirklich abreißen?`))
      this.game.send({ type: 'DemolishBusiness', businessId: id as BusinessId });
  }

  protected asBusiness(id: string): BusinessId {
    return id as BusinessId;
  }

  protected asHouse(id: string): HouseId {
    return id as HouseId;
  }
}
