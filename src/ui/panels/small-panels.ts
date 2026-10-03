import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { GameService } from '../../bridge/game.service';
import { LENDER } from '../../sim/data/balance';
import { FESTIVAL_GOODS_PER_1000, MARKET_STALL } from '../../sim/data/buildings';
import { GOOD_IDS, GOODS, type GoodId } from '../../sim/data/goods';
import { bribeCost, guildFee } from '../../sim/commands/handlers/civic';
import { stallAllowance } from '../../sim/commands/handlers/trade';
import { canDo, possessionsView } from '../../sim/selectors';
import { expectedGuests } from '../../sim/systems/festival';
import { creditLimit } from '../../sim/systems/lender';
import { hasLocalPermission } from '../../sim/systems/ranks';
import { amountOf, resolveStorage } from '../../sim/systems/storage';
import type { LoanId } from '../../sim/state/ids';
import { FORMAT_PIPES } from '../shared/format';
import { PanelFrame } from '../shared/panel-frame';
import { StoragePicker, resolveOption, storageOptions } from '../shared/storage-picker';
import { useCity } from '../shared/use-city';

/** Badehaus (Tippsammlung 2.1.1.6). */
@Component({
  selector: 'app-bathhouse-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PanelFrame, ...FORMAT_PIPES],
  template: `
    <app-panel-frame title="Badehaus" subtitle="Reinheit für Leib und Ruf">
      <h3>Ein Bad nehmen</h3>
      <div class="row-item">
        <span
          >Mindestens alle drei Wochen – sonst drohen willkürliche Anklagen.
          <span class="muted">Zuletzt vor {{ daysSinceBath() }} Tagen.</span></span
        >
        <button type="button" (click)="game.send({ type: 'TakeBath' })">Baden (2 Std.)</button>
      </div>
      <h3>Jemanden bestechen</h3>
      <p class="muted">
        Gekaufte Ratsherren stimmen bei der nächsten Schultheiss-Wahl für Euch – danach sind die Stimmen
        verbraucht. Nicht jeden Tag ist ein empfänglicher Ratsherr anwesend.
      </p>
      <div class="row-item">
        <span>Bereits gekaufte Stimmen hier: {{ votes() }}</span>
        <button type="button" (click)="game.send({ type: 'Bribe' })">Bestechen ({{ cost() | gold }})</button>
      </div>
    </app-panel-frame>
  `,
})
export class BathhousePanel {
  protected readonly game = inject(GameService);
  private readonly cityId = useCity(this.game).cityId;
  protected readonly daysSinceBath = computed(() => {
    const s = this.game.state();
    return s ? Math.floor((s.tick - s.player.lastBathTick) / 24) : 0;
  });
  protected readonly cost = computed(() => {
    const s = this.game.state();
    const id = this.cityId();
    return s && id ? bribeCost(s, id) : 0;
  });
  protected readonly votes = computed(() => {
    const s = this.game.state();
    const id = this.cityId();
    return s && id ? s.cities[id].bribeVotes : 0;
  });
}

/** Gildenhaus (Tippsammlung 2.1.1.2). */
@Component({
  selector: 'app-guild-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PanelFrame, ...FORMAT_PIPES],
  template: `
    <app-panel-frame title="Gildenhaus" subtitle="Die gehobene Gesellschaft der Kaufleute">
      @if (member()) {
        <p>Ihr seid Mitglied der Gilde dieser Stadt. Das bringt Euch Ansehen bei den Reichen.</p>
      } @else {
        <p>
          Ohne Mitgliedschaft in der Gilde Eurer Heimatstadt kommt Ihr nicht über den Kaufmann hinaus. Die
          Gebühr richtet sich nach Eurem Vermögen – wer früh beitritt, zahlt weniger.
        </p>
        <button type="button" (click)="game.send({ type: 'JoinGuild' })">
          Beitreten ({{ fee() | gold }})
        </button>
      }
      <h3>Eure Mitgliedschaften</h3>
      <p>{{ memberships() || 'keine' }}</p>
    </app-panel-frame>
  `,
})
export class GuildPanel {
  protected readonly game = inject(GameService);
  private readonly cityId = useCity(this.game).cityId;
  protected readonly member = computed(() => {
    const s = this.game.state();
    const id = this.cityId();
    return !!s && !!id && s.player.guilds.includes(id);
  });
  protected readonly fee = computed(() => {
    const s = this.game.state();
    const id = this.cityId();
    return s && id ? guildFee(s, id) : 0;
  });
  protected readonly memberships = computed(() => this.game.state()?.player.guilds.join(', ') ?? '');
}

/** Geldverleiher (Darlehensgeber, Tippsammlung 2.1.1.5). */
@Component({
  selector: 'app-lender-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PanelFrame, DecimalPipe, ...FORMAT_PIPES],
  template: `
    <app-panel-frame title="Geldverleiher" subtitle="Zinsen gelten pro Woche – zurückgezahlt wird am Stück">
      <h3>Darlehen aufnehmen</h3>
      <p class="muted">
        Kreditrahmen: {{ limit() | gold }} · höchstens {{ maxLoans }} Darlehen gleichzeitig.
      </p>
      <div class="row-item">
        <input
          class="qty wide"
          type="number"
          min="1"
          [value]="amount()"
          (input)="amount.set($any($event.target).valueAsNumber || 0)"
        />
        @for (t of terms; track $index) {
          <button
            type="button"
            (click)="game.send({ type: 'TakeLoan', termIndex: $index, amount: amount() })"
          >
            {{ t.weeks }} Wochen · {{ t.weeklyRate * 100 | number: '1.1-1' }} %/Wo.
          </button>
        }
      </div>
      <h3>Eure Schulden</h3>
      @for (l of view().loans; track l.id) {
        <div class="row-item">
          <span>{{ l.cityName }}: {{ l.owed | gold }}, fällig in {{ l.dueIn }} Tagen</span>
          <button type="button" (click)="game.send({ type: 'RepayLoan', loanId: asLoan(l.id) })">
            Tilgen
          </button>
        </div>
      } @empty {
        <p class="muted">Keine.</p>
      }
      <h3>Kreditwünsche von Bürgern</h3>
      @for (o of offers(); track o.id) {
        <div class="row-item">
          <span
            >{{ o.borrowerName }} möchte {{ o.amount | gold }} für {{ o.weeks }} Wochen zu
            {{ o.weeklyRate * 100 | number: '1.1-1' }} %/Wo.</span
          >
          <button type="button" (click)="game.send({ type: 'GrantLoan', offerId: o.id })">Verleihen</button>
        </div>
      } @empty {
        <p class="muted">Diese Woche fragt niemand.</p>
      }
      @if (view().lent.length > 0) {
        <h3>Verliehen</h3>
        @for (l of view().lent; track l.id) {
          <div class="row-item">
            <span
              >{{ l.borrower }}: {{ l.principal | gold
              }}{{ l.defaulted ? ' – zahlt nicht!' : ', fällig in ' + l.dueIn + ' Tagen' }}</span
            >
            @if (l.defaulted) {
              <button
                type="button"
                (click)="game.send({ type: 'ResolveDefault', loanId: asLoan(l.id), choice: 'seize' })"
              >
                Pfänden
              </button>
              <button
                type="button"
                (click)="game.send({ type: 'ResolveDefault', loanId: asLoan(l.id), choice: 'forgive' })"
              >
                Erlassen
              </button>
            }
          </div>
        }
      }
    </app-panel-frame>
  `,
})
export class LenderPanel {
  protected readonly game = inject(GameService);
  private readonly cityId = useCity(this.game).cityId;
  protected readonly terms = LENDER.terms;
  protected readonly maxLoans = LENDER.maxLoans;
  protected readonly amount = signal(500);
  protected readonly limit = computed(() => {
    const s = this.game.state();
    return s ? creditLimit(s) : 0;
  });
  protected readonly view = computed(() => possessionsView(this.game.state()!));
  protected readonly offers = computed(() => {
    const s = this.game.state();
    const id = this.cityId();
    return s && id ? s.cities[id].borrowerOffers : [];
  });

  protected asLoan(id: string): LoanId {
    return id as LoanId;
  }
}

/** Stadttor: Landesherr (Landesfürst, Tippsammlung 6.5.1). */
@Component({
  selector: 'app-gate-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PanelFrame, StoragePicker, ...FORMAT_PIPES],
  template: `
    <app-panel-frame title="Stadttor" subtitle="Handel mit dem Landesherrn">
      @if (cityId(); as id) {
        @if (allowed()) {
          <app-storage-picker [cityId]="id" [(selected)]="storageKey" label="Aus:" />
          @for (d of demands(); track d.good) {
            <div class="row-item">
              <span>{{ goodName(d.good) }}: noch {{ d.remaining }} zu je {{ d.pricePerUnit | gold }}</span>
              <input
                class="qty"
                type="number"
                min="1"
                [value]="amount()"
                (input)="amount.set($any($event.target).valueAsNumber || 1)"
              />
              <button type="button" (click)="sell(d.good)">Verkaufen</button>
            </div>
          }
        } @else {
          <p>Die Wachen lassen Euch nicht zum Landesherrn vor. Er empfängt nur Ratsherren dieser Stadt.</p>
          <p class="muted">Er fragt diesen Monat nach: {{ demandNames() }}.</p>
        }
      }
    </app-panel-frame>
  `,
})
export class GatePanel {
  protected readonly game = inject(GameService);
  protected readonly cityId = useCity(this.game).cityId;
  protected readonly storageKey = signal('inventory');
  protected readonly amount = signal(10);
  protected readonly allowed = computed(() => {
    const s = this.game.state();
    const id = this.cityId();
    return !!s && !!id && hasLocalPermission(s, id, 'gateTrade');
  });
  protected readonly demands = computed(() => {
    const s = this.game.state();
    const id = this.cityId();
    return s && id ? s.cities[id].gate : [];
  });
  protected readonly demandNames = computed(() =>
    this.demands()
      .map((d) => GOODS[d.good].name)
      .join(', '),
  );

  protected goodName(g: GoodId): string {
    return GOODS[g].name;
  }

  protected sell(good: GoodId): void {
    const id = this.cityId();
    if (!id) return;
    this.game.send({
      type: 'SellToLord',
      good,
      amount: this.amount(),
      from: resolveOption(storageOptions(this.game, id), this.storageKey()),
    });
  }
}

/** Marktplatz: eigener Stand und Feste (Tippsammlung 2.1.1.12, CLAUDE.md §2.4). */
@Component({
  selector: 'app-marketplace-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PanelFrame, StoragePicker, ...FORMAT_PIPES],
  template: `
    <app-panel-frame title="Marktplatz" subtitle="Persönlich verkaufen und Feste feiern">
      @if (cityId(); as id) {
        <h3>Eigener Marktstand</h3>
        @if (stallActive()) {
          <p class="muted">
            Gemietet für {{ stallDays() }} weitere Tage. Ihr erzielt {{ bonus * 100 }} % mehr als beim
            Großhandel, doch die Kundschaft ist begrenzt und jeder Verkauf kostet eine Stunde.
          </p>
          <app-storage-picker [cityId]="id" [(selected)]="storageKey" label="Ware aus:" />
          @for (g of sellable(); track g.good) {
            <div class="row-item">
              <span
                >{{ g.name }}
                <span class="muted"
                  >(vorrätig {{ g.held | qty }}, heute noch {{ g.allowance }} Käufer)</span
                ></span
              >
              <button type="button" [disabled]="g.allowance < 1" (click)="sell(g.good)">1 verkaufen</button>
            </div>
          } @empty {
            <p class="muted">Ihr habt nichts dabei, was sich hier verkaufen ließe.</p>
          }
        } @else {
          <p>Ein eigener Stand bringt bessere Preise als der Großhandel – kostet aber Zeit.</p>
          <button type="button" [disabled]="!canRent()" (click)="game.send({ type: 'RentStall' })">
            Stand mieten ({{ rent | gold }}/Woche)
          </button>
          @if (!canRent()) {
            <p class="muted">Erst als Krämer.</p>
          }
        }

        <h3>Fest ausrichten</h3>
        @if (festivalIn() !== null) {
          <p>Euer Fest findet in {{ festivalIn() }} Tagen statt. Haltet im Kontor bereit:</p>
        } @else {
          <p class="muted">
            Ein Fest wird drei Wochen vorher angekündigt und aus Eurem Kontor bewirtet. Erwartete Gäste:
            {{ guests() }}.
          </p>
          <button type="button" (click)="game.send({ type: 'AnnounceFestival' })">Fest ankündigen</button>
        }
        <ul class="compact">
          @for (f of festivalNeeds(); track f.name) {
            <li>
              {{ f.name }}: {{ f.amount | qty }} <span class="muted">(im Kontor {{ f.have | qty }})</span>
            </li>
          }
        </ul>
      }
    </app-panel-frame>
  `,
})
export class MarketplacePanel {
  protected readonly game = inject(GameService);
  protected readonly cityId = useCity(this.game).cityId;
  protected readonly storageKey = signal('inventory');
  protected readonly rent = MARKET_STALL.rentPerWeek;
  protected readonly bonus = MARKET_STALL.priceBonus;
  protected readonly canRent = computed(() => !!this.game.state() && canDo(this.game.state()!, 'rentStall'));
  private readonly stall = computed(() => {
    const s = this.game.state();
    const id = this.cityId();
    return s && id ? s.player.stalls[id] : undefined;
  });
  protected readonly stallActive = computed(() => {
    const s = this.game.state();
    const st = this.stall();
    return !!s && !!st && st.paidUntilTick > s.tick;
  });
  protected readonly stallDays = computed(() => {
    const s = this.game.state();
    const st = this.stall();
    return s && st ? Math.ceil((st.paidUntilTick - s.tick) / 24) : 0;
  });
  protected readonly sellable = computed(() => {
    const s = this.game.state();
    const id = this.cityId();
    if (!s || !id) return [];
    const storage = resolveStorage(s, resolveOption(storageOptions(this.game, id), this.storageKey()));
    if (!storage) return [];
    return GOOD_IDS.filter((g) => amountOf(storage, g) >= 1).map((g) => ({
      good: g,
      name: GOODS[g].name,
      held: amountOf(storage, g),
      allowance: stallAllowance(s, id, g),
    }));
  });
  protected readonly festivalIn = computed(() => {
    const s = this.game.state();
    const id = this.cityId();
    const f = s && id ? s.cities[id].festival : null;
    return s && f ? Math.ceil((f.tick - s.tick) / 24) : null;
  });
  protected readonly guests = computed(() => {
    const s = this.game.state();
    const id = this.cityId();
    return s && id ? expectedGuests(s, id) : 0;
  });
  protected readonly festivalNeeds = computed(() => {
    const s = this.game.state();
    const id = this.cityId();
    if (!s || !id) return [];
    const kontor = s.player.kontors[id];
    return (Object.entries(FESTIVAL_GOODS_PER_1000) as [GoodId, number][]).map(([g, per1000]) => ({
      name: GOODS[g].name,
      amount: (per1000 * this.guests()) / 1000,
      have: kontor ? amountOf(kontor.storage, g) : 0,
    }));
  });

  protected sell(good: GoodId): void {
    const id = this.cityId();
    if (!id) return;
    this.game.send({
      type: 'SellAtStall',
      good,
      amount: 1,
      from: resolveOption(storageOptions(this.game, id), this.storageKey()),
    });
  }
}
