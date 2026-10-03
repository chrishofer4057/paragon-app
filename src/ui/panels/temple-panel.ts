import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { GameService } from '../../bridge/game.service';
import { ALMS_GOODS, TEMPLE_STAGES } from '../../sim/data/buildings';
import { GOODS, type GoodId } from '../../sim/data/goods';
import { almsValueNeeded } from '../../sim/commands/handlers/civic';
import { amountOf, resolveStorage } from '../../sim/systems/storage';
import { FORMAT_PIPES } from '../shared/format';
import { PanelFrame } from '../shared/panel-frame';
import { StoragePicker, resolveOption, storageOptions } from '../shared/storage-picker';
import { useCity } from '../shared/use-city';

/** Tempel (Kirche, Tippsammlung 2.1.1.7). */
@Component({
  selector: 'app-temple-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PanelFrame, StoragePicker, ...FORMAT_PIPES],
  template: `
    <app-panel-frame title="Tempel" subtitle="Beten, spenden, die Armen speisen">
      @if (city(); as c) {
        <h3>Beten</h3>
        <div class="row-item">
          <span
            >Wer mindestens alle drei Wochen betet, bleibt von bösen Anklagen verschont.
            <span class="muted">Zuletzt vor {{ daysSincePrayer() }} Tagen.</span></span
          >
          <button type="button" (click)="game.send({ type: 'Pray' })">Beten (1 Std.)</button>
        </div>

        <h3>Spende und Ausbau</h3>
        <p>
          Ausbaustufe {{ c.templeStage }} von {{ stages }}. <em>„{{ c.templeHint }}“</em>
        </p>
        <p class="muted">
          Gesammelt: {{ c.templeDonations | gold }}
          @if (nextStage(); as s) {
            von {{ s | gold }} für die nächste Stufe
          }
          .
        </p>
        <div class="row-item">
          <input
            class="qty wide"
            type="number"
            min="1"
            [value]="donation()"
            (input)="donation.set($any($event.target).valueAsNumber || 0)"
          />
          <button type="button" (click)="game.send({ type: 'Donate', amount: donation() })">Spenden</button>
        </div>

        <h3>Armenspeisung</h3>
        <p class="muted">
          Lockt für einen Tag viele Bedürftige in die Stadt (neue Arbeitskräfte) und bringt soziales Ansehen.
          Benötigter Warenwert: ca. {{ almsNeeded() | gold }}.
        </p>
        <app-storage-picker [cityId]="c.id" [(selected)]="storageKey" label="Aus:" />
        <div class="grid-alms">
          @for (g of almsGoods; track g) {
            <label
              >{{ goodName(g) }} <span class="muted">({{ held(g) | qty }})</span>
              <input
                class="qty"
                type="number"
                min="0"
                [value]="alms()[g] ?? 0"
                (input)="setAlms(g, $any($event.target).valueAsNumber)"
              />
            </label>
          }
        </div>
        <p>Wert: {{ almsValue() | gold }}</p>
        <button type="button" (click)="giveAlms()">Speisung ausgeben</button>
      }
    </app-panel-frame>
  `,
})
export class TemplePanel {
  protected readonly game = inject(GameService);
  protected readonly city = useCity(this.game).city;
  protected readonly stages = TEMPLE_STAGES.length;
  protected readonly almsGoods = ALMS_GOODS;
  protected readonly donation = signal(100);
  protected readonly storageKey = signal('inventory');
  protected readonly alms = signal<Partial<Record<GoodId, number>>>({});

  protected readonly daysSincePrayer = computed(() => {
    const s = this.game.state();
    return s ? Math.floor((s.tick - s.player.lastPrayerTick) / 24) : 0;
  });
  protected readonly nextStage = computed(
    () => TEMPLE_STAGES[this.city()?.templeStage ?? 99]?.donationsNeeded ?? null,
  );
  protected readonly almsNeeded = computed(() => {
    const s = this.game.state();
    const c = this.city();
    return s && c ? almsValueNeeded(s, c.id) : 0;
  });
  protected readonly almsValue = computed(() =>
    (Object.entries(this.alms()) as [GoodId, number][]).reduce(
      (sum, [g, a]) => sum + GOODS[g].basePrice * a,
      0,
    ),
  );

  protected goodName(g: GoodId): string {
    return GOODS[g].name;
  }

  protected held(g: GoodId): number {
    const s = this.game.state();
    const c = this.city();
    if (!s || !c) return 0;
    const storage = resolveStorage(s, resolveOption(storageOptions(this.game, c.id), this.storageKey()));
    return storage ? amountOf(storage, g) : 0;
  }

  protected setAlms(g: GoodId, value: number): void {
    this.alms.update((a) => ({ ...a, [g]: Number.isFinite(value) && value > 0 ? Math.floor(value) : 0 }));
  }

  protected giveAlms(): void {
    const c = this.city();
    if (!c) return;
    const goods = Object.fromEntries(Object.entries(this.alms()).filter(([, a]) => (a ?? 0) > 0));
    const result = this.game.send({
      type: 'GiveAlms',
      goods,
      from: resolveOption(storageOptions(this.game, c.id), this.storageKey()),
    });
    if (result.ok) this.alms.set({});
  }
}
