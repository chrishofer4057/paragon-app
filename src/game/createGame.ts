import Phaser from 'phaser';
import type { GameBridge } from '../bridge/bridge';
import { generateTextures } from './art';
import { CityScene } from './scenes/CityScene';
import { WorldMapScene } from './scenes/WorldMapScene';

/** Erzeugt Platzhaltertexturen und startet je nach Aufenthaltsort Stadt oder Weltkarte. */
class BootScene extends Phaser.Scene {
  private bridge!: GameBridge;

  constructor() {
    super('boot');
  }

  init(data: { bridge: GameBridge }): void {
    this.bridge = data.bridge;
  }

  create(): void {
    generateTextures(this);
    const traveling = this.bridge.getState().player.location.kind === 'travel';
    this.scene.start(traveling ? 'worldmap' : 'city', { bridge: this.bridge });
  }
}

export function createPhaserGame(parent: HTMLElement, bridge: GameBridge): Phaser.Game {
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    backgroundColor: '#1f6f9f',
    pixelArt: false,
    scale: {
      mode: Phaser.Scale.RESIZE,
      width: parent.clientWidth || 1280,
      height: parent.clientHeight || 720,
    },
    physics: { default: 'arcade', arcade: { debug: false } },
    input: { keyboard: { capture: [] } },
    scene: [],
    banner: false,
  });
  game.scene.add('boot', BootScene, false);
  game.scene.add('city', CityScene, false);
  game.scene.add('worldmap', WorldMapScene, false);
  game.scene.start('boot', { bridge });
  return game;
}
