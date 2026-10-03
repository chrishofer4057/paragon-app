import { BUSINESSES } from '../data/businesses';
import type { CharacterId } from '../data/characters';
import { CITIES, type CityId } from '../data/cities';
import { GOOD_IDS, GOODS, type GoodId } from '../data/goods';
import { RANKS, type RankId } from '../data/ranks';
import { applyCommand, createNewGame, tick } from '../engine';
import type { Command } from '../commands/commands';
import { businessOptions, currentCityId } from '../selectors';
import type { GameState } from '../state/gameState';
import { connectionsFrom, linerCargoFee } from '../systems/liners';
import { buyPrice, quoteBuy, quoteSell } from '../systems/prices';
import { hasPermission } from '../systems/ranks';
import { effectiveReputation } from '../systems/reputation';
import { amountOf, totalAmount, type StorageRef } from '../systems/storage';
import { guildFee } from '../commands/handlers/civic';
import { infrastructureLimit } from '../commands/handlers/building';
import { HOURS_PER_DAY } from '../time';

/**
 * Ein einfacher Spieler-Bot fürs Balancing. Er nutzt nur die öffentliche Schnittstelle
 * (applyCommand, tick, Selektoren) und spielt "vernünftig, aber nicht genial":
 * Handarbeit → Marktstand → Handel per Linienschiff → Kontor → Betriebe → Stiftungen.
 */

export interface CareerReport {
  rankDays: Partial<Record<RankId, number>>;
  timeline: string[];
  finalMoney: number;
  finalNetWorth: number;
  businesses: number;
  failedCommands: Record<string, number>;
}

class Bot {
  readonly state: GameState;
  readonly report: CareerReport = {
    rankDays: {},
    timeline: [],
    finalMoney: 0,
    finalNetWorth: 0,
    businesses: 0,
    failedCommands: {},
  };
  private lastRank: RankId = 'dayLaborer';
  private readonly startDay: number;

  constructor(seed: number, characterId: CharacterId) {
    this.state = createNewGame({ seed, characterId });
    this.startDay = Math.floor(this.state.tick / HOURS_PER_DAY);
  }

  private get day(): number {
    return Math.floor(this.state.tick / HOURS_PER_DAY) - this.startDay;
  }

  private send(command: Command): boolean {
    const { result } = applyCommand(this.state, command);
    if (!result.ok)
      this.report.failedCommands[command.type] = (this.report.failedCommands[command.type] ?? 0) + 1;
    return result.ok && result.tag !== 'hesitant' && result.tag !== 'offended';
  }

  private wait(hours: number): void {
    tick(this.state, hours);
  }

  private home(): CityId {
    return this.state.player.homeCityId;
  }

  private where(): CityId | null {
    return currentCityId(this.state);
  }

  private log(text: string): void {
    this.report.timeline.push(`Tag ${this.day}: ${text}`);
  }

  private trackRank(): void {
    const rank = this.state.player.rank;
    if (rank !== this.lastRank) {
      this.lastRank = rank;
      this.report.rankDays[rank] = this.day;
      const rep = effectiveReputation(this.state, this.home());
      this.log(
        `${RANKS[rank].name} (Vermögen ${Math.round(this.state.player.netWorth)}, Ansehen ${rep.social.toFixed(1)}/${rep.societal.toFixed(1)})`,
      );
    }
  }

  /** Ein Spieltag (der Bot startet morgens um 7 Uhr). */
  playDay(): void {
    const p = this.state.player;
    if (p.location.kind === 'travel') {
      this.wait(HOURS_PER_DAY);
      this.trackRank();
      return;
    }
    const here = this.where()!;
    this.upkeep(here);
    if (!p.linerBooking) {
      if (this.trading(here)) {
        this.endDay();
        return;
      }
      this.invest(here);
      this.labor(here);
    }
    this.endDay();
  }

  private endDay(): void {
    const toMorning =
      (HOURS_PER_DAY + 7 - (this.state.tick % HOURS_PER_DAY)) % HOURS_PER_DAY || HOURS_PER_DAY;
    this.wait(toMorning);
    this.trackRank();
  }

  /** Beten, baden, Gilde, Hafenlager leeren. */
  private upkeep(here: CityId): void {
    const p = this.state.player;
    if (this.state.tick - p.lastPrayerTick > 14 * HOURS_PER_DAY) {
      this.send({ type: 'Pray' });
      this.wait(1);
    }
    if (this.state.tick - p.lastBathTick > 14 * HOURS_PER_DAY) {
      this.send({ type: 'TakeBath' });
      this.wait(2);
    }
    const hold = p.holds[here];
    if (hold) {
      for (const good of Object.keys(hold) as GoodId[]) {
        const amount = Math.floor(amountOf(hold, good));
        if (amount > 0) this.sellBest(here, good, amount, { kind: 'hold', cityId: here });
      }
    }
    if (
      hasPermission(this.state, 'buildBusinesses') &&
      !p.guilds.includes(this.home()) &&
      here === this.home() &&
      guildFee(this.state, here) < p.money * 0.3
    ) {
      if (this.send({ type: 'JoinGuild' })) this.log('Gilde beigetreten');
    }
  }

  /** Erst feilschen, dann notfalls zum Marktpreis verkaufen. */
  private sellBest(city: CityId, good: GoodId, amount: number, from: StorageRef): void {
    if (hasPermission(this.state, 'tradeFreely')) {
      const unit = quoteSell(this.state.cities[city], good, amount) / amount;
      if (
        this.send({
          type: 'Haggle',
          good,
          amount,
          direction: 'sell',
          pricePerUnit: unit * 1.05,
          storage: from,
        })
      )
        return;
    }
    this.send({ type: 'SellGoods', good, amount, from });
  }

  /** Tagelöhnerarbeit: Holz hacken, Tagesjobs, am Stand verkaufen. */
  private labor(here: CityId): void {
    const p = this.state.player;
    if (hasPermission(this.state, 'buildBusinesses') && Object.keys(p.businesses).length > 0) return;
    const job = this.state.cities[here].tavern.dayJobs[0];
    if (job && this.day % 2 === 0) {
      this.send({ type: 'WorkDayJob', jobId: job.id });
      this.wait(8);
    } else {
      for (let i = 0; i < 4; i++) {
        this.send({ type: 'ChopWood', quality: 0.75 });
        this.wait(2);
      }
    }
    const wood = Math.floor(amountOf(p.inventory, 'Wood'));
    if (wood <= 0) return;
    if (hasPermission(this.state, 'rentStall')) {
      const stall = p.stalls[here];
      if (!stall || stall.paidUntilTick <= this.state.tick) this.send({ type: 'RentStall' });
      let sold = 0;
      while (
        sold < wood &&
        this.send({ type: 'SellAtStall', good: 'Wood', amount: 1, from: { kind: 'inventory' } })
      ) {
        sold += 1;
        this.wait(1);
      }
    }
    const rest = Math.floor(amountOf(p.inventory, 'Wood'));
    if (rest > 0) this.sellBest(here, 'Wood', rest, { kind: 'inventory' });
  }

  /** Arbitrage per Linienschiff mit gemietetem Frachtraum. */
  private trading(here: CityId): boolean {
    const p = this.state.player;
    if (!hasPermission(this.state, 'rentCargo') || p.money < 1500) return false;
    // Nicht ewig wegbleiben, wenn zu Hause Betriebe warten
    const budget = Math.min(p.money * 0.6, 20_000 + p.netWorth * 0.05);
    let best: {
      good: GoodId;
      amount: number;
      lineId: Parameters<typeof linerCargoFee>[1];
      destination: CityId;
      profit: number;
    } | null = null;
    for (const c of connectionsFrom(this.state, here)) {
      if (c.departTick - this.state.tick > 3 * HOURS_PER_DAY) continue;
      const there = this.state.cities[c.destination];
      for (const good of GOOD_IDS) {
        const city = this.state.cities[here];
        const unit = buyPrice(city, good);
        let amount = Math.floor(Math.min(city.market[good] * 0.5, budget / unit, 80));
        while (amount >= 3) {
          const cost =
            quoteBuy(city, good, amount) + linerCargoFee(this.state, c.lineId, here, c.destination, amount);
          const revenue = quoteSell(there, good, amount) * 1.03;
          const profit = revenue - cost - c.fare;
          if (profit > (best?.profit ?? 150))
            best = { good, amount, lineId: c.lineId, destination: c.destination, profit };
          amount = Math.floor(amount / 2);
        }
      }
    }
    if (!best) return false;
    const into = p.kontors[here]
      ? ({ kind: 'kontor', cityId: here } as const)
      : ({ kind: 'inventory' } as const);
    const amount =
      into.kind === 'inventory'
        ? Math.min(best.amount, 20 - Math.floor(totalAmount(p.inventory)))
        : best.amount;
    if (amount < 3) return false;
    if (!this.send({ type: 'BuyGoods', good: best.good, amount, into })) return false;
    const ok = this.send({
      type: 'BookLiner',
      lineId: best.lineId,
      destination: best.destination,
      cargo: { good: best.good, amount, from: into },
    });
    if (ok && this.report.timeline.filter((t) => t.includes('Handel')).length < 5) {
      this.log(
        `Handel: ${amount} ${GOODS[best.good].name} nach ${CITIES[best.destination].name} (erwartet +${Math.round(best.profit)} GS)`,
      );
    }
    return ok;
  }

  /** Kontor, Betriebe, Verwalter, Stiftungen – nur in der Heimatstadt. */
  private invest(here: CityId): void {
    const p = this.state.player;
    if (here !== this.home()) {
      // nach Hause fahren, wenn genug Geld für Investitionen da ist
      if (hasPermission(this.state, 'buildBusinesses') && p.money > 15_000 && !p.linerBooking) {
        const c = connectionsFrom(this.state, here).find((x) => x.destination === this.home());
        if (c) this.send({ type: 'BookLiner', lineId: c.lineId, destination: this.home() });
        else this.send({ type: 'Travel', destination: this.home() });
      }
      return;
    }
    if (hasPermission(this.state, 'foundKontor') && !p.kontors[here] && p.money > 6000) {
      if (this.send({ type: 'FoundKontor' })) this.log('Kontor in Auftrag gegeben');
    }
    const kontor = p.kontors[here];
    if (!kontor) return;
    if (hasPermission(this.state, 'buildBusinesses') && p.money > 15_000) {
      const options = businessOptions(this.state, here).filter((b) => b.effective && b.allowed);
      // einfache Rendite: Ausstoßwert zu aktuellen Preisen minus Kosten
      let best: { type: (typeof options)[number]['type']; margin: number } | null = null;
      for (const o of options) {
        const def = BUSINESSES[o.type];
        let value = 0;
        for (const [g, a] of Object.entries(def.outputs) as [GoodId, number][])
          value += a * buyPrice(this.state.cities[here], g) * 0.85;
        for (const [g, a] of Object.entries(def.inputs) as [GoodId, number][])
          value -= a * buyPrice(this.state.cities[here], g);
        const margin = value - def.wagesPerWeek - 280 - o.owned * 150;
        if (margin > (best?.margin ?? 200)) best = { type: o.type, margin };
      }
      if (best && this.send({ type: 'BuildBusiness', businessType: best.type })) {
        this.log(`Betrieb gebaut: ${BUSINESSES[best.type].name}`);
      }
    }
    if (hasPermission(this.state, 'hireManager') && !kontor.manager && p.money > 3000) {
      if (this.send({ type: 'HireManager' })) this.log('Verwalter eingestellt');
    }
    if (kontor.manager) {
      // alle eigenen Erzeugnisse verkaufen, Rohstoffe der Betriebe zukaufen
      for (const b of Object.values(p.businesses)) {
        const def = BUSINESSES[b.type];
        for (const g of Object.keys(def.outputs) as GoodId[]) {
          if (!kontor.manager.orders[g]) {
            this.send({
              type: 'SetStandingOrder',
              cityId: here,
              good: g,
              order: { buyBelow: null, buyUpTo: 0, sellAbove: GOODS[g].basePrice * 0.7, keepMin: 0 },
            });
          }
        }
        for (const [g, a] of Object.entries(def.inputs) as [GoodId, number][]) {
          this.send({
            type: 'SetStandingOrder',
            cityId: here,
            good: g,
            order: { buyBelow: GOODS[g].basePrice * 1.4, buyUpTo: a * 3, sellAbove: null, keepMin: 0 },
          });
        }
      }
    }
    // Stiftungen für Ansehen, wenn reichlich Geld
    if (hasPermission(this.state, 'fundInfrastructure') && p.money > 60_000) {
      for (const infra of ['well', 'chapel', 'hospital', 'road', 'school', 'mint'] as const) {
        const city = this.state.cities[here];
        if (city.infrastructure[infra] < infrastructureLimit(this.state, here, infra)) {
          if (this.send({ type: 'FundInfrastructure', infrastructure: infra }))
            this.log(`gestiftet: ${infra}`);
          break;
        }
      }
    }
    if (p.money > 120_000 && this.day % 30 === 0) this.send({ type: 'Donate', amount: 5000 });
  }
}

export function runCareer(seed: number, characterId: CharacterId, days: number): CareerReport {
  const bot = new Bot(seed, characterId);
  for (let d = 0; d < days; d++) bot.playDay();
  bot.report.finalMoney = Math.round(bot.state.player.money);
  bot.report.finalNetWorth = Math.round(bot.state.player.netWorth);
  bot.report.businesses = Object.keys(bot.state.player.businesses).length;
  return bot.report;
}
