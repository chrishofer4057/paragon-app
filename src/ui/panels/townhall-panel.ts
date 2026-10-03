import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { GameService } from '../../bridge/game.service';
import { CITIES } from '../../sim/data/cities';
import { GOODS } from '../../sim/data/goods';
import { forecast } from '../../sim/selectors';
import { MISSIONS } from '../../sim/systems/politics';
import { hasLocalPermission } from '../../sim/systems/ranks';
import { specialTaxShare } from '../../sim/systems/politics';
import type { CityContract } from '../../sim/state/gameState';
import { resolveStorage } from '../../sim/systems/storage';
import { FORMAT_PIPES } from '../shared/format';
import { PanelFrame } from '../shared/panel-frame';
import { StoragePicker, resolveOption, storageOptions } from '../shared/storage-picker';
import { useCity } from '../shared/use-city';

type Tab = 'info' | 'contracts' | 'council' | 'lia';

/** Stadthaus (Rathaus, Tippsammlung 2.1.1.3). */
@Component({
  selector: 'app-townhall-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PanelFrame, StoragePicker, ...FORMAT_PIPES],
  template: `
    <app-panel-frame title="Stadthaus" [subtitle]="city()?.name ?? ''">
      <nav class="tabs">
        <button type="button" [class.active]="tab() === 'info'" (click)="tab.set('info')">Stadtinfo</button>
        <button type="button" [class.active]="tab() === 'contracts'" (click)="tab.set('contracts')">
          Aushang ({{ contracts().length }})
        </button>
        <button type="button" [class.active]="tab() === 'council'" (click)="tab.set('council')">
          Rat & Kasse
        </button>
        <button type="button" [class.active]="tab() === 'lia'" (click)="tab.set('lia')">Lia-Kanzlei</button>
      </nav>
      @if (city(); as c) {
        @switch (tab()) {
          @case ('info') {
            <div class="cols">
              <div>
                <h3>
                  Bevölkerung: {{ c.population | qty }}
                  <span class="muted">+ {{ c.beggars | qty }} Bettler</span>
                </h3>
                <table class="table">
                  <tr>
                    <th>Schicht</th>
                    <th class="num">Einw.</th>
                    <th class="num">Wohnraum</th>
                    <th>Stimmung</th>
                  </tr>
                  @for (cl of c.classes; track cl.cls) {
                    <tr>
                      <td>{{ cl.label }}</td>
                      <td class="num">{{ cl.population | qty }}</td>
                      <td class="num">{{ cl.housing | qty }}</td>
                      <td>
                        <span class="mood" [attr.data-level]="cl.happinessLevel">{{
                          cl.happinessLabel
                        }}</span>
                      </td>
                    </tr>
                  }
                </table>
                <p class="muted">
                  Arbeitsplätze: {{ c.jobs | qty }} · Seuchenvorsorge: {{ c.health | pct
                  }}{{ c.plague ? ' · SEUCHE!' : '' }}
                </p>
                <p>Mangelwaren: {{ c.shortages.join(', ') || 'keine' }}</p>
                <p class="muted">
                  {{ c.culture === 'north' ? 'Nordische' : 'Südliche' }} Stadt ({{ c.size }}) · Spezialität:
                  {{ c.special }} · stellt her: {{ c.regular.join(', ') }}
                </p>
              </div>
              <div>
                <h3>Führung</h3>
                <p>
                  Schultheiss: <strong>{{ c.mayor }}</strong
                  >{{ c.playerIsMayor ? ' (Ihr!)' : '' }}
                </p>
                <p>Nächste Wahl: {{ c.electionDate }}</p>
                <h4>Wahlprognose</h4>
                <ol>
                  @for (cand of candidates(); track cand.name) {
                    <li [class.me]="cand.isPlayer">{{ cand.name }}</li>
                  }
                </ol>
                <p class="muted">Kopfsteuer {{ c.headTax | pct }} · Stadtkasse {{ c.treasury | gold }}</p>
              </div>
            </div>
          }
          @case ('contracts') {
            <p class="muted">
              Bei Warenmangel sucht die Stadt Lieferanten zu garantierten Preisen. Wer zusagt und nicht
              liefert, bekommt eine Weile keine Aufträge mehr.
            </p>
            <app-storage-picker [cityId]="c.id" [(selected)]="storageKey" label="Liefern aus:" />
            @for (ct of contracts(); track ct.id) {
              <div class="row-item">
                <span>
                  <strong>{{ goodName(ct) }}</strong
                  >: {{ ct.delivered | qty }}/{{ ct.amount }} zu je {{ ct.pricePerUnit | gold }}
                  <span class="muted"
                    >({{
                      ct.kind === 'priceGuarantee'
                        ? 'Preisgarantie, Zahlung sofort'
                        : 'Ausschreibung, Zahlung bei Fristende'
                    }}, noch {{ daysLeft(ct) }} Tage)</span
                  >
                </span>
                @if (ct.acceptedByPlayer) {
                  <button type="button" (click)="deliver(ct)">Liefern</button>
                } @else {
                  <button type="button" (click)="game.send({ type: 'AcceptContract', contractId: ct.id })">
                    Annehmen
                  </button>
                }
              </div>
            } @empty {
              <p>Derzeit hängen keine Aufträge aus.</p>
            }
          }
          @case ('council') {
            @if (c.playerIsMayor) {
              <h3>Stadtkasse (Schultheiss)</h3>
              <p>Bestand: {{ c.treasury | gold }}</p>
              <div class="row-item">
                <input
                  class="qty wide"
                  type="number"
                  [value]="money()"
                  (input)="money.set($any($event.target).valueAsNumber || 0)"
                />
                <button type="button" (click)="game.send({ type: 'TreasuryTransfer', amount: money() })">
                  Einzahlen
                </button>
                <button type="button" (click)="game.send({ type: 'TreasuryTransfer', amount: -money() })">
                  Entnehmen
                </button>
              </div>
              <div class="row-item">
                <span>Kopfsteuer direkt festlegen:</span>
                <input
                  class="qty"
                  type="number"
                  min="0"
                  max="20"
                  [value]="taxPct()"
                  (input)="taxPct.set($any($event.target).valueAsNumber || 0)"
                />
                %
                <button type="button" (click)="game.send({ type: 'SetHeadTax', rate: taxPct() / 100 })">
                  Festlegen
                </button>
              </div>
            }
            <h3>Anträge an den Rat</h3>
            @if (canPropose()) {
              <div class="row-item">
                <span>Kopfsteuer ändern auf</span>
                <input
                  class="qty"
                  type="number"
                  min="0"
                  max="20"
                  [value]="taxPct()"
                  (input)="taxPct.set($any($event.target).valueAsNumber || 0)"
                />
                %
                <button
                  type="button"
                  (click)="
                    game.send({ type: 'ProposeMotion', motion: { kind: 'headTax', rate: taxPct() / 100 } })
                  "
                >
                  Beantragen
                </button>
              </div>
              <div class="row-item">
                <span>Sondersteuer von</span>
                <input
                  class="qty wide"
                  type="number"
                  min="1"
                  [value]="money()"
                  (input)="money.set($any($event.target).valueAsNumber || 0)"
                />
                GS
                <span class="muted">(Euer Anteil ca. {{ taxShare() | pct }})</span>
                <button
                  type="button"
                  (click)="
                    game.send({ type: 'ProposeMotion', motion: { kind: 'specialTax', amount: money() } })
                  "
                >
                  Beantragen
                </button>
              </div>
              @for (m of motions(); track m.id) {
                <p class="muted">
                  Offener Antrag:
                  {{
                    m.motion.kind === 'headTax' ? 'Kopfsteuer ' + m.motion.rate * 100 + ' %' : 'Sondersteuer'
                  }}
                  – Sitzung in {{ daysUntil(m.sessionTick) }} Tagen.
                </p>
              }
            } @else {
              <p class="muted">Anträge stellen dürfen nur Ratsherren dieser Stadt.</p>
            }
          }
          @case ('lia') {
            @if (state(); as s) {
              <p>
                Sitz der Lia: <strong>{{ capitalName() }}</strong> · Landammann:
                <strong>{{ landammann() }}</strong>
              </p>
              @if (!s.player.liaInvited) {
                <p class="muted">
                  Die Kanzlei empfängt nur Schultheisse, die in der ganzen Lia Ansehen genießen.
                </p>
              } @else {
                <p>
                  Erfüllte Aufträge: {{ s.player.missionsCompleted }} (zwei sind für die Kandidatur nötig)
                </p>
                @if (s.player.mission; as m) {
                  <p>
                    Laufender Auftrag:
                    <strong>{{
                      m.kind === 'cityGlory' ? missions.cityGlory.name : missions.landRoute.name
                    }}</strong>
                    in {{ cityName(m.cityId) }}, Frist {{ daysUntil(m.deadlineTick) }} Tage.
                  </p>
                  @if (m.kind === 'landRoute') {
                    @for (entry of landRouteNeeds(); track entry.good) {
                      <div class="row-item">
                        <span>{{ entry.name }}: {{ entry.delivered }}/{{ entry.needed }}</span>
                        <button
                          type="button"
                          (click)="deliverMission(entry.good, entry.needed - entry.delivered)"
                        >
                          Liefern
                        </button>
                      </div>
                    }
                  }
                } @else if (c.id === s.lia.capital) {
                  <button type="button" (click)="game.send({ type: 'AcceptMission', mission: 'cityGlory' })">
                    {{ missions.cityGlory.name }}
                  </button>
                  <button type="button" (click)="game.send({ type: 'AcceptMission', mission: 'landRoute' })">
                    {{ missions.landRoute.name }}
                  </button>
                } @else {
                  <p class="muted">Aufträge vergibt die Kanzlei in {{ capitalName() }}.</p>
                }
              }
            }
          }
        }
      }
    </app-panel-frame>
  `,
})
export class TownhallPanel {
  protected readonly game = inject(GameService);
  protected readonly state = this.game.state;
  private readonly cityRef = useCity(this.game);
  protected readonly city = this.cityRef.city;
  protected readonly tab = signal<Tab>('info');
  protected readonly storageKey = signal('kontor');
  protected readonly money = signal(1000);
  protected readonly taxPct = signal(5);
  protected readonly missions = MISSIONS;

  protected readonly contracts = computed(() => {
    const s = this.game.state();
    const id = this.cityRef.cityId();
    return s && id ? s.cities[id].contracts : [];
  });
  protected readonly motions = computed(() => {
    const s = this.game.state();
    const id = this.cityRef.cityId();
    return s && id ? s.cities[id].motions : [];
  });
  protected readonly candidates = computed(() => {
    const s = this.game.state();
    const id = this.cityRef.cityId();
    return s && id ? forecast(s, id) : [];
  });
  protected readonly canPropose = computed(() => {
    const s = this.game.state();
    const id = this.cityRef.cityId();
    return !!s && !!id && hasLocalPermission(s, id, 'councilMotions');
  });
  protected readonly taxShare = computed(() => {
    const s = this.game.state();
    const id = this.cityRef.cityId();
    return s && id ? specialTaxShare(s, id) : 0;
  });
  protected readonly capitalName = computed(() => {
    const s = this.game.state();
    return s ? CITIES[s.lia.capital].name : '';
  });
  protected readonly landammann = computed(() => {
    const s = this.game.state();
    if (!s) return '';
    return s.lia.landammann.kind === 'player' ? `${s.player.name} (Ihr!)` : s.lia.landammann.name;
  });
  protected readonly landRouteNeeds = computed(() => {
    const m = this.game.state()?.player.mission;
    return (Object.entries(MISSIONS.landRoute.materials) as [keyof typeof GOODS, number][]).map(
      ([good, needed]) => ({
        good,
        name: GOODS[good].name,
        needed,
        delivered: Math.floor(m?.delivered[good] ?? 0),
      }),
    );
  });

  protected goodName(ct: CityContract): string {
    return GOODS[ct.good].name;
  }

  protected cityName(id: keyof typeof CITIES): string {
    return CITIES[id].name;
  }

  protected daysLeft(ct: CityContract): number {
    return this.daysUntil(ct.expiresTick);
  }

  protected daysUntil(tick: number): number {
    const s = this.game.state();
    return s ? Math.max(0, Math.ceil((tick - s.tick) / 24)) : 0;
  }

  private source() {
    const id = this.cityRef.cityId();
    return id
      ? resolveOption(storageOptions(this.game, id), this.storageKey())
      : ({ kind: 'inventory' } as const);
  }

  protected deliver(ct: CityContract): void {
    const s = this.game.state();
    const id = this.cityRef.cityId();
    if (!s || !id) return;
    const ref = this.source();
    const storage = resolveStorage(s, ref);
    const have = Math.floor(storage?.[ct.good] ?? 0);
    const amount = Math.min(have, Math.ceil(ct.amount - ct.delivered));
    this.game.send({ type: 'DeliverContract', contractId: ct.id, amount: Math.max(1, amount), from: ref });
  }

  protected deliverMission(good: keyof typeof GOODS, amount: number): void {
    this.game.send({ type: 'DeliverMissionGoods', good, amount: Math.max(1, amount), from: this.source() });
  }
}
