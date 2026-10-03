import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { GameService } from '../../bridge/game.service';
import type { CityId } from '../../sim/data/cities';
import { SMUGGLING } from '../../sim/data/factions';
import { GOODS, type GoodId } from '../../sim/data/goods';
import { smuggleQuote } from '../../sim/systems/factions';
import { resolveStorage } from '../../sim/systems/storage';
import { FORMAT_PIPES } from '../shared/format';
import { StoragePicker, resolveOption, storageOptions } from '../shared/storage-picker';

/** Schmuggel über die Hafenbruderschaft (in der Taverne). */
@Component({
  selector: 'app-smuggle-section',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [StoragePicker, ...FORMAT_PIPES],
  template: `
    <h3>Ein Mann der Hafenbruderschaft</h3>
    @if (!known()) {
      <p class="muted">
        In der Ecke tuscheln Seeleute. Mit Fremden reden sie nicht – wer Matrosen anheuert oder den
        Informanten bezahlt, wird mit der Zeit bekannt.
      </p>
    } @else {
      <p class="muted small">
        Ware am Zoll vorbei: rund {{ bonus }} % mehr Erlös als auf dem Markt, aber werdet Ihr erwischt, ist
        die Ware weg und es kostet Buße und Leumund.
      </p>
      <app-storage-picker [cityId]="cityId()" [(selected)]="storageKey" label="Aus:" />
      <div class="row-item">
        <select [value]="good() ?? ''" (change)="good.set($any($event.target).value || null)">
          <option value="">– Ware –</option>
          @for (g of goods(); track g.good) {
            <option [value]="g.good">{{ g.name }} ({{ g.amount | qty }})</option>
          }
        </select>
        <input
          class="qty"
          type="number"
          min="1"
          [value]="amount()"
          (input)="amount.set($any($event.target).valueAsNumber || 1)"
        />
        @if (quote(); as q) {
          <span
            >{{ q.value | gold }} <span class="muted">(Markt {{ q.marketValue | gold }})</span></span
          >
          <span class="tag" [class.red]="q.catchChance > 0.25">Risiko {{ percent(q.catchChance) }} %</span>
        }
        <button type="button" [disabled]="!good()" (click)="smuggle()">Verkaufen (2 Std.)</button>
      </div>
    }
  `,
})
export class SmuggleSection {
  readonly cityId = input.required<CityId>();
  private readonly game = inject(GameService);
  protected readonly bonus = Math.round((SMUGGLING.priceFactor - 1) * 100);
  protected readonly storageKey = signal('inventory');
  protected readonly good = signal<GoodId | null>(null);
  protected readonly amount = signal(1);

  protected readonly known = computed(
    () => (this.game.state()?.player.factions.harbour ?? 0) >= SMUGGLING.minHarbourFavor,
  );
  private readonly storage = computed(() => {
    const s = this.game.state();
    if (!s) return null;
    return (
      resolveStorage(s, resolveOption(storageOptions(this.game, this.cityId()), this.storageKey())) ?? null
    );
  });
  protected readonly goods = computed(() => {
    const storage = this.storage();
    if (!storage) return [];
    return (Object.entries(storage) as [GoodId, number][])
      .filter(([, a]) => a >= 1)
      .map(([good, amount]) => ({ good, name: GOODS[good].name, amount }));
  });
  protected readonly quote = computed(() => {
    const s = this.game.state();
    const g = this.good();
    return s && g ? smuggleQuote(s, this.cityId(), g, this.amount()) : null;
  });

  protected percent(p: number): number {
    return Math.round(p * 100);
  }

  protected smuggle(): void {
    const g = this.good();
    if (!g) return;
    this.game.send({
      type: 'Smuggle',
      good: g,
      amount: this.amount(),
      storage: resolveOption(storageOptions(this.game, this.cityId()), this.storageKey()),
    });
  }
}
