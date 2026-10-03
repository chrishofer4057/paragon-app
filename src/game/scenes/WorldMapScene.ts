import Phaser from 'phaser';
import type { GameBridge } from '../../bridge/bridge';
import { CITIES, CITY_IDS } from '../../sim/data/cities';
import { NORTH_SOUTH_BORDER_Y } from '../../sim/data/cities';

/**
 * Weltkarte (CLAUDE.md §5.3): sichtbar, solange die Figur unterwegs ist. Zeigt Städte,
 * eigene Schiffe auf See und die Reise der Figur. Ziele wählt man in der Angular-Oberfläche.
 */
export class WorldMapScene extends Phaser.Scene {
  private bridge!: GameBridge;
  private traveler!: Phaser.GameObjects.Container;
  private shipMarkers = new Map<string, Phaser.GameObjects.Arc>();
  private mapW = 0;
  private mapH = 0;

  constructor() {
    super('worldmap');
  }

  init(data: { bridge: GameBridge }): void {
    this.bridge = data.bridge;
    this.shipMarkers.clear();
  }

  private toScreen(mapX: number, mapY: number): { x: number; y: number } {
    const pad = 40;
    return { x: pad + (mapX / 100) * (this.mapW - 2 * pad), y: pad + (mapY / 100) * (this.mapH - 2 * pad) };
  }

  create(): void {
    this.mapW = this.scale.width;
    this.mapH = this.scale.height;
    this.cameras.main.setBackgroundColor(0x2a6f97);
    const g = this.add.graphics();
    // Grobe Landmassen um die Städte herum (Platzhalter)
    for (const id of CITY_IDS) {
      const c = CITIES[id];
      const p = this.toScreen(c.mapX, c.mapY);
      g.fillStyle(c.culture === 'north' ? 0x6fae4e : 0xe6cf98, 1).fillCircle(p.x, p.y, 34);
    }
    const border = this.toScreen(0, NORTH_SOUTH_BORDER_Y).y;
    g.lineStyle(1, 0xffffff, 0.15).lineBetween(0, border, this.mapW, border);
    for (const id of CITY_IDS) {
      const c = CITIES[id];
      const p = this.toScreen(c.mapX, c.mapY);
      this.add.circle(p.x, p.y, 6, c.culture === 'north' ? 0x8e3b2a : 0x2f6fc4).setStrokeStyle(2, 0xffffff);
      this.add
        .text(p.x, p.y + 10, c.name, {
          fontFamily: 'Georgia, serif',
          fontSize: '12px',
          color: '#fff8e7',
          stroke: '#2b1d10',
          strokeThickness: 3,
        })
        .setOrigin(0.5, 0);
    }
    const sail = this.add.triangle(0, 0, 0, 10, 8, -10, 16, 10, 0xf4ecd8);
    const hull = this.add.rectangle(8, 12, 22, 6, 0x7a4a24);
    this.traveler = this.add.container(0, 0, [hull, sail]);
    this.add
      .text(this.mapW / 2, 16, 'Auf Reisen – die Zeit läuft schneller', {
        fontFamily: 'Georgia, serif',
        fontSize: '15px',
        color: '#fff8e7',
      })
      .setOrigin(0.5, 0);
    this.cameras.main.fadeIn(300);
  }

  override update(): void {
    const state = this.bridge.getState();
    const loc = state.player.location;
    if (loc.kind !== 'travel') {
      this.scene.start('city', { bridge: this.bridge });
      return;
    }
    const t = Math.min(1, (state.tick - loc.departTick) / Math.max(1, loc.arriveTick - loc.departTick));
    const a = CITIES[loc.from];
    const b = CITIES[loc.to];
    const p = this.toScreen(a.mapX + (b.mapX - a.mapX) * t, a.mapY + (b.mapY - a.mapY) * t);
    this.traveler.setPosition(p.x - 8, p.y - 8);
    for (const ship of Object.values(state.ships)) {
      if (ship.location.kind !== 'sea') continue;
      const s = ship.location;
      const st = Math.min(1, (state.tick - s.departTick) / Math.max(1, s.arriveTick - s.departTick));
      const from = CITIES[s.from];
      const to = CITIES[s.to];
      const pos = this.toScreen(
        from.mapX + (to.mapX - from.mapX) * st,
        from.mapY + (to.mapY - from.mapY) * st,
      );
      let marker = this.shipMarkers.get(ship.id);
      if (!marker) {
        marker = this.add.circle(0, 0, 4, 0xf4ecd8);
        this.shipMarkers.set(ship.id, marker);
      }
      marker.setPosition(pos.x, pos.y);
    }
  }
}
