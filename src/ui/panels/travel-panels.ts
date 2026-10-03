import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { GameService } from '../../bridge/game.service';
import { CHARACTERS } from '../../sim/data/characters';
import { CITIES, CITY_IDS, type CityId } from '../../sim/data/cities';
import { GOOD_IDS, GOODS, type GoodId } from '../../sim/data/goods';
import { PASSAGE, SHIP_TYPES, SHIP_TYPE_IDS, type ShipTypeId } from '../../sim/data/ships';
import { cargoFee, repairQuote } from '../../sim/commands/handlers/shipping';
import { amountRows, canDo, shipView } from '../../sim/selectors';
import type { ShipId } from '../../sim/state/ids';
import { shipBuildDays } from '../../sim/systems/construction';
import { amountOf, resolveStorage, shipInPort } from '../../sim/systems/storage';
import { passageFare, shipTravelDays, travelDays } from '../../sim/systems/travel';
import { connectionsFrom, type Connection } from '../../sim/systems/liners';
import { LINES, type LineId } from '../../sim/data/lines';
import { formatDate } from '../../sim/time';
import { FORMAT_PIPES } from '../shared/format';
import { PanelFrame } from '../shared/panel-frame';
import { StoragePicker, resolveOption, storageOptions } from '../shared/storage-picker';
import { useCity } from '../shared/use-city';

/** Werft (Tippsammlung 2.1.1.9). */
@Component({
  selector: 'app-shipyard-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PanelFrame, ...FORMAT_PIPES],
  template: `
    <app-panel-frame
      title="Werft"
      [subtitle]="
        'Erfahrung der Werft: Stufe ' + (city()?.shipyardLevel ?? 0) + ' – jeder Auftrag macht sie schneller'
      "
    >
      <h3>Schiff bauen</h3>
      @if (!canOwn()) {
        <p class="warn">Eigene Schiffe erst als Kaufmann (Stufe Reeder).</p>
      }
      <label
        >Name:
        <input type="text" [value]="name()" (input)="name.set($any($event.target).value)" maxlength="40"
      /></label>
      <table class="table">
        <tr>
          <th>Typ</th>
          <th class="num">Laderaum</th>
          <th class="num">Tempo</th>
          <th class="num">Besatzung</th>
          <th class="num">Preis</th>
          <th>Material</th>
          <th class="num">Tage</th>
          <th></th>
        </tr>
        @for (t of types(); track t.id) {
          <tr>
            <td>{{ t.name }}</td>
            <td class="num">{{ t.capacity }}</td>
            <td class="num">{{ t.speedPerDay }}</td>
            <td class="num">{{ t.minCrew }}–{{ t.maxCrew }}</td>
            <td class="num">{{ t.cost | gold }}</td>
            <td class="muted">{{ t.materials }}</td>
            <td class="num">{{ t.days }}</td>
            <td><button type="button" [disabled]="!canOwn()" (click)="order(t.id)">Bauen</button></td>
          </tr>
        }
      </table>
      <h3>Eure Schiffe im Hafen</h3>
      @for (s of ships(); track s.id) {
        <div class="row-item">
          <span
            ><strong>{{ s.name }}</strong> ({{ s.typeName }}) – Zustand {{ s.condition | qty }} %{{
              s.inRepair ? ', in Reparatur' : ''
            }}</span
          >
          @if (s.condition < 100 && !s.inRepair) {
            <button type="button" (click)="game.send({ type: 'RepairShip', shipId: s.id })">
              Reparieren ({{ repair(s.id) }})
            </button>
          }
        </div>
      } @empty {
        <p class="muted">Keines Eurer Schiffe liegt hier.</p>
      }
    </app-panel-frame>
  `,
})
export class ShipyardPanel {
  protected readonly game = inject(GameService);
  private readonly ref = useCity(this.game);
  protected readonly city = this.ref.city;
  protected readonly name = signal('Ladina');
  protected readonly canOwn = computed(() => !!this.game.state() && canDo(this.game.state()!, 'ownShips'));
  protected readonly types = computed(() => {
    const s = this.game.state();
    const id = this.ref.cityId();
    return SHIP_TYPE_IDS.map((t) => {
      const def = SHIP_TYPES[t];
      return {
        ...def,
        materials: amountRows(def.materials)
          .map((r) => `${r.amount} ${r.name}`)
          .join(', '),
        days: s && id ? shipBuildDays(s, id, t) : def.baseBuildDays,
      };
    });
  });
  protected readonly ships = computed(() => {
    const s = this.game.state();
    const id = this.ref.cityId();
    if (!s || !id) return [];
    return Object.values(s.ships)
      .filter((x) => shipInPort(x) === id)
      .map((x) => shipView(s, x.id as ShipId));
  });

  protected order(type: ShipTypeId): void {
    this.game.send({ type: 'OrderShip', shipType: type, name: this.name() });
  }

  protected repair(id: ShipId): string {
    const s = this.game.state();
    const city = this.ref.cityId();
    const ship = s?.ships[id];
    if (!s || !city || !ship) return '';
    const q = repairQuote(s, ship, city);
    return `${q.cost} GS, ${q.days} Tage`;
  }
}

interface MapCity {
  id: CityId;
  name: string;
  x: number;
  y: number;
  north: boolean;
  here: boolean;
}

/** Weltkarte und Reisen (CLAUDE.md §2.5, §5.3). */
@Component({
  selector: 'app-travel-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PanelFrame, StoragePicker, ...FORMAT_PIPES],
  template: `
    <app-panel-frame title="Reisen" subtitle="Ziel auf der Karte wählen">
      <div class="travel">
        <svg viewBox="0 0 100 100" class="worldmap" role="img" aria-label="Weltkarte">
          <rect x="0" y="0" width="100" height="100" fill="#2a6f97" />
          <line x1="0" y1="50" x2="100" y2="50" stroke="#ffffff22" stroke-width="0.3" />
          @for (c of mapCities; track c.id) {
            <circle
              [attr.cx]="c.x"
              [attr.cy]="c.y"
              r="5"
              [attr.fill]="c.north ? '#6fae4e' : '#e6cf98'"
              opacity="0.6"
            />
          }
          @for (c of mapCities; track c.id) {
            <g class="city" (click)="target.set(c.id)" [class.selected]="target() === c.id">
              <circle
                [attr.cx]="c.x"
                [attr.cy]="c.y"
                [attr.r]="c.id === here() ? 1.8 : 1.2"
                [attr.fill]="c.id === here() ? '#ffd166' : c.north ? '#8e3b2a' : '#2f6fc4'"
                stroke="#fff"
                stroke-width="0.3"
              />
              <text [attr.x]="c.x" [attr.y]="c.y + 3.6" text-anchor="middle">{{ c.name }}</text>
            </g>
          }
        </svg>
        <div class="travel-side">
          @if (booking(); as b) {
            <div class="card">
              <strong>Gebucht:</strong> {{ lineName(b.lineId) }} nach {{ cityName(b.to) }}, Abfahrt
              {{ date(b.departTick) }}
              @if (b.cargo) {
                <span class="muted"> · mit {{ b.cargo.amount }} {{ goodName(b.cargo.good) }}</span>
              }
              @if (!b.departed) {
                <button type="button" (click)="game.send({ type: 'CancelLiner' })">Stornieren</button>
              }
            </div>
          }
          @if (target(); as t) {
            <h3>{{ cityName(t) }}</h3>
            @if (t === here()) {
              <p>Hier seid Ihr.</p>
            } @else if (here(); as h) {
              @if (connectionTo(t); as c) {
                <h4>Linienschiff ({{ c.lineName }})</h4>
                <p>
                  Abfahrt {{ date(c.departTick) }}, Ankunft {{ date(c.arriveTick) }} · {{ c.fare | gold }}
                </p>
                <label class="check"
                  ><input
                    type="checkbox"
                    [checked]="withCargo()"
                    (change)="withCargo.set(!withCargo())"
                    [disabled]="!canRent()"
                  />
                  Frachtraum mieten (Ware reist mit, landet im Hafenlager)</label
                >
                <button type="button" [disabled]="!!booking()" (click)="book(c.lineId, t)">
                  Fahrt buchen
                </button>
              } @else {
                <p class="muted">Kein Linienschiff fährt direkt dorthin.</p>
              }
              <h4>Gecharterte Überfahrt</h4>
              <p>Sofort, direkt: {{ fare(h, t) | gold }}, {{ days(h, t) }} Tage</p>
              <button type="button" (click)="travel(t)">Überfahrt chartern</button>
              @for (s of ships(); track s.id) {
                <div class="row-item">
                  <span>{{ s.name }}: {{ shipDays(s.id, h, t) }} Tage</span>
                  <button type="button" (click)="travel(t, s.id)">An Bord reisen</button>
                  <button
                    type="button"
                    [disabled]="!s.hasCaptain"
                    [title]="
                      s.hasCaptain
                        ? ''
                        : 'Ohne Kapitän nur mit Euch an Bord. Kapitäne heuert Ihr in der Taverne an.'
                    "
                    (click)="game.send({ type: 'SendShip', shipId: s.id, destination: t })"
                  >
                    Allein schicken{{ s.hasCaptain ? '' : ' (Kapitän nötig)' }}
                  </button>
                </div>
              }
              <h4>Fracht: Ware wählen · oder nur mitgeben (Kapitän verkauft)</h4>
              @if (canRent()) {
                <app-storage-picker [cityId]="h" [(selected)]="storageKey" label="Aus:" />
                <div class="row-item">
                  <select [value]="good()" (change)="good.set($any($event.target).value)">
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
                  <button type="button" (click)="ship(h, t)">Mitgeben ({{ cargo(h, t) | gold }})</button>
                </div>
                <p class="muted">
                  Der Kapitän verkauft am Ziel – etwas unter Marktpreis und gegen Provision.
                </p>
              } @else {
                <p class="muted">Frachtraum mieten erst als Händler.</p>
              }
            }
          } @else {
            <p>Klickt eine Stadt an.</p>
          }
        </div>
      </div>
    </app-panel-frame>
  `,
})
export class TravelPanel {
  protected readonly game = inject(GameService);
  protected readonly here = useCity(this.game).cityId;
  protected readonly target = signal<CityId | null>(null);
  protected readonly storageKey = signal('inventory');
  protected readonly good = signal<GoodId>('Wood');
  protected readonly amount = signal(5);
  protected readonly mapCities: MapCity[] = CITY_IDS.map((id) => ({
    id,
    name: CITIES[id].name,
    x: 4 + CITIES[id].mapX * 0.92,
    y: 4 + CITIES[id].mapY * 0.9,
    north: CITIES[id].culture === 'north',
    here: false,
  }));
  protected readonly canRent = computed(() => !!this.game.state() && canDo(this.game.state()!, 'rentCargo'));
  protected readonly ships = computed(() => {
    const s = this.game.state();
    const id = this.here();
    if (!s || !id) return [];
    return Object.values(s.ships)
      .filter((x) => shipInPort(x) === id && x.repairUntilTick === null)
      .map((x) => shipView(s, x.id as ShipId));
  });
  protected readonly goods = computed(() => {
    const s = this.game.state();
    const id = this.here();
    if (!s || !id) return [];
    const storage = resolveStorage(s, resolveOption(storageOptions(this.game, id), this.storageKey()));
    return GOOD_IDS.filter((g) => storage && amountOf(storage, g) >= 1).map((g) => ({
      good: g,
      name: GOODS[g].name,
      amount: storage ? amountOf(storage, g) : 0,
    }));
  });

  protected readonly withCargo = signal(false);
  protected readonly booking = computed(() => this.game.state()?.player.linerBooking ?? null);
  private readonly connections = computed(() => {
    const s = this.game.state();
    const id = this.here();
    return s && id ? connectionsFrom(s, id) : [];
  });

  protected connectionTo(to: CityId): Connection | undefined {
    return this.connections().find((c) => c.destination === to);
  }

  protected date(tick: number): string {
    return formatDate(tick);
  }

  protected lineName(id: LineId): string {
    return LINES[id].name;
  }

  protected goodName(g: GoodId): string {
    return GOODS[g].name;
  }

  protected book(lineId: LineId, to: CityId): void {
    const from = this.here();
    if (!from) return;
    const cargo = this.withCargo()
      ? {
          good: this.good(),
          amount: this.amount(),
          from: resolveOption(storageOptions(this.game, from), this.storageKey()),
        }
      : undefined;
    this.game.send(
      cargo
        ? { type: 'BookLiner', lineId, destination: to, cargo }
        : { type: 'BookLiner', lineId, destination: to },
    );
  }

  protected cityName(id: CityId): string {
    return CITIES[id].name;
  }

  protected fare(from: CityId, to: CityId): number {
    const s = this.game.state();
    return s ? passageFare(from, to, CHARACTERS[s.player.characterId].freightFactor) : 0;
  }

  protected days(from: CityId, to: CityId): number {
    return travelDays(from, to, PASSAGE.speedPerDay);
  }

  protected shipDays(id: ShipId, from: CityId, to: CityId): number {
    const ship = this.game.state()?.ships[id];
    return ship ? shipTravelDays(ship, from, to) : 0;
  }

  protected cargo(from: CityId, to: CityId): number {
    const s = this.game.state();
    return s ? cargoFee(s, from, to, this.amount()) : 0;
  }

  protected travel(to: CityId, shipId?: ShipId): void {
    const result = this.game.send(
      shipId ? { type: 'Travel', destination: to, shipId } : { type: 'Travel', destination: to },
    );
    if (result.ok) this.game.closePanel();
  }

  protected ship(from: CityId, to: CityId): void {
    this.game.send({
      type: 'ShipCargo',
      good: this.good(),
      amount: this.amount(),
      destination: to,
      from: resolveOption(storageOptions(this.game, from), this.storageKey()),
    });
  }
}
