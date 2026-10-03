import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { GameService } from '../../bridge/game.service';
import type { CityId } from '../../sim/data/cities';
import type { GoodCategory, GoodId } from '../../sim/data/goods';
import { CATEGORY_NAMES, currentCityId, marketRows, type MarketRow } from '../../sim/selectors';
import { FORMAT_PIPES } from '../shared/format';
import { PanelFrame } from '../shared/panel-frame';
import { StoragePicker, resolveOption, storageOptions } from '../shared/storage-picker';
import { amountOf, resolveStorage } from '../../sim/systems/storage';
import { merchantMood, standardUnitPrice } from '../../sim/systems/haggle';
import { HAGGLE } from '../../sim/data/balance';

const CATEGORIES: GoodCategory[] = ['staple', 'consumer', 'luxury', 'material'];

/** Markthalle (Tippsammlung 2.1.2.2): Bestand, Preise, Handel mit Rucksack/Kontor/Schiff. */
@Component({
  selector: 'app-market-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PanelFrame, StoragePicker, ...FORMAT_PIPES],
  template: `
    <app-panel-frame
      title="Markthalle"
      [subtitle]="'Preise für ' + storageLabel() + ' · Ziel: zwei Wochen Vorrat'"
    >
      @if (cityId(); as city) {
        <div class="toolbar">
          <app-storage-picker [cityId]="city" [(selected)]="storageKey" label="Handeln mit:" />
          <label class="check"
            ><input type="checkbox" [checked]="onlyHeld()" (change)="onlyHeld.set(!onlyHeld())" /> nur eigene
            Waren</label
          >
        </div>
        @if (haggle(); as h) {
          <div class="haggle" role="dialog" aria-label="Feilschen">
            <h3>Feilschen um {{ h.name }}</h3>
            <div class="row-item">
              <label
                ><input
                  type="radio"
                  name="dir"
                  [checked]="h.direction === 'sell'"
                  (change)="setHaggle({ direction: 'sell' })"
                />
                verkaufen</label
              >
              <label
                ><input
                  type="radio"
                  name="dir"
                  [checked]="h.direction === 'buy'"
                  (change)="setHaggle({ direction: 'buy' })"
                />
                kaufen</label
              >
              <label
                >Menge
                <input
                  class="qty"
                  type="number"
                  min="1"
                  [value]="h.amount"
                  (input)="setHaggle({ amount: $any($event.target).valueAsNumber || 1 })"
              /></label>
            </div>
            <p class="muted">
              Marktpreis: {{ haggleStandard() | gold }} je Einheit · Laune des Händlers: {{ moodText() }} ·
              Versuche heute: {{ attemptsLeft() }}
            </p>
            <div class="row-item">
              <input
                type="range"
                min="70"
                max="130"
                step="1"
                [value]="h.percent"
                (input)="setHaggle({ percent: $any($event.target).valueAsNumber })"
              />
              <strong>{{ offerPrice() | gold }} je Einheit</strong>
              <span class="muted"
                >({{ h.percent - 100 > 0 ? '+' : '' }}{{ h.percent - 100 }} %, gesamt
                {{ offerPrice() * h.amount | gold }})</span
              >
              <button type="button" class="primary small-primary" (click)="submitHaggle()">Anbieten</button>
              <button type="button" (click)="haggle.set(null)">Abbrechen</button>
            </div>
            @if (haggleReply()) {
              <p class="reply">{{ haggleReply() }}</p>
            }
          </div>
        }
        <table class="table market">
          <thead>
            <tr>
              <th>Ware</th>
              <th class="num">Markt</th>
              <th class="num">Bedarf/Wo.</th>
              <th class="num">Kaufen</th>
              <th class="num">Verkaufen</th>
              <th class="num">Eigen</th>
              <th>Menge</th>
              <th></th>
            </tr>
          </thead>
          @for (cat of categories; track cat) {
            <tbody>
              <tr class="group">
                <td colspan="8">{{ categoryNames[cat] }}</td>
              </tr>
              @for (row of rowsBy(cat); track row.good) {
                <tr [class.shortage]="row.shortage">
                  <td>
                    {{ row.name }}
                    @if (row.special) {
                      <span class="tag gold" title="Spezialware der Stadt">★</span>
                    } @else if (row.produced) {
                      <span class="tag" title="wird hier hergestellt">⚒</span>
                    }
                    @if (row.shortage) {
                      <span class="tag red" title="Mangelware">knapp</span>
                    }
                  </td>
                  <td class="num">{{ row.stock | qty }}</td>
                  <td class="num muted">{{ row.weeklyDemand | qty }}</td>
                  <td class="num" [class.cheap]="row.priceLevel < 0.85" [class.dear]="row.priceLevel > 1.25">
                    {{ row.buyPrice | gold }}
                  </td>
                  <td class="num" [class.cheap]="row.priceLevel < 0.85" [class.dear]="row.priceLevel > 1.25">
                    {{ row.sellPrice | gold }}
                  </td>
                  <td class="num">{{ held(row.good) | qty }}</td>
                  <td>
                    <input
                      class="qty"
                      type="number"
                      min="1"
                      [value]="amountFor(row.good)"
                      (input)="setAmount(row.good, $any($event.target).valueAsNumber)"
                    />
                  </td>
                  <td class="actions">
                    <button type="button" (click)="buy(city, row)">Kaufen</button>
                    <button type="button" class="haggle-btn" title="Feilschen" (click)="openHaggle(row)">
                      🤝
                    </button>
                    <button type="button" (click)="sell(city, row)" [disabled]="held(row.good) < 1">
                      Verkaufen
                    </button>
                  </td>
                </tr>
              }
            </tbody>
          }
        </table>

        <p class="hint">
          Verkäufe knapper Waren bringen mehr Ansehen, Einkäufe kosten etwas Ansehen. Jede verkaufte Einheit
          drückt den Preis.
        </p>
      }
    </app-panel-frame>
  `,
})
export class MarketPanel {
  private readonly game = inject(GameService);
  protected readonly categories = CATEGORIES;
  protected readonly categoryNames = CATEGORY_NAMES;
  protected readonly storageKey = signal('inventory');
  protected readonly onlyHeld = signal(false);
  private readonly amounts = signal<Partial<Record<GoodId, number>>>({});

  protected readonly cityId = computed<CityId | null>(() => {
    const state = this.game.state();
    return state ? currentCityId(state) : null;
  });
  private readonly options = computed(() => {
    const city = this.cityId();
    return city ? storageOptions(this.game, city) : [];
  });
  protected readonly storageLabel = computed(
    () => this.options().find((o) => o.key === this.storageKey())?.label ?? 'Rucksack',
  );
  private readonly rows = computed(() => {
    const state = this.game.state();
    const city = this.cityId();
    return state && city ? marketRows(state, city) : [];
  });

  // --- Feilschen ------------------------------------------------------------
  protected readonly haggle = signal<{
    good: GoodId;
    name: string;
    direction: 'buy' | 'sell';
    amount: number;
    percent: number;
  } | null>(null);
  protected readonly haggleReply = signal('');
  protected readonly haggleStandard = computed(() => {
    const state = this.game.state();
    const city = this.cityId();
    const h = this.haggle();
    return state && city && h ? standardUnitPrice(state, city, h.good, h.amount, h.direction) : 0;
  });
  protected readonly offerPrice = computed(() => {
    const h = this.haggle();
    return h ? Math.max(1, Math.round((this.haggleStandard() * h.percent) / 100)) : 0;
  });
  protected readonly moodText = computed(() => {
    const state = this.game.state();
    const city = this.cityId();
    const mood = state && city ? merchantMood(state, city) : 1;
    return mood > 0.85 ? 'gut gelaunt' : mood > 0.5 ? 'reserviert' : 'verstimmt';
  });
  protected readonly attemptsLeft = computed(() => {
    const state = this.game.state();
    const h = this.haggle();
    if (!state || !h) return 0;
    const today =
      state.player.dailyLedger.day === Math.floor(state.tick / 24) ? state.player.dailyLedger.haggles : {};
    return HAGGLE.attemptsPerGoodPerDay - (today[h.good] ?? 0);
  });

  protected openHaggle(row: MarketRow): void {
    const held = Math.floor(this.held(row.good));
    this.haggleReply.set('');
    this.haggle.set({
      good: row.good,
      name: row.name,
      direction: held > 0 ? 'sell' : 'buy',
      amount: Math.max(1, held > 0 ? held : this.amountFor(row.good)),
      percent: held > 0 ? 108 : 92,
    });
  }

  protected setHaggle(patch: Partial<{ direction: 'buy' | 'sell'; amount: number; percent: number }>): void {
    this.haggle.update((h) => (h ? { ...h, ...patch } : h));
  }

  protected submitHaggle(): void {
    const h = this.haggle();
    if (!h) return;
    const result = this.game.send({
      type: 'Haggle',
      good: h.good,
      amount: Math.floor(h.amount),
      direction: h.direction,
      pricePerUnit: this.offerPrice(),
      storage: resolveOption(this.options(), this.storageKey()),
    });
    this.haggleReply.set(result.ok ? (result.message ?? '') : result.reason);
    if (result.ok && result.tag === 'accepted') this.haggle.set(null);
  }

  protected rowsBy(cat: GoodCategory): MarketRow[] {
    return this.rows().filter((r) => r.category === cat && (!this.onlyHeld() || this.held(r.good) > 0));
  }

  protected held(good: GoodId): number {
    const state = this.game.state();
    if (!state) return 0;
    const storage = resolveStorage(state, resolveOption(this.options(), this.storageKey()));
    return storage ? amountOf(storage, good) : 0;
  }

  protected amountFor(good: GoodId): number {
    return this.amounts()[good] ?? 1;
  }

  protected setAmount(good: GoodId, value: number): void {
    this.amounts.update((a) => ({
      ...a,
      [good]: Number.isFinite(value) && value > 0 ? Math.floor(value) : 1,
    }));
  }

  protected buy(_city: CityId, row: MarketRow): void {
    this.game.send({
      type: 'BuyGoods',
      good: row.good,
      amount: this.amountFor(row.good),
      into: resolveOption(this.options(), this.storageKey()),
    });
  }

  protected sell(_city: CityId, row: MarketRow): void {
    const amount = Math.min(this.amountFor(row.good), Math.floor(this.held(row.good)));
    this.game.send({
      type: 'SellGoods',
      good: row.good,
      amount,
      from: resolveOption(this.options(), this.storageKey()),
    });
  }
}
