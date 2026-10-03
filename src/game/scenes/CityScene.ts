import Phaser from 'phaser';
import type { GameBridge } from '../../bridge/bridge';
import type { GatherActivity } from '../../sim/commands/commands';
import { CITIES, type CityId } from '../../sim/data/cities';
import { GATHERING } from '../../sim/data/balance';
import { GOODS } from '../../sim/data/goods';
import type { SimEvent } from '../../sim/events/events';
import { clockView } from '../../sim/selectors';
import { shipInPort } from '../../sim/systems/storage';
import { drawBuilding, tileKey } from '../art';
import {
  buildCityLayout,
  isWalkable,
  TILE,
  type CityLayout,
  type GatherSpot,
  type PlacedBuilding,
} from '../cityLayout';
import { markerPosition, reactionQuality, timingQuality } from '../minigameLogic';

const PLAYER_SPEED = 170;
const INTERACT_RANGE = TILE * 1.4;

type Target = { kind: 'building'; building: PlacedBuilding } | { kind: 'spot'; spot: GatherSpot };

interface Minigame {
  activity: GatherActivity;
  spot: GatherSpot;
  started: number;
  /** Zeitspiel: Zone; Angeln: Zeitpunkt des Bisses. */
  zoneCenter: number;
  zoneHalf: number;
  biteAt: number;
  container: Phaser.GameObjects.Container;
  marker: Phaser.GameObjects.Rectangle | null;
  hint: Phaser.GameObjects.Text;
}

const ACTIVITY_NAMES: Record<GatherActivity, string> = {
  wood: 'Holz hacken',
  stone: 'Stein brechen',
  fish: 'Angeln',
  herbs: 'Kräuter sammeln',
  faerybloom: 'Feenblüten pflücken',
};

/** Begehbare Stadt mit Umland (CLAUDE.md §5.3). Liest Zustand, sendet Commands. */
export class CityScene extends Phaser.Scene {
  private bridge!: GameBridge;
  private layout!: CityLayout;
  private cityId!: CityId;
  private signature = '';
  private player!: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody;
  private keys!: Record<
    'up' | 'down' | 'left' | 'right' | 'w' | 'a' | 's' | 'd' | 'e' | 'space',
    Phaser.Input.Keyboard.Key
  >;
  private prompt!: Phaser.GameObjects.Text;
  private busyBar!: Phaser.GameObjects.Graphics;
  private night!: Phaser.GameObjects.Rectangle;
  private minigame: Minigame | null = null;
  private usedSpots = new Set<string>();
  private spotSprites = new Map<string, Phaser.GameObjects.Image>();
  private target: Target | null = null;
  private unsubscribe: (() => void) | null = null;

  constructor() {
    super('city');
  }

  init(data: { bridge: GameBridge }): void {
    this.bridge = data.bridge;
    this.minigame = null;
    this.target = null;
  }

  /** Signatur des Besitzes, der den Grundriss beeinflusst – ändert sie sich, wird neu aufgebaut. */
  static signatureOf(bridge: GameBridge): string {
    const state = bridge.getState();
    const loc = state.player.location;
    if (loc.kind !== 'city') return 'travel';
    const c = loc.cityId;
    const businesses = Object.values(state.player.businesses).filter((b) => b.cityId === c).length;
    const houses = Object.values(state.player.houses).filter((h) => h.cityId === c).length;
    return `${c}|${state.player.kontors[c] ? 1 : 0}|${businesses}|${houses}`;
  }

  create(): void {
    const state = this.bridge.getState();
    const loc = state.player.location;
    if (loc.kind !== 'city') return;
    this.cityId = loc.cityId;
    this.signature = CityScene.signatureOf(this.bridge);
    const def = CITIES[this.cityId];
    const c = this.cityId;
    this.layout = buildCityLayout(c, def.culture, {
      hasKontor: state.player.kontors[c] !== undefined,
      businesses: Object.values(state.player.businesses).filter((b) => b.cityId === c).length,
      houses: Object.values(state.player.houses).filter((h) => h.cityId === c).length,
    });

    this.drawTerrain();
    this.drawBuildings();
    this.drawNature();
    this.drawShips();
    this.createPlayer();
    this.createWalkers();
    this.createOverlay();

    const keyboard = this.input.keyboard!;
    const add = (code: number) => keyboard.addKey(code, false);
    const K = Phaser.Input.Keyboard.KeyCodes;
    this.keys = {
      up: add(K.UP),
      down: add(K.DOWN),
      left: add(K.LEFT),
      right: add(K.RIGHT),
      w: add(K.W),
      a: add(K.A),
      s: add(K.S),
      d: add(K.D),
      e: add(K.E),
      space: add(K.SPACE),
    };
    this.input.on('pointerdown', () => this.onAction());

    this.unsubscribe = this.bridge.onEvents((events) => this.onSimEvents(events));
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.unsubscribe?.());

    const worldW = this.layout.cols * TILE;
    const worldH = this.layout.rows * TILE;
    this.physics.world.setBounds(0, 0, worldW, worldH);
    this.cameras.main.setBounds(0, 0, worldW, worldH).startFollow(this.player, true, 0.12, 0.12);
    this.cameras.main.setBackgroundColor(0x1f6f9f);
    this.cameras.main.fadeIn(300);
  }

  // --- Aufbau ------------------------------------------------------------

  private drawTerrain(): void {
    const { terrain, culture } = this.layout;
    terrain.forEach((row, y) =>
      row.forEach((t, x) => {
        this.add
          .image(x * TILE, y * TILE, tileKey(t, culture))
          .setOrigin(0)
          .setDepth(-10);
      }),
    );
    // Wasser leicht bewegen
    const shimmer = this.add
      .rectangle(0, 29 * TILE, this.layout.cols * TILE, 7 * TILE, 0xffffff, 0.04)
      .setOrigin(0)
      .setDepth(-9);
    this.tweens.add({
      targets: shimmer,
      alpha: { from: 0.0, to: 0.08 },
      duration: 2200,
      yoyo: true,
      repeat: -1,
    });

    const water = this.physics.add.staticGroup();
    const shoreY = 29 * TILE;
    const addBlock = (x: number, y: number, w: number, h: number) => {
      const zone = this.add.zone(x + w / 2, y + h / 2, w, h);
      water.add(zone);
    };
    addBlock(0, shoreY, 23 * TILE, 7 * TILE);
    addBlock(25 * TILE, shoreY, 23 * TILE, 7 * TILE);
    addBlock(23 * TILE, 34 * TILE, 2 * TILE, 2 * TILE);
    this.registry.set('waterGroup', water);
  }

  private drawBuildings(): void {
    const solids = this.physics.add.staticGroup();
    for (const b of this.layout.buildings) {
      const g = this.add.graphics();
      drawBuilding(g, b, this.layout.culture);
      g.setDepth((b.y + b.h) * TILE);
      if (b.kind !== 'stall' && b.kind !== 'lot') {
        solids.add(
          this.add.zone((b.x + b.w / 2) * TILE, (b.y + b.h / 2) * TILE + 6, b.w * TILE - 8, b.h * TILE - 12),
        );
      }
      if (b.label) {
        const label = this.add
          .text((b.x + b.w / 2) * TILE, b.y * TILE - (b.kind === 'stall' ? 14 : 24), b.label, {
            fontFamily: 'Georgia, serif',
            fontSize: b.kind === 'house' || b.kind === 'stall' ? '11px' : '13px',
            color: '#fff8e7',
            backgroundColor: '#3b2a1acc',
            padding: { x: 5, y: 2 },
          })
          .setOrigin(0.5, 1)
          .setDepth(5000);
        if (b.kind === 'house' && !b.panel) label.setVisible(false);
      }
    }
    this.registry.set('solidGroup', solids);
  }

  private drawNature(): void {
    const culture = this.layout.culture;
    for (const d of this.layout.decorations) {
      const px = d.x * TILE + TILE / 2;
      const py = d.y * TILE + TILE;
      const key = d.kind === 'tree' ? `tree-${culture}` : d.kind === 'flower' ? `flower${d.variant}` : d.kind;
      this.add.image(px, py, key).setOrigin(0.5, 1).setDepth(py);
    }
    for (const spot of this.layout.spots) {
      const px = spot.x * TILE + TILE / 2;
      const py = spot.y * TILE + TILE;
      let key: string;
      switch (spot.activity) {
        case 'wood':
          key = `tree-${culture}`;
          break;
        case 'stone':
          key = 'rock';
          break;
        case 'herbs':
          key = 'herb';
          break;
        case 'faerybloom':
          key = 'faeryflower';
          break;
        case 'fish':
          key = '';
          break;
      }
      if (!key) {
        // Fischgrund: kleine Kreise im Wasser
        const ring = this.add
          .circle(px, py + TILE, 10)
          .setStrokeStyle(2, 0xffffff, 0.6)
          .setDepth(py);
        this.tweens.add({
          targets: ring,
          scale: { from: 0.6, to: 1.4 },
          alpha: { from: 1, to: 0 },
          duration: 1600,
          repeat: -1,
        });
        continue;
      }
      const sprite = this.add.image(px, py, key).setOrigin(0.5, 1).setDepth(py);
      this.spotSprites.set(spot.id, sprite);
    }
  }

  private drawShips(): void {
    const state = this.bridge.getState();
    const docked = Object.values(state.ships).filter((s) => shipInPort(s) === this.cityId);
    docked.slice(0, this.layout.berths.length).forEach((ship, i) => {
      const berth = this.layout.berths[i]!;
      const px = berth.x * TILE;
      const py = berth.y * TILE;
      const img = this.add.image(px, py, 'ship').setDepth(py);
      this.tweens.add({
        targets: img,
        y: py + 3,
        duration: 1800 + i * 200,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.inOut',
      });
      this.add
        .text(px, py - 36, ship.name, {
          fontSize: '11px',
          color: '#ffffff',
          backgroundColor: '#00000066',
          padding: { x: 3, y: 1 },
        })
        .setOrigin(0.5)
        .setDepth(5000);
    });
  }

  private createPlayer(): void {
    const spawn = this.layout.spawn;
    // Nach einem Neuaufbau derselben Stadt (z. B. Kontor fertig) bleibt die Figur, wo sie war.
    const last = this.registry.get('lastPosition') as { cityId: CityId; x: number; y: number } | undefined;
    const start =
      last && last.cityId === this.cityId
        ? last
        : { x: spawn.x * TILE + TILE / 2, y: spawn.y * TILE + TILE / 2 };
    this.player = this.physics.add.sprite(start.x, start.y, 'player');
    this.player.setCollideWorldBounds(true);
    this.player.body.setSize(14, 10).setOffset(3, 19);
    this.physics.add.collider(
      this.player,
      this.registry.get('solidGroup') as Phaser.Physics.Arcade.StaticGroup,
    );
    this.physics.add.collider(
      this.player,
      this.registry.get('waterGroup') as Phaser.Physics.Arcade.StaticGroup,
    );
  }

  /** Ein paar Bürger laufen über Straßen und Platz – reine Stimmung. */
  private createWalkers(): void {
    const state = this.bridge.getState();
    const pop = state.cities[this.cityId].population;
    const total = pop.rich + pop.wealthy + pop.poor;
    const count = Math.min(14, Math.max(4, Math.round(total / 450)));
    const points: { x: number; y: number }[] = [];
    for (let y = 0; y < this.layout.rows; y++) {
      for (let x = 0; x < this.layout.cols; x++) {
        const t = this.layout.terrain[y]![x];
        if ((t === 'road' || t === 'plaza') && isWalkable(this.layout, x, y)) points.push({ x, y });
      }
    }
    for (let i = 0; i < count; i++) {
      const r = Math.random() * total;
      const key = r < pop.rich ? 'npc-rich' : r < pop.rich + pop.wealthy ? 'npc-wealthy' : 'npc-poor';
      const start = Phaser.Utils.Array.GetRandom(points);
      const npc = this.add.image(start.x * TILE + 16, start.y * TILE + 16, key).setOrigin(0.5, 1);
      const walk = () => {
        const next = Phaser.Utils.Array.GetRandom(points);
        const tx = next.x * TILE + 16;
        const ty = next.y * TILE + 16;
        const dist = Phaser.Math.Distance.Between(npc.x, npc.y, tx, ty);
        npc.setFlipX(tx < npc.x);
        this.tweens.add({
          targets: npc,
          x: tx,
          y: ty,
          duration: (dist / 40) * 1000,
          delay: Phaser.Math.Between(400, 3000),
          onUpdate: () => npc.setDepth(npc.y),
          onComplete: walk,
        });
      };
      walk();
    }
  }

  private createOverlay(): void {
    const cam = this.cameras.main;
    this.night = this.add
      .rectangle(0, 0, cam.width, cam.height, 0x0b1a3a, 0)
      .setOrigin(0)
      .setScrollFactor(0)
      .setDepth(9000);
    this.prompt = this.add
      .text(cam.width / 2, cam.height - 60, '', {
        fontFamily: 'Georgia, serif',
        fontSize: '16px',
        color: '#fff8e7',
        backgroundColor: '#2b1d10dd',
        padding: { x: 10, y: 6 },
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(9500)
      .setVisible(false);
    this.busyBar = this.add.graphics().setScrollFactor(0).setDepth(9500);
    this.scale.on(Phaser.Scale.Events.RESIZE, (size: Phaser.Structs.Size) => {
      this.night.setSize(size.width, size.height);
      this.prompt.setPosition(size.width / 2, size.height - 60);
    });
  }

  // --- Ablauf --------------------------------------------------------------

  override update(time: number): void {
    if (CityScene.signatureOf(this.bridge) !== this.signature) {
      this.scene.start(this.bridge.getState().player.location.kind === 'travel' ? 'worldmap' : 'city', {
        bridge: this.bridge,
      });
      return;
    }
    const state = this.bridge.getState();
    const clock = clockView(state);
    this.night.setFillStyle(0x0b1a3a, Math.max(0, 0.55 - clock.daylight * 0.75));

    if (this.minigame) {
      this.prompt.setVisible(false);
      this.updateMinigame(time);
      this.player.setVelocity(0);
      return;
    }

    const busy = state.player.busyUntilTick > state.tick;
    this.drawBusy(busy ? state.player.busyUntilTick - state.tick : 0);
    const locked = busy || this.bridge.isPanelOpen();
    const k = this.keys;
    let vx = 0;
    let vy = 0;
    if (!locked) {
      if (k.left.isDown || k.a.isDown) vx -= 1;
      if (k.right.isDown || k.d.isDown) vx += 1;
      if (k.up.isDown || k.w.isDown) vy -= 1;
      if (k.down.isDown || k.s.isDown) vy += 1;
    }
    const len = Math.hypot(vx, vy) || 1;
    this.player.setVelocity((vx / len) * PLAYER_SPEED, (vy / len) * PLAYER_SPEED);
    if (vx !== 0) this.player.setFlipX(vx < 0);
    this.player.setDepth(this.player.y + 14);
    this.registry.set('lastPosition', { cityId: this.cityId, x: this.player.x, y: this.player.y });

    this.target = locked ? null : this.findTarget();
    if (this.target) {
      const text =
        this.target.kind === 'building'
          ? `[E] ${this.target.building.label}`
          : `[E] ${ACTIVITY_NAMES[this.target.spot.activity]}`;
      this.prompt.setText(text).setVisible(true);
    } else {
      this.prompt.setVisible(false);
    }
    if (!locked && (Phaser.Input.Keyboard.JustDown(k.e) || Phaser.Input.Keyboard.JustDown(k.space)))
      this.onAction();
  }

  private drawBusy(hoursLeft: number): void {
    this.busyBar.clear();
    if (hoursLeft <= 0) return;
    const cam = this.cameras.main;
    const x = this.player.x - cam.scrollX - 20;
    const y = this.player.y - cam.scrollY - 40;
    this.busyBar.fillStyle(0x000000, 0.5).fillRect(x, y, 40, 6);
    this.busyBar.fillStyle(0xf2c94c, 1).fillRect(x, y, 40 * Math.min(1, hoursLeft / 8), 6);
  }

  private findTarget(): Target | null {
    let best: Target | null = null;
    let bestDist = INTERACT_RANGE;
    const px = this.player.x;
    const py = this.player.y + 10;
    for (const b of this.layout.buildings) {
      if (!b.panel) continue;
      const d = Phaser.Math.Distance.Between(px, py, b.door.x * TILE + TILE / 2, b.door.y * TILE + TILE / 2);
      if (d < bestDist) {
        best = { kind: 'building', building: b };
        bestDist = d;
      }
    }
    for (const s of this.layout.spots) {
      if (this.usedSpots.has(s.id)) continue;
      const d = Phaser.Math.Distance.Between(px, py, s.x * TILE + TILE / 2, s.y * TILE + TILE / 2);
      if (d < bestDist) {
        best = { kind: 'spot', spot: s };
        bestDist = d;
      }
    }
    return best;
  }

  private onAction(): void {
    if (this.minigame) {
      this.finishMinigame(this.time.now);
      return;
    }
    const target = this.target;
    if (!target || this.bridge.isPanelOpen()) return;
    if (target.kind === 'building' && target.building.panel) {
      this.player.setVelocity(0);
      this.bridge.openPanel(target.building.panel);
    } else if (target.kind === 'spot') {
      this.startMinigame(target.spot);
    }
  }

  // --- Minispiele ------------------------------------------------------------

  private startMinigame(spot: GatherSpot): void {
    const state = this.bridge.getState();
    if (state.player.busyUntilTick > state.tick) return;
    const cam = this.cameras.main;
    const w = 320;
    const container = this.add
      .container(cam.width / 2, cam.height - 120)
      .setScrollFactor(0)
      .setDepth(9600);
    const bg = this.add.rectangle(0, 0, w + 40, 90, 0x2b1d10, 0.92).setStrokeStyle(2, 0xd4ac0d);
    const title = this.add
      .text(0, -32, ACTIVITY_NAMES[spot.activity], {
        fontFamily: 'Georgia, serif',
        fontSize: '16px',
        color: '#fff8e7',
      })
      .setOrigin(0.5);
    container.add([bg, title]);
    const now = this.time.now;
    let marker: Phaser.GameObjects.Rectangle | null = null;
    let zoneCenter = 0;
    let zoneHalf = 0;
    let hintText = '';
    if (spot.activity === 'fish') {
      hintText = 'Wartet auf den Biss … dann [E]!';
    } else {
      zoneHalf = 0.06 + Math.random() * 0.05;
      zoneCenter = zoneHalf + Math.random() * (1 - 2 * zoneHalf);
      const bar = this.add.rectangle(0, 4, w, 18, 0x5a4632).setStrokeStyle(1, 0x000000);
      const zone = this.add.rectangle(-w / 2 + zoneCenter * w, 4, zoneHalf * 2 * w, 18, 0x6fbf4a);
      const sweet = this.add.rectangle(-w / 2 + zoneCenter * w, 4, 4, 18, 0xf2e94e);
      marker = this.add.rectangle(-w / 2, 4, 4, 28, 0xffffff);
      container.add([bar, zone, sweet, marker]);
      hintText = '[E] im grünen Bereich drücken';
    }
    const hint = this.add.text(0, 30, hintText, { fontSize: '12px', color: '#e8dcc0' }).setOrigin(0.5);
    container.add(hint);
    this.minigame = {
      activity: spot.activity,
      spot,
      started: now,
      zoneCenter,
      zoneHalf,
      biteAt: now + 1200 + Math.random() * 2500,
      container,
      marker,
      hint,
    };
  }

  private updateMinigame(time: number): void {
    const mg = this.minigame!;
    const k = this.keys;
    if (mg.marker) {
      const pos = markerPosition(time - mg.started, 1400);
      mg.marker.x = -160 + pos * 320;
    } else if (time >= mg.biteAt && mg.hint.text !== 'BISS! [E]') {
      mg.hint.setText('BISS! [E]').setColor('#ffdf5d');
      this.cameras.main.shake(120, 0.002);
    } else if (time > mg.biteAt + 1500) {
      this.finishMinigame(time);
      return;
    }
    if (Phaser.Input.Keyboard.JustDown(k.e) || Phaser.Input.Keyboard.JustDown(k.space))
      this.finishMinigame(time);
  }

  private finishMinigame(time: number): void {
    const mg = this.minigame;
    if (!mg) return;
    this.minigame = null;
    mg.container.destroy();
    const quality = mg.marker
      ? timingQuality(markerPosition(time - mg.started, 1400), mg.zoneCenter, mg.zoneHalf)
      : reactionQuality(time - mg.biteAt);
    const result = this.bridge.send({ type: 'Gather', activity: mg.activity, quality });
    if (!result.ok) return;
    const good = GATHERING[mg.activity].good;
    this.floatText(
      `${quality >= 0.9 ? 'Perfekt! ' : quality < 0.3 ? 'Daneben … ' : ''}+${GOODS[good].name}`,
      quality >= 0.5 ? '#b6f28a' : '#f2c94c',
    );
    if (mg.activity === 'wood') this.cameras.main.shake(100, 0.003);
    // Ein Sammelplatz ist danach für den Rest des Besuchs erschöpft (wächst nach).
    if (mg.activity !== 'fish') {
      this.usedSpots.add(mg.spot.id);
      const sprite = this.spotSprites.get(mg.spot.id);
      if (sprite && mg.activity === 'wood') sprite.setTexture('stump');
      else sprite?.setAlpha(0.35);
      this.time.delayedCall(90_000, () => {
        this.usedSpots.delete(mg.spot.id);
        if (sprite && mg.activity === 'wood') sprite.setTexture(`tree-${this.layout.culture}`);
        sprite?.setAlpha(1);
      });
    }
  }

  private floatText(text: string, color: string): void {
    const t = this.add
      .text(this.player.x, this.player.y - 40, text, {
        fontFamily: 'Georgia, serif',
        fontSize: '14px',
        color,
        stroke: '#000',
        strokeThickness: 3,
      })
      .setOrigin(0.5)
      .setDepth(9800);
    this.tweens.add({ targets: t, y: t.y - 40, alpha: 0, duration: 1600, onComplete: () => t.destroy() });
  }

  private onSimEvents(events: SimEvent[]): void {
    for (const e of events) {
      if (e.type === 'GoodsTraded' && e.cityId === this.cityId && e.direction === 'sell') {
        // kleines Münzgeklimper über der Figur
        this.floatText(`+${Math.round(e.totalPrice)} GS`, '#ffd166');
      }
      if (e.type === 'FireBrokeOut' && e.cityId === this.cityId) this.cameras.main.flash(600, 255, 120, 40);
    }
  }
}
