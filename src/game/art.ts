import Phaser from 'phaser';
import type { Culture } from '../sim/data/cities';
import { TILE, type PlacedBuilding, type Terrain } from './cityLayout';

/**
 * PLATZHALTERGRAFIK (CLAUDE.md §11.6): alles wird zur Laufzeit gezeichnet, keine fremden
 * Assets. Stilrichtung laut docs/ART_DIRECTION.md: Norden Fachwerk mit steilen Dächern,
 * Süden weiße Bauten mit blauen Kuppeln. Wird später durch echte Kacheln/Sprites ersetzt.
 */

export const PALETTE = {
  north: {
    ground: 0x6fae4e,
    groundDark: 0x5c9a40,
    road: 0x9a8b74,
    plaza: 0xb4a68e,
    wall: 0xf1e3c8,
    timber: 0x6b3f22,
    roofs: [0x8e3b2a, 0x3d5fa6, 0x7a4b2a, 0x9c4f2f],
    trim: 0x4a2c18,
    base: 0x7d7a86,
  },
  south: {
    ground: 0xe6cf98,
    groundDark: 0xd8bd83,
    road: 0xcdb48a,
    plaza: 0xeedfbd,
    wall: 0xfbf4e6,
    timber: 0xd9c6a4,
    roofs: [0x2f6fc4, 0x3a86d6, 0xc9663f, 0x2f6fc4],
    trim: 0x2c5aa0,
    base: 0xd8c39a,
  },
} as const;

const WATER = 0x2f8fc7;

/** Punktliste für fillPoints (Phaser 4 erwartet Vector2). */
function pts(...coords: { x: number; y: number }[]): Phaser.Math.Vector2[] {
  return coords.map((c) => new Phaser.Math.Vector2(c.x, c.y));
}
const WATER_DEEP = 0x2479ad;

function noise(
  g: Phaser.GameObjects.Graphics,
  color: number,
  count: number,
  size: number,
  seed: number,
): void {
  let s = seed;
  const rand = () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
  g.fillStyle(color, 1);
  for (let i = 0; i < count; i++)
    g.fillRect(Math.floor(rand() * TILE), Math.floor(rand() * TILE), size, size);
}

function makeTile(scene: Phaser.Scene, key: string, draw: (g: Phaser.GameObjects.Graphics) => void): void {
  if (scene.textures.exists(key)) return;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  draw(g);
  g.generateTexture(key, TILE, TILE);
  g.destroy();
}

function makeSprite(
  scene: Phaser.Scene,
  key: string,
  w: number,
  h: number,
  draw: (g: Phaser.GameObjects.Graphics) => void,
): void {
  if (scene.textures.exists(key)) return;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  draw(g);
  g.generateTexture(key, w, h);
  g.destroy();
}

export function tileKey(terrain: Terrain, culture: Culture): string {
  return `tile-${culture}-${terrain}`;
}

export function generateTextures(scene: Phaser.Scene): void {
  for (const culture of ['north', 'south'] as const) {
    const p = PALETTE[culture];
    const fill = (color: number, dots: number, seed: number) => (g: Phaser.GameObjects.Graphics) => {
      g.fillStyle(color, 1).fillRect(0, 0, TILE, TILE);
      noise(g, p.groundDark, dots, 2, seed);
    };
    makeTile(scene, tileKey('grass', culture), fill(p.ground, 18, 7));
    makeTile(scene, tileKey('sand', culture), (g) => {
      g.fillStyle(PALETTE.south.ground, 1).fillRect(0, 0, TILE, TILE);
      noise(g, PALETTE.south.groundDark, 14, 2, 11);
    });
    makeTile(scene, tileKey('meadow', culture), (g) => {
      g.fillStyle(culture === 'north' ? 0x7dbb55 : 0xc9cf7a, 1).fillRect(0, 0, TILE, TILE);
      noise(g, 0x5f9d3c, 20, 2, 13);
    });
    makeTile(scene, tileKey('forest', culture), (g) => {
      g.fillStyle(culture === 'north' ? 0x4f8a3a : 0xb7b06a, 1).fillRect(0, 0, TILE, TILE);
      noise(g, culture === 'north' ? 0x3f7330 : 0x9a9350, 22, 3, 17);
    });
    makeTile(scene, tileKey('quarry', culture), (g) => {
      g.fillStyle(0xa59c8f, 1).fillRect(0, 0, TILE, TILE);
      noise(g, 0x8a8174, 20, 3, 19);
    });
    makeTile(scene, tileKey('road', culture), (g) => {
      g.fillStyle(p.road, 1).fillRect(0, 0, TILE, TILE);
      g.lineStyle(1, 0x000000, 0.12);
      for (let y = 0; y < TILE; y += 8) {
        const off = (y / 8) % 2 === 0 ? 0 : 8;
        for (let x = -off; x < TILE; x += 16) g.strokeRect(x, y, 16, 8);
      }
    });
    makeTile(scene, tileKey('plaza', culture), (g) => {
      g.fillStyle(p.plaza, 1).fillRect(0, 0, TILE, TILE);
      g.lineStyle(1, 0x000000, 0.1).strokeRect(0, 0, 16, 16).strokeRect(16, 16, 16, 16);
    });
    makeTile(scene, tileKey('water', culture), (g) => {
      g.fillStyle(culture === 'north' ? WATER_DEEP : WATER, 1).fillRect(0, 0, TILE, TILE);
      g.lineStyle(2, 0xffffff, 0.25).lineBetween(4, 10, 12, 10).lineBetween(18, 24, 28, 24);
    });
    makeTile(scene, tileKey('pier', culture), (g) => {
      g.fillStyle(0x8a5a33, 1).fillRect(0, 0, TILE, TILE);
      g.lineStyle(2, 0x5e3a1e, 1);
      for (let x = 0; x <= TILE; x += 8) g.lineBetween(x, 0, x, TILE);
    });
  }

  // Bäume: Nadelbaum im Norden, Palme im Süden
  makeSprite(scene, 'tree-north', 40, 56, (g) => {
    g.fillStyle(0x000000, 0.2).fillEllipse(20, 52, 30, 8);
    g.fillStyle(0x5b3a1e, 1).fillRect(17, 40, 6, 14);
    g.fillStyle(0x2f6b4f, 1).fillTriangle(20, 2, 4, 30, 36, 30);
    g.fillStyle(0x3b8060, 1).fillTriangle(20, 14, 2, 44, 38, 44);
    g.fillStyle(0x4a9772, 1).fillTriangle(20, 8, 10, 26, 30, 26);
  });
  makeSprite(scene, 'tree-south', 44, 56, (g) => {
    g.fillStyle(0x000000, 0.2).fillEllipse(22, 52, 26, 8);
    g.fillStyle(0x8a6233, 1).fillRect(19, 18, 6, 36);
    g.fillStyle(0x3f9a4a, 1);
    g.fillEllipse(10, 16, 22, 9)
      .fillEllipse(34, 16, 22, 9)
      .fillEllipse(22, 9, 12, 16)
      .fillEllipse(14, 22, 18, 7)
      .fillEllipse(30, 22, 18, 7);
  });
  makeSprite(scene, 'stump', 24, 16, (g) => {
    g.fillStyle(0x6b4423, 1).fillEllipse(12, 9, 20, 12);
    g.fillStyle(0xc49a6c, 1).fillEllipse(12, 7, 16, 8);
  });
  makeSprite(scene, 'rock', 30, 24, (g) => {
    g.fillStyle(0x000000, 0.18).fillEllipse(15, 21, 26, 6);
    g.fillStyle(0x8e8b86, 1).fillEllipse(15, 13, 28, 20);
    g.fillStyle(0xb3afa8, 1).fillEllipse(11, 9, 12, 8);
  });
  for (const [i, color] of [0xe25d6a, 0xf2c94c, 0x9b7be0].entries()) {
    makeSprite(scene, `flower${i}`, 16, 16, (g) => {
      g.fillStyle(0x3f8a3a, 1).fillRect(7, 8, 2, 8);
      g.fillStyle(color, 1).fillCircle(8, 6, 4);
      g.fillStyle(0xffffff, 0.8).fillCircle(8, 6, 1.5);
    });
  }
  makeSprite(scene, 'faeryflower', 16, 18, (g) => {
    g.fillStyle(0x3f8a3a, 1).fillRect(7, 8, 2, 10);
    g.fillStyle(0x9ff3ff, 0.5).fillCircle(8, 6, 7);
    g.fillStyle(0xc77dff, 1).fillCircle(8, 6, 4);
  });
  makeSprite(scene, 'herb', 18, 16, (g) => {
    g.fillStyle(0x4f9a3f, 1).fillEllipse(5, 10, 8, 12).fillEllipse(13, 10, 8, 12).fillEllipse(9, 6, 8, 12);
  });
  makeSprite(scene, 'lamp', 12, 36, (g) => {
    g.fillStyle(0x3a3a3a, 1).fillRect(5, 8, 2, 28);
    g.fillStyle(0xffd27a, 1).fillRect(2, 2, 8, 8);
    g.lineStyle(1, 0x3a3a3a, 1).strokeRect(2, 2, 8, 8);
  });
  makeSprite(scene, 'barrel', 18, 22, (g) => {
    g.fillStyle(0x8a5a2b, 1).fillRoundedRect(1, 1, 16, 20, 5);
    g.lineStyle(2, 0x555555, 1).lineBetween(1, 6, 17, 6).lineBetween(1, 16, 17, 16);
  });
  makeSprite(scene, 'crate', 20, 20, (g) => {
    g.fillStyle(0xb07c44, 1).fillRect(1, 1, 18, 18);
    g.lineStyle(2, 0x7a522a, 1).strokeRect(1, 1, 18, 18).lineBetween(1, 1, 19, 19);
  });

  // Figuren
  const person = (key: string, body: number, hat: number) =>
    makeSprite(scene, key, 20, 30, (g) => {
      g.fillStyle(0x000000, 0.25).fillEllipse(10, 28, 14, 5);
      g.fillStyle(body, 1).fillRoundedRect(3, 12, 14, 15, 5);
      g.fillStyle(0xf2c9a0, 1).fillCircle(10, 8, 6);
      g.fillStyle(hat, 1).fillRect(4, 1, 12, 4);
    });
  person('player', 0xc0392b, 0x2c3e50);
  person('npc-rich', 0x6c3483, 0xd4ac0d);
  person('npc-wealthy', 0x2471a3, 0x5d4037);
  person('npc-poor', 0x7e7a6e, 0x6e5a3a);

  makeSprite(scene, 'ship', 96, 64, (g) => {
    g.fillStyle(0x000000, 0.2).fillEllipse(48, 56, 86, 12);
    g.fillStyle(0x7a4a24, 1).fillPoints(
      pts({ x: 4, y: 40 }, { x: 92, y: 40 }, { x: 80, y: 56 }, { x: 14, y: 56 }),
      true,
    );
    g.fillStyle(0x5e3a1e, 1).fillRect(46, 4, 4, 38);
    g.fillStyle(0xf4ecd8, 1).fillPoints(pts({ x: 50, y: 6 }, { x: 78, y: 34 }, { x: 50, y: 34 }), true);
    g.fillStyle(0xe8dcc0, 1).fillPoints(pts({ x: 46, y: 10 }, { x: 22, y: 34 }, { x: 46, y: 34 }), true);
  });
}

/** Zeichnet ein Gebäude in eine Graphics-Instanz (Weltkoordinaten). */
export function drawBuilding(g: Phaser.GameObjects.Graphics, b: PlacedBuilding, culture: Culture): void {
  const p = PALETTE[culture];
  const x = b.x * TILE;
  const y = b.y * TILE;
  const w = b.w * TILE;
  const h = b.h * TILE;
  const roof = p.roofs[b.variant % p.roofs.length]!;

  // Schatten
  g.fillStyle(0x000000, 0.18).fillRect(x + 6, y + 8, w, h);

  if (b.kind === 'stall') {
    g.fillStyle(0x8a5a33, 1).fillRect(x + 4, y + 10, w - 8, h - 10);
    for (let i = 0; i < 4; i++) {
      g.fillStyle(i % 2 === 0 ? 0xc0392b : 0xf5f0e6, 1).fillRect(x + (i * w) / 4, y - 6, w / 4, 14);
    }
    return;
  }
  if (b.kind === 'lot') {
    g.lineStyle(2, 0x6b4f2f, 1).strokeRect(x + 4, y + 4, w - 8, h - 8);
    g.fillStyle(0x8a6a44, 0.35).fillRect(x + 4, y + 4, w - 8, h - 8);
    g.fillStyle(0x6b4f2f, 1)
      .fillRect(x + w / 2 - 2, y + h / 2 - 10, 4, 20)
      .fillRect(x + w / 2 - 16, y + h / 2 - 12, 32, 12);
    return;
  }
  if (b.kind === 'gate') {
    g.fillStyle(p.base, 1).fillRect(x, y, w, h);
    g.fillStyle(0x5d5a63, 1)
      .fillRect(x, y - 16, 2 * TILE, h + 16)
      .fillRect(x + w - 2 * TILE, y - 16, 2 * TILE, h + 16);
    g.fillStyle(roof, 1)
      .fillTriangle(x - 4, y - 16, x + TILE, y - 44, x + 2 * TILE + 4, y - 16)
      .fillTriangle(x + w - 2 * TILE - 4, y - 16, x + w - TILE, y - 44, x + w + 4, y - 16);
    g.fillStyle(0x2b2b2b, 1).fillRect(x + 2 * TILE + 8, y + 8, w - 4 * TILE - 16, h - 8);
    return;
  }
  if (b.kind === 'shipyard') {
    g.fillStyle(0x8a5a33, 1).fillRect(x, y + h * 0.4, w, h * 0.6);
    g.lineStyle(4, 0x5e3a1e, 1);
    for (let i = 0; i < 4; i++) g.lineBetween(x + 20 + i * 44, y + h, x + 20 + i * 44, y);
    g.lineBetween(x, y + 6, x + w, y + 6);
    g.lineStyle(3, 0x3b2a1a, 1)
      .lineBetween(x + w - 20, y + h, x + w - 20, y - 30)
      .lineBetween(x + w - 20, y - 30, x + w - 80, y - 10);
    g.fillStyle(0x7a4a24, 1).fillEllipse(x + w / 2, y + h * 0.7, w * 0.7, h * 0.35);
    return;
  }

  const important = ['market', 'townhall', 'temple', 'guild', 'kontor'].includes(b.kind);
  if (culture === 'north') {
    const wallTop = y + h * 0.45;
    g.fillStyle(p.base, 1).fillRect(x, y + h - 10, w, 10);
    g.fillStyle(p.wall, 1).fillRect(x + 2, wallTop, w - 4, h * 0.55 - 10);
    g.lineStyle(3, p.timber, 1).strokeRect(x + 2, wallTop, w - 4, h * 0.55 - 10);
    for (let tx = x + 2 + TILE; tx < x + w - 4; tx += TILE) g.lineBetween(tx, wallTop, tx, y + h - 10);
    g.lineBetween(x + 2, wallTop + 4, x + TILE, y + h - 12);
    // steiles Satteldach
    g.fillStyle(roof, 1).fillPoints(
      pts(
        { x: x - 6, y: wallTop + 4 },
        { x: x + w / 2, y: y - (important ? 34 : 18) },
        { x: x + w + 6, y: wallTop + 4 },
      ),
      true,
    );
    g.lineStyle(2, 0x000000, 0.25);
    for (let i = 1; i < 4; i++) {
      const ry = wallTop + 4 - ((wallTop + 4 - (y - 10)) * i) / 4;
      g.lineBetween(x + (w / 2) * (i / 4), ry, x + w - (w / 2) * (i / 4), ry);
    }
    if (important) {
      g.fillStyle(p.wall, 1).fillRect(x + w / 2 - 12, y + 2, 24, 22);
      g.fillStyle(roof, 1).fillTriangle(x + w / 2 - 16, y + 4, x + w / 2, y - 50, x + w / 2 + 16, y + 4);
    }
  } else {
    const wallTop = y + h * 0.3;
    g.fillStyle(p.base, 1).fillRect(x, y + h - 8, w, 8);
    g.fillStyle(p.wall, 1).fillRect(x, wallTop, w, h * 0.7 - 8);
    g.fillStyle(0xe9dcc4, 1).fillRect(x - 3, wallTop - 8, w + 6, 10);
    if (important) {
      g.fillStyle(roof, 1).fillEllipse(x + w / 2, wallTop - 6, w * 0.6, w * 0.55);
      g.fillStyle(p.wall, 1).fillRect(x + w / 2 - w * 0.3, wallTop - 8, w * 0.6, 8);
      g.fillStyle(0xd4ac0d, 1).fillCircle(x + w / 2, wallTop - w * 0.28 - 6, 4);
      if (b.kind === 'temple') {
        g.fillStyle(p.wall, 1).fillRect(x + w - 18, y - 40, 14, h * 0.3 + 40);
        g.fillStyle(roof, 1).fillTriangle(x + w - 22, y - 40, x + w - 11, y - 70, x + w, y - 40);
      }
    } else {
      g.fillStyle(0xd9c7a2, 1).fillRect(x + 4, wallTop - 4, w - 8, 4);
      if (b.variant % 2 === 0) g.fillStyle(roof, 1).fillRect(x + 6, wallTop + 4, w - 12, 6);
    }
  }
  // Fenster und Tür
  const doorX = b.door.x * TILE + TILE / 2;
  const winColor = culture === 'north' ? 0xffd27a : 0x2f6fc4;
  g.fillStyle(winColor, 1);
  for (let wx = x + 12; wx < x + w - 16; wx += 30) {
    if (Math.abs(wx + 5 - doorX) < 16) continue;
    if (culture === 'south') g.fillRoundedRect(wx, y + h - 34, 10, 14, 4);
    else g.fillRect(wx, y + h - 32, 10, 12);
  }
  g.fillStyle(culture === 'north' ? 0x5e3a1e : 0x2c5aa0, 1).fillRoundedRect(doorX - 9, y + h - 26, 18, 26, 6);
}
