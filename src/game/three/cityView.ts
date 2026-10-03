import * as THREE from 'three';
import { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import type { GameBridge, PanelId } from '../../bridge/bridge';
import type { GatherActivity } from '../../sim/commands/commands';
import { GATHERING } from '../../sim/data/balance';
import { CITIES, type CityId } from '../../sim/data/cities';
import { LINES } from '../../sim/data/lines';
import { GOODS } from '../../sim/data/goods';
import type { SimEvent } from '../../sim/events/events';
import type { GameState } from '../../sim/state/gameState';
import { clockView } from '../../sim/selectors';
import { linersInPort } from '../../sim/systems/liners';
import { shipInPort } from '../../sim/systems/storage';
import {
  buildCityLayout,
  isWalkable,
  type CityLayout,
  type GatherSpot,
  type PlacedBuilding,
} from '../cityLayout';
import { markerPosition, reactionQuality, timingQuality } from '../minigameLogic';
import { findPath, nearestWalkable, type GridPoint } from '../world/pathfinding';
import { CameraRig } from './cameraRig';
import { mat, PALETTE, setNightGlow, setSnowy } from './materials';
import { disposeTree, mergeStatic } from './merge';
import { buildingModel } from './models/buildings';
import {
  addSilhouette,
  animateFigure,
  animateWork,
  CHARACTER_OUTFITS,
  CITIZEN_OUTFITS,
  makeFigure,
  type Figure,
} from './models/characters';
import {
  barrel,
  choppableTree,
  crate,
  faerybloom,
  flowers,
  herb,
  lamp,
  quarryRock,
  rock,
  stump,
  tree,
} from './models/nature';
import { ship } from './models/ships';
import { FireEffect } from './effects';
import { Mover } from './mover';
import type { Overlay } from './overlay';
import { animateWater, buildTerrain, tileTop, WATER_Y, type TerrainMeshes } from './terrain';
import type { PointerInfo, WorldView } from './view';

const PLAYER_SPEED = 3.4;
/** Abstand (Kacheln) zur Tür bzw. zum Sammelplatz, ab dem man direkt interagiert. */
const INTERACT_RANGE = 1.6;
const SPOT_REGROW_MS = 90_000;
const MINIGAME_PERIOD_MS = 1400;

const ACTIVITY_NAMES: Record<GatherActivity, string> = {
  wood: 'Holz hacken',
  stone: 'Stein brechen',
  fish: 'Angeln',
  herbs: 'Kräuter sammeln',
  faerybloom: 'Feenblüten pflücken',
};

type Target =
  | { kind: 'building'; building: PlacedBuilding }
  | { kind: 'ship'; name: string; panel: PanelId; berth: GridPoint }
  | { kind: 'spot'; spot: GatherSpot }
  | { kind: 'ground'; tile: GridPoint };

interface DockedShip {
  key: string;
  name: string;
  own: boolean;
  panel: PanelId;
}

interface SpotVisual {
  spot: GatherSpot;
  group: THREE.Group;
  used: boolean;
}

interface Minigame {
  spot: GatherSpot;
  started: number;
  zoneCenter: number;
  zoneHalf: number;
  biteAt: number;
  bitten: boolean;
}

interface Walker {
  figure: Figure;
  mover: Mover;
  wait: number;
}

interface Puff {
  mesh: THREE.Mesh;
  origin: THREE.Vector3;
  age: number;
  life: number;
}

const PLAGUE_FOG = new THREE.Color(0x8f9c72);

const SPOT_RING = new THREE.RingGeometry(0.34, 0.44, 24).rotateX(-Math.PI / 2);
const SPOT_RING_MATERIAL = new THREE.MeshBasicMaterial({
  color: 0xffe08a,
  transparent: true,
  opacity: 0.55,
  depthWrite: false,
});

/** Letzte Position je Stadt, damit ein Neuaufbau (z. B. Kontor fertig) die Figur nicht versetzt. */
const lastPositions = new Map<CityId, { x: number; z: number }>();

/** Liegt in dieser Stadt gerade Schnee? Nur im Norden und im Winter (CLAUDE.md §3.2). */
function snowyCity(state: GameState, cityId: CityId): boolean {
  return CITIES[cityId].culture === 'north' && clockView(state).winter;
}

/** Signatur des Besitzes, der den Grundriss beeinflusst – ändert sie sich, wird neu aufgebaut. */
export function citySignature(bridge: GameBridge): string {
  const state = bridge.getState();
  const loc = state.player.location;
  if (loc.kind !== 'city') return 'travel';
  const c = loc.cityId;
  const businesses = Object.values(state.player.businesses).filter((b) => b.cityId === c).length;
  const houses = Object.values(state.player.houses).filter((h) => h.cityId === c).length;
  return `${c}|${state.player.kontors[c] ? 1 : 0}|${businesses}|${houses}|${snowyCity(state, c) ? 'w' : ''}`;
}

/** Begehbare 3D-Stadt mit Umland (CLAUDE.md §5.3). Liest Zustand, sendet Commands. */
export class CityView implements WorldView {
  readonly scene = new THREE.Scene();
  readonly rig: CameraRig;
  readonly cityId: CityId;
  private readonly layout: CityLayout;
  private readonly terrain: TerrainMeshes;
  private readonly statics: THREE.Group;
  private readonly proxies: THREE.Mesh[] = [];
  private readonly spots = new Map<string, SpotVisual>();
  private ships: {
    group: THREE.Group;
    label: CSS2DObject;
    proxy: THREE.Mesh;
    baseY: number;
    phase: number;
  }[] = [];
  private shipKey = '';
  private readonly walkers: Walker[] = [];
  private readonly puffs: Puff[] = [];
  private readonly lampLights: THREE.PointLight[] = [];
  private readonly faeries: THREE.Object3D[] = [];
  private readonly fishRings: THREE.Mesh[] = [];
  private snow: THREE.Points | null = null;
  private readonly spinners: THREE.Object3D[] = [];
  private readonly beacons: THREE.PointLight[] = [];
  private fires: FireEffect[] = [];
  private readonly winter: boolean;
  private readonly sun: THREE.DirectionalLight;
  private readonly hemi: THREE.HemisphereLight;
  private readonly player: Figure;
  private readonly mover: Mover;
  private readonly hoverRect: THREE.LineLoop;
  private readonly tileMarker: THREE.LineLoop;
  private readonly clickMarker: THREE.Mesh;
  private readonly raycaster = new THREE.Raycaster();
  private readonly skyDay: THREE.Color;
  private readonly skyNight = new THREE.Color(0x0e1a33);
  private readonly unsubscribe: () => void;
  private minigame: Minigame | null = null;
  private busyMax = 0;
  private clickAge = 1;
  private elapsed = 0;
  private nightLevel = 0;

  constructor(
    private readonly bridge: GameBridge,
    private readonly overlay: Overlay,
    aspect: number,
  ) {
    const state = bridge.getState();
    const loc = state.player.location;
    if (loc.kind !== 'city') throw new Error('CityView braucht eine Stadt');
    this.cityId = loc.cityId;
    const c = this.cityId;
    const culture = CITIES[c].culture;
    this.layout = buildCityLayout(c, culture, {
      hasKontor: state.player.kontors[c] !== undefined,
      businesses: Object.values(state.player.businesses).filter((b) => b.cityId === c).length,
      houses: Object.values(state.player.houses).filter((h) => h.cityId === c).length,
    });
    this.rig = new CameraRig(aspect);
    this.winter = snowyCity(state, c);
    this.skyDay = new THREE.Color(this.winter ? 0xb8c6d2 : culture === 'north' ? 0x9ccbe6 : 0xa9dcf2);
    this.scene.background = this.skyDay.clone();
    this.scene.fog = new THREE.Fog(this.skyDay.getHex(), 40, 85);

    // --- Licht ---------------------------------------------------------------
    this.hemi = new THREE.HemisphereLight(0xfff4dc, culture === 'north' ? 0x4a6a3a : 0x9a845a, 1.1);
    this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xfff0d0, 2.4);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(4096, 4096);
    const cam = this.sun.shadow.camera;
    cam.left = -40;
    cam.right = 40;
    cam.top = 34;
    cam.bottom = -34;
    cam.near = 1;
    cam.far = 140;
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.03;
    this.sun.target.position.set(this.layout.cols / 2, 0, this.layout.rows / 2);
    this.scene.add(this.sun, this.sun.target);

    // --- Gelände und statische Welt ---------------------------------------
    const winter = this.winter;
    setSnowy(winter);
    this.terrain = buildTerrain(this.layout, winter);
    this.scene.add(this.terrain.pick, this.terrain.water);
    const staticRoot = new THREE.Group();
    staticRoot.add(this.terrain.statics);
    this.buildBuildings(staticRoot);
    this.buildDecorations(staticRoot);
    this.statics = mergeStatic(staticRoot);
    disposeTree(staticRoot);
    this.scene.add(this.statics);

    this.buildSpots();
    setSnowy(false);
    if (winter) this.snow = this.createSnow();
    this.syncShips();

    // --- Figur ---------------------------------------------------------------
    this.player = makeFigure(CHARACTER_OUTFITS[state.player.characterId], 1.15);
    addSilhouette(this.player);
    this.scene.add(this.player.root);
    this.mover = new Mover(this.layout, PLAYER_SPEED);
    const last = lastPositions.get(c);
    const start = last && isWalkable(this.layout, Math.floor(last.x), Math.floor(last.z)) ? last : null;
    if (start) this.mover.placeAt(start.x, start.z);
    else this.mover.placeAt(this.layout.spawn.x + 0.5, this.layout.spawn.y + 0.5);
    this.mover.heading = 0;
    this.createWalkers();

    // --- Markierungen --------------------------------------------------------
    this.hoverRect = new THREE.LineLoop(
      new THREE.BufferGeometry(),
      new THREE.LineBasicMaterial({ color: 0xffd54a, transparent: true, opacity: 0.9 }),
    );
    this.hoverRect.visible = false;
    this.tileMarker = new THREE.LineLoop(
      new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0.08, 0, 0.08),
        new THREE.Vector3(0.92, 0, 0.08),
        new THREE.Vector3(0.92, 0, 0.92),
        new THREE.Vector3(0.08, 0, 0.92),
      ]),
      new THREE.LineBasicMaterial({ color: 0xfff8e7, transparent: true, opacity: 0.55 }),
    );
    this.tileMarker.visible = false;
    this.clickMarker = new THREE.Mesh(
      new THREE.RingGeometry(0.28, 0.38, 20).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0xffd54a, transparent: true, opacity: 0, depthWrite: false }),
    );
    this.scene.add(this.hoverRect, this.tileMarker, this.clickMarker);

    this.unsubscribe = bridge.onEvents((events) => this.onSimEvents(events));
    this.rig.update(0, this.focusPoint(), true);
    this.applyDaylight(true);
  }

  get camera(): THREE.Camera {
    return this.rig.camera;
  }

  // --- Aufbau ------------------------------------------------------------------

  private footprintTop(b: PlacedBuilding): number {
    let top = -Infinity;
    for (let y = b.y; y < b.y + b.h; y++)
      for (let x = b.x; x < b.x + b.w; x++) top = Math.max(top, tileTop(this.layout, x, y));
    return top;
  }

  private buildBuildings(root: THREE.Group): void {
    const culture = this.layout.culture;
    for (const b of this.layout.buildings) {
      const model = buildingModel(b, culture);
      const top = this.footprintTop(b);
      const cx = b.x + b.w / 2;
      const cz = b.y + b.h / 2;
      model.group.position.set(cx, top, cz);
      root.add(model.group);
      // Sockel, falls die Grundfläche uneben ist
      if (b.kind !== 'stall' && b.kind !== 'fountain' && b.kind !== 'lighthouse') {
        const plinth = new THREE.Mesh(
          new THREE.BoxGeometry(b.w - 0.1, 1, b.h - 0.1).translate(0, -0.5, 0),
          mat(PALETTE[culture].stone),
        );
        plinth.position.set(cx, top + 0.01, cz);
        plinth.scale.y = 0.6;
        root.add(plinth);
      }
      model.group.updateMatrixWorld(true);
      for (const p of model.smoke) this.addChimney(p.clone().applyMatrix4(model.group.matrixWorld));
      for (const spinner of model.spinners) {
        spinner.applyMatrix4(model.group.matrixWorld);
        this.scene.add(spinner);
        this.spinners.push(spinner);
      }
      for (const p of model.lights) {
        const light = new THREE.PointLight(0xffd27a, 0, 18, 1.2);
        light.position.copy(p.clone().applyMatrix4(model.group.matrixWorld));
        this.scene.add(light);
        this.beacons.push(light);
      }

      if (b.panel) {
        const proxy = new THREE.Mesh(
          new THREE.BoxGeometry(b.w, model.height, b.h).translate(0, model.height / 2, 0),
          new THREE.MeshBasicMaterial({ visible: false }),
        );
        proxy.position.set(cx, top, cz);
        proxy.userData['target'] = { kind: 'building', building: b } satisfies Target;
        this.scene.add(proxy);
        this.proxies.push(proxy);
      }
      if (b.label) {
        const el = document.createElement('div');
        el.className = `world-label${b.kind === 'house' || b.kind === 'stall' ? ' small' : ''}${b.id === 'kontor' || b.label.startsWith('Euer') ? ' own' : ''}`;
        el.textContent = b.label;
        const label = new CSS2DObject(el);
        label.position.set(cx, top + model.height + 0.35, cz);
        this.scene.add(label);
      }
    }
  }

  /** Schneefall: Punkte in einem Quader um die Kamera, die langsam fallen und oben neu beginnen. */
  private createSnow(): THREE.Points {
    const count = 1800;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 50;
      positions[i * 3 + 1] = Math.random() * 18;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 40;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const points = new THREE.Points(
      geo,
      new THREE.PointsMaterial({
        color: 0xffffff,
        size: 0.09,
        transparent: true,
        opacity: 0.85,
        depthWrite: false,
      }),
    );
    this.scene.add(points);
    return points;
  }

  private animateSnow(dt: number): void {
    if (!this.snow) return;
    const pos = this.snow.geometry.attributes['position'] as THREE.BufferAttribute;
    const t = this.elapsed;
    for (let i = 0; i < pos.count; i++) {
      let y = pos.getY(i) - dt * (1.2 + (i % 7) * 0.12);
      if (y < 0) y += 18;
      pos.setY(i, y);
      pos.setX(i, pos.getX(i) + Math.sin(t + i) * dt * 0.2);
    }
    pos.needsUpdate = true;
    this.snow.position.set(this.rig.target.x, 0, this.rig.target.z);
  }

  private addChimney(at: THREE.Vector3): void {
    const material = new THREE.MeshStandardMaterial({
      color: 0xe8e4dc,
      transparent: true,
      opacity: 0.5,
      flatShading: true,
      depthWrite: false,
    });
    for (let i = 0; i < 4; i++) {
      const puff = new THREE.Mesh(new THREE.IcosahedronGeometry(0.14, 0), material);
      this.scene.add(puff);
      this.puffs.push({ mesh: puff, origin: at.clone(), age: i * 0.9, life: 3.6 });
    }
  }

  private buildDecorations(root: THREE.Group): void {
    const culture = this.layout.culture;
    for (const d of this.layout.decorations) {
      let obj: THREE.Group;
      switch (d.kind) {
        case 'tree':
          obj = tree(culture, d.variant + d.x * 3 + d.y);
          break;
        case 'rock':
          obj = rock(d.variant + d.x, culture);
          break;
        case 'flower':
          obj = flowers(d.variant);
          break;
        case 'lamp':
          obj = lamp();
          break;
        case 'barrel':
          obj = barrel();
          break;
        case 'crate':
          obj = crate();
          break;
      }
      const top = tileTop(this.layout, d.x, d.y);
      obj.position.set(d.x + 0.5, top, d.y + 0.5);
      if (d.kind !== 'lamp') obj.rotation.y = (d.x * 13 + d.y * 7) % 6;
      root.add(obj);
      if (d.kind === 'lamp' && this.lampLights.length < 8) {
        const light = new THREE.PointLight(0xffb45a, 0, 7, 1.6);
        light.position.set(d.x + 0.75, top + 1.1, d.y + 0.5);
        this.scene.add(light);
        this.lampLights.push(light);
      }
    }
  }

  private spotModel(spot: GatherSpot, used: boolean): THREE.Group {
    const model = this.spotShape(spot, used);
    if (!used && spot.activity !== 'fish') {
      // Dezenter Ring am Boden: hier kann man etwas sammeln
      const ring = new THREE.Mesh(SPOT_RING, SPOT_RING_MATERIAL);
      ring.position.y = 0.02;
      ring.renderOrder = 1;
      model.add(ring);
    }
    return model;
  }

  private spotShape(spot: GatherSpot, used: boolean): THREE.Group {
    const variant = spot.x * 7 + spot.y * 3;
    switch (spot.activity) {
      case 'wood':
        return used ? stump() : choppableTree(this.layout.culture, variant);
      case 'stone':
        return used ? new THREE.Group() : quarryRock(variant);
      case 'herbs':
        return used ? new THREE.Group() : herb();
      case 'faerybloom':
        return used ? new THREE.Group() : faerybloom();
      case 'fish':
        return new THREE.Group();
    }
  }

  private buildSpots(): void {
    for (const spot of this.layout.spots) {
      const group = new THREE.Group();
      const top = tileTop(this.layout, spot.x, spot.y);
      group.position.set(spot.x + 0.5, top, spot.y + 0.5);
      group.add(this.spotModel(spot, false));
      this.scene.add(group);
      this.spots.set(spot.id, { spot, group, used: false });
      if (spot.activity === 'faerybloom') this.faeries.push(group);
      const proxy = new THREE.Mesh(
        new THREE.CylinderGeometry(0.45, 0.45, 1.6, 8).translate(0, 0.8, 0),
        new THREE.MeshBasicMaterial({ visible: false }),
      );
      proxy.position.copy(group.position);
      if (spot.activity === 'fish') {
        // Fischgrund: Kreise im Wasser vor dem Stegende
        const ring = new THREE.Mesh(
          new THREE.RingGeometry(0.25, 0.32, 18).rotateX(-Math.PI / 2),
          new THREE.MeshBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.6,
            depthWrite: false,
          }),
        );
        ring.position.set(spot.x + 0.5, WATER_Y + 0.06, spot.y + 1.4);
        this.scene.add(ring);
        this.fishRings.push(ring);
        proxy.position.set(spot.x + 0.5, WATER_Y, spot.y + 1);
      }
      proxy.userData['target'] = { kind: 'spot', spot } satisfies Target;
      this.scene.add(proxy);
      this.proxies.push(proxy);
    }
  }

  /** Was gerade im Hafen liegt: eigene Schiffe zuerst, dann Linienschiffe nach Fahrplan. */
  private harbourShips(): DockedShip[] {
    const state = this.bridge.getState();
    const own: DockedShip[] = Object.values(state.ships)
      .filter((s) => shipInPort(s) === this.cityId)
      .map((s) => ({ key: s.id, name: s.name, own: true, panel: 'possessions' as const }));
    const liners: DockedShip[] = linersInPort(this.cityId, state.tick).map((id) => ({
      key: `line:${id}`,
      name: LINES[id].name,
      own: false,
      panel: 'travel' as const,
    }));
    return [...own, ...liners].slice(0, this.layout.berths.length);
  }

  /** Schiffe im Hafen; bei Ankunft/Abfahrt neu aufgebaut, ohne die Stadt neu zu bauen. */
  private syncShips(): void {
    const docked = this.harbourShips();
    const key = docked.map((s) => `${s.key}:${s.name}`).join(',');
    if (key === this.shipKey) return;
    this.shipKey = key;
    for (const s of this.ships) {
      this.scene.remove(s.group, s.label, s.proxy);
      s.proxy.geometry.dispose();
      const i = this.proxies.indexOf(s.proxy);
      if (i >= 0) this.proxies.splice(i, 1);
    }
    this.ships = docked.map((s, i) => {
      const berth = this.layout.berths[i]!;
      const g = s.own ? ship(0xf4ecd8, 0xc0392b, 0.9) : ship(0xe9dcc0, 0x2f5f9e, 1.05);
      g.position.set(berth.x + 0.5, WATER_Y + 0.12, berth.y + 0.5);
      g.rotation.y = i % 2 ? Math.PI : 0;
      this.scene.add(g);
      const el = document.createElement('div');
      el.className = `world-label small${s.own ? ' own' : ''}`;
      el.textContent = s.own ? s.name : `⚓ ${s.name}`;
      const label = new CSS2DObject(el);
      label.position.set(berth.x + 0.5, 3.4, berth.y + 0.5);
      this.scene.add(label);
      const proxy = new THREE.Mesh(
        new THREE.BoxGeometry(3.6, 3, 1.4).translate(0, 1.2, 0),
        new THREE.MeshBasicMaterial({ visible: false }),
      );
      proxy.position.copy(g.position);
      proxy.rotation.y = g.rotation.y;
      proxy.userData['target'] = {
        kind: 'ship',
        name: s.own ? s.name : `${s.name} – Überfahrt und Fracht`,
        panel: s.panel,
        berth,
      } satisfies Target;
      this.scene.add(proxy);
      this.proxies.push(proxy);
      return { group: g, label, proxy, baseY: g.position.y, phase: i * 1.3 };
    });
  }

  private createWalkers(): void {
    const state = this.bridge.getState();
    const pop = state.cities[this.cityId].population;
    const total = pop.rich + pop.wealthy + pop.poor;
    const count = Math.min(16, Math.max(5, Math.round(total / 400)));
    const points = this.streetTiles();
    for (let i = 0; i < count; i++) {
      const r = Math.random() * total;
      const pool =
        r < pop.rich
          ? CITIZEN_OUTFITS.rich
          : r < pop.rich + pop.wealthy
            ? CITIZEN_OUTFITS.wealthy
            : CITIZEN_OUTFITS.poor;
      const figure = makeFigure(pool[Math.floor(Math.random() * pool.length)]!, 1.05);
      const mover = new Mover(this.layout, 1.1 + Math.random() * 0.6);
      const start = points[Math.floor(Math.random() * points.length)]!;
      mover.placeAt(start.x + 0.5, start.y + 0.5);
      mover.heading = Math.random() * Math.PI * 2;
      this.scene.add(figure.root);
      this.walkers.push({ figure, mover, wait: Math.random() * 3 });
    }
  }

  private streetTiles(): GridPoint[] {
    const points: GridPoint[] = [];
    for (let y = 0; y < this.layout.rows; y++)
      for (let x = 0; x < this.layout.cols; x++) {
        const t = this.layout.terrain[y]![x];
        if ((t === 'road' || t === 'plaza') && isWalkable(this.layout, x, y)) points.push({ x, y });
      }
    return points;
  }

  // --- Eingabe -------------------------------------------------------------------

  private pick(pointer: PointerInfo): Target | null {
    this.raycaster.setFromCamera(pointer.ndc, this.rig.camera);
    const hits = this.raycaster.intersectObjects([...this.proxies, this.terrain.pick], false);
    for (const hit of hits) {
      const target = hit.object.userData['target'] as Target | undefined;
      if (target) return target;
      if (hit.object === this.terrain.pick && hit.instanceId !== undefined) {
        const tile = this.terrain.tileOf[hit.instanceId];
        if (tile) return { kind: 'ground', tile };
      }
    }
    return null;
  }

  pointerMove(pointer: PointerInfo): void {
    if (this.minigame || this.bridge.isPanelOpen()) {
      this.setHover(null, pointer);
      return;
    }
    this.setHover(this.pick(pointer), pointer);
  }

  pointerLeave(): void {
    this.setHover(null, null);
  }

  private setHover(target: Target | null, pointer: PointerInfo | null): void {
    this.hoverRect.visible = false;
    this.tileMarker.visible = false;
    if (!target || !pointer) {
      this.overlay.hideTooltip();
      return;
    }
    switch (target.kind) {
      case 'building': {
        const b = target.building;
        const top = this.footprintTop(b) + 0.05;
        this.hoverRect.geometry.setFromPoints([
          new THREE.Vector3(b.x + 0.05, top, b.y + 0.05),
          new THREE.Vector3(b.x + b.w - 0.05, top, b.y + 0.05),
          new THREE.Vector3(b.x + b.w - 0.05, top, b.y + b.h - 0.05),
          new THREE.Vector3(b.x + 0.05, top, b.y + b.h - 0.05),
        ]);
        this.hoverRect.visible = true;
        // Tür markieren: dorthin läuft die Figur
        this.tileMarker.position.set(b.door.x, tileTop(this.layout, b.door.x, b.door.y) + 0.02, b.door.y);
        this.tileMarker.visible = true;
        this.overlay.showTooltip(b.label || 'Gebäude', pointer.clientX, pointer.clientY);
        break;
      }
      case 'ship':
        this.overlay.showTooltip(target.name, pointer.clientX, pointer.clientY);
        break;
      case 'spot': {
        const used = this.spots.get(target.spot.id)?.used;
        this.overlay.showTooltip(
          `${ACTIVITY_NAMES[target.spot.activity]}${used ? ' (erschöpft)' : ''}`,
          pointer.clientX,
          pointer.clientY,
        );
        break;
      }
      case 'ground': {
        this.overlay.hideTooltip();
        const { x, y } = target.tile;
        if (isWalkable(this.layout, x, y)) {
          this.tileMarker.position.set(x, tileTop(this.layout, x, y) + 0.02, y);
          this.tileMarker.visible = true;
        }
        break;
      }
    }
  }

  click(pointer: PointerInfo): void {
    if (this.minigame) {
      this.finishMinigame(performance.now());
      return;
    }
    if (this.bridge.isPanelOpen()) return;
    const target = this.pick(pointer);
    if (!target) return;
    // Fenster gehen immer auf; Laufen und Sammeln nur, wenn die Figur nicht beschäftigt ist.
    if (this.isBusy() && target.kind !== 'ship' && !(target.kind === 'building' && target.building.panel))
      return;
    switch (target.kind) {
      case 'building':
        this.openBuilding(target.building);
        break;
      case 'spot':
        this.goToSpot(target.spot);
        break;
      case 'ship':
        this.openShip(target.berth, target.panel);
        break;
      case 'ground':
        this.walkTo(target.tile, null, true);
        break;
    }
  }

  /** Gedrückt gehaltene Maustaste: laufend neu auf den Boden unter dem Zeiger zielen. */
  hold(pointer: PointerInfo): void {
    if (this.minigame || this.bridge.isPanelOpen() || this.isBusy()) return;
    const target = this.pick(pointer);
    if (target?.kind === 'ground') this.walkTo(target.tile, null, false);
  }

  rotate(dx: number, dy: number): void {
    this.rig.rotate(dx, dy);
  }

  zoom(deltaY: number): void {
    this.rig.zoom(deltaY);
  }

  key(event: KeyboardEvent): boolean {
    if (this.minigame && (event.key === 'e' || event.key === 'E' || event.key === ' ')) {
      this.finishMinigame(performance.now());
      return true;
    }
    return false;
  }

  private isBusy(): boolean {
    const s = this.bridge.getState();
    return s.player.busyUntilTick > s.tick;
  }

  private distanceToTile(t: GridPoint): number {
    return Math.hypot(this.mover.position.x - (t.x + 0.5), this.mover.position.z - (t.y + 0.5));
  }

  private walkTo(tile: GridPoint, onArrive: (() => void) | null, showMarker: boolean): boolean {
    const goal = nearestWalkable(this.layout, tile, this.mover.tile);
    if (!goal) return false;
    const path = findPath(this.layout, this.mover.tile, goal);
    if (!path) {
      if (showMarker) this.floatAbovePlayer('Dort komme ich nicht hin.', '#f2c94c');
      return false;
    }
    this.mover.setPath(path, onArrive);
    if (showMarker) {
      this.clickMarker.position.set(goal.x + 0.5, tileTop(this.layout, goal.x, goal.y) + 0.03, goal.y + 0.5);
      this.clickAge = 0;
    }
    return true;
  }

  /**
   * Gebäude öffnen sofort ihr Fenster – die Figur muss nicht hinlaufen. Anwesenheit zählt je
   * Stadt (CLAUDE.md §2.3.2), nicht je Gebäude. Gebäude ohne Fenster: hinlaufen.
   */
  private openBuilding(b: PlacedBuilding): void {
    if (!b.panel) {
      this.walkTo(b.door, null, true);
      return;
    }
    if (!this.mover.moving) this.mover.face(b.x + b.w / 2, b.y + b.h / 2);
    this.bridge.openPanel(b.panel);
  }

  private openShip(berth: GridPoint, panel: PanelId): void {
    if (!this.mover.moving) this.mover.face(berth.x + 0.5, berth.y + 0.5);
    this.bridge.openPanel(panel);
  }

  private goToSpot(spot: GatherSpot): void {
    const visual = this.spots.get(spot.id);
    if (visual?.used) {
      this.floatAbovePlayer('Erschöpft – wächst nach.', '#f2c94c');
      return;
    }
    const start = () => this.startMinigame(spot);
    if (this.distanceToTile(spot) <= INTERACT_RANGE * 0.7) {
      this.mover.stop();
      start();
      return;
    }
    this.walkTo(spot, start, true);
  }

  // --- Minispiele (CLAUDE.md §2.3.6) ----------------------------------------------

  private startMinigame(spot: GatherSpot): void {
    if (this.isBusy() || this.spots.get(spot.id)?.used) return;
    const facing =
      spot.activity === 'fish' ? { x: spot.x + 0.5, z: spot.y + 2 } : { x: spot.x + 0.5, z: spot.y + 0.5 };
    if (spot.activity !== 'fish' && this.distanceToTile(spot) < 0.3) {
      // Auf dem Sammelplatz stehend: einen halben Schritt zurück, damit man ihn sieht
      this.mover.position.z += 0.45;
    }
    this.mover.face(facing.x, facing.z);
    const now = performance.now();
    if (spot.activity === 'fish') {
      this.minigame = {
        spot,
        started: now,
        zoneCenter: 0,
        zoneHalf: 0,
        biteAt: now + 1200 + Math.random() * 2500,
        bitten: false,
      };
      this.overlay.openMinigame(ACTIVITY_NAMES.fish, 'Wartet auf den Biss … dann klicken oder [E]!', false);
    } else {
      const zoneHalf = 0.06 + Math.random() * 0.05;
      const zoneCenter = zoneHalf + Math.random() * (1 - 2 * zoneHalf);
      this.minigame = { spot, started: now, zoneCenter, zoneHalf, biteAt: 0, bitten: false };
      this.overlay.openMinigame(
        ACTIVITY_NAMES[spot.activity],
        'Im grünen Bereich klicken oder [E] drücken',
        true,
        {
          center: zoneCenter,
          half: zoneHalf,
        },
      );
    }
    this.setHover(null, null);
  }

  private updateMinigame(now: number): void {
    const mg = this.minigame!;
    if (mg.spot.activity !== 'fish') {
      this.overlay.setMinigameMarker(markerPosition(now - mg.started, MINIGAME_PERIOD_MS));
      return;
    }
    if (!mg.bitten && now >= mg.biteAt) {
      mg.bitten = true;
      this.overlay.setMinigameHint('BISS! Jetzt klicken!', true);
      this.rig.shake(0.05, 0.12);
    } else if (now > mg.biteAt + 1500) {
      this.finishMinigame(now);
    }
  }

  private finishMinigame(now: number): void {
    const mg = this.minigame;
    if (!mg) return;
    this.minigame = null;
    this.overlay.closeMinigame();
    const quality =
      mg.spot.activity === 'fish'
        ? reactionQuality(now - mg.biteAt)
        : timingQuality(markerPosition(now - mg.started, MINIGAME_PERIOD_MS), mg.zoneCenter, mg.zoneHalf);
    const result = this.bridge.send({ type: 'Gather', activity: mg.spot.activity, quality });
    if (!result.ok) return;
    const good = GATHERING[mg.spot.activity].good;
    this.floatAbovePlayer(
      `${quality >= 0.9 ? 'Perfekt! ' : quality < 0.3 ? 'Daneben … ' : ''}+${GOODS[good].name}`,
      quality >= 0.5 ? '#b6f28a' : '#f2c94c',
    );
    if (mg.spot.activity === 'wood' || mg.spot.activity === 'stone') this.rig.shake(0.1, 0.15);
    // Ein Sammelplatz ist danach eine Weile erschöpft (wächst nach).
    if (mg.spot.activity !== 'fish') this.setSpotUsed(mg.spot.id, true);
  }

  private setSpotUsed(id: string, used: boolean): void {
    const visual = this.spots.get(id);
    if (!visual) return;
    visual.used = used;
    visual.group.clear();
    visual.group.add(this.spotModel(visual.spot, used));
    if (used) setTimeout(() => this.spots.get(id) === visual && this.setSpotUsed(id, false), SPOT_REGROW_MS);
  }

  // --- Ablauf --------------------------------------------------------------------

  private focusPoint(): THREE.Vector3 {
    return new THREE.Vector3(this.mover.position.x, this.mover.position.y, this.mover.position.z);
  }

  toScreen(p: THREE.Vector3, width: number, height: number): { x: number; y: number } {
    const v = p.clone().project(this.rig.camera);
    return { x: ((v.x + 1) / 2) * width, y: ((1 - v.y) / 2) * height };
  }

  private screenSize = { width: 1, height: 1 };

  resize(width: number, height: number): void {
    this.screenSize = { width, height };
    this.rig.resize(width, height);
  }

  private floatAbovePlayer(text: string, color: string): void {
    const p = this.toScreen(
      this.mover.position.clone().add(new THREE.Vector3(0, 1.3, 0)),
      this.screenSize.width,
      this.screenSize.height,
    );
    this.overlay.floatText(text, p.x, p.y, color);
  }

  update(dt: number): void {
    this.elapsed += dt;
    const now = performance.now();
    const state = this.bridge.getState();
    const busy = state.player.busyUntilTick > state.tick;

    if (this.minigame) {
      this.updateMinigame(now);
      animateWork(this.player, dt);
    } else {
      if (busy || this.bridge.isPanelOpen()) this.mover.stop();
      this.mover.update(dt);
      animateFigure(this.player, dt, this.mover.currentSpeed);
    }
    this.player.root.position.copy(this.mover.position);
    this.player.root.rotation.y = this.mover.heading;
    lastPositions.set(this.cityId, { x: this.mover.position.x, z: this.mover.position.z });

    // Fortschritt einer längeren Tätigkeit (Tagesarbeit, Bau …)
    if (busy) {
      const left = state.player.busyUntilTick - state.tick;
      this.busyMax = Math.max(this.busyMax, left);
      const p = this.toScreen(
        this.mover.position.clone().add(new THREE.Vector3(0, 1.25, 0)),
        this.screenSize.width,
        this.screenSize.height,
      );
      this.overlay.showBusy(1 - left / Math.max(1, this.busyMax), p.x, p.y);
    } else {
      this.busyMax = 0;
      this.overlay.showBusy(null);
    }

    if (Math.floor(this.elapsed) !== Math.floor(this.elapsed - dt)) this.syncShips();
    for (const w of this.walkers) this.updateWalker(w, dt);
    this.animateWorld(dt);
    this.applyDaylight(false, dt);
    this.rig.update(dt, this.focusPoint());
  }

  private updateWalker(w: Walker, dt: number): void {
    if (!w.mover.moving) {
      w.wait -= dt;
      if (w.wait <= 0) {
        const points = this.streetTilesCache ?? (this.streetTilesCache = this.streetTiles());
        const goal = points[Math.floor(Math.random() * points.length)]!;
        const path = findPath(this.layout, w.mover.tile, goal);
        if (path) w.mover.setPath(path);
        w.wait = 1 + Math.random() * 4;
      }
    }
    w.mover.update(dt);
    animateFigure(w.figure, dt, w.mover.currentSpeed);
    w.figure.root.position.copy(w.mover.position);
    w.figure.root.rotation.y = w.mover.heading;
  }

  private streetTilesCache: GridPoint[] | null = null;

  private animateWorld(dt: number): void {
    const t = this.elapsed;
    animateWater(this.terrain.water, t);
    this.animateSnow(dt);
    for (const s of this.spinners) s.rotateZ(dt * 0.8);
    for (const f of this.fires) f.update(dt);
    for (const f of this.fires.filter((x) => x.done)) f.dispose();
    this.fires = this.fires.filter((x) => !x.done);
    for (const s of this.ships) {
      s.group.position.y = s.baseY + Math.sin(t * 1.1 + s.phase) * 0.06;
      s.group.rotation.z = Math.sin(t * 0.9 + s.phase) * 0.025;
      s.group.rotation.x = Math.cos(t * 0.7 + s.phase) * 0.02;
    }
    for (const p of this.puffs) {
      p.age += dt;
      if (p.age > p.life) p.age -= p.life;
      const k = p.age / p.life;
      p.mesh.position.set(
        p.origin.x + k * 0.6 + Math.sin(t + k * 4) * 0.08,
        p.origin.y + k * 1.6,
        p.origin.z - k * 0.2,
      );
      p.mesh.scale.setScalar(0.6 + k * 1.8);
      (p.mesh.material as THREE.MeshStandardMaterial).opacity = 0.45;
      p.mesh.visible = k < 0.92;
    }
    for (const f of this.faeries)
      f.position.y =
        Math.sin(t * 2 + f.position.x) * 0.03 +
        tileTop(this.layout, Math.floor(f.position.x), Math.floor(f.position.z));
    SPOT_RING_MATERIAL.opacity = 0.4 + Math.sin(t * 2.5) * 0.15;
    for (const r of this.fishRings) {
      const k = (t * 0.6) % 1;
      r.scale.setScalar(0.6 + k * 1.6);
      (r.material as THREE.MeshBasicMaterial).opacity = 0.7 * (1 - k);
    }
    if (this.clickAge < 1) {
      this.clickAge += dt * 1.6;
      const m = this.clickMarker.material as THREE.MeshBasicMaterial;
      m.opacity = Math.max(0, 1 - this.clickAge);
      this.clickMarker.scale.setScalar(1.3 - this.clickAge * 0.6);
    }
    if (this.tileMarker.visible)
      (this.tileMarker.material as THREE.LineBasicMaterial).opacity = 0.4 + Math.sin(t * 5) * 0.15;
  }

  /** Tag/Nacht aus der Spielzeit: Sonne, Himmel, Laternen und Fenster. */
  private applyDaylight(snap: boolean, dt = 0): void {
    const clock = clockView(this.bridge.getState());
    const day = clock.daylight;
    const night = 1 - THREE.MathUtils.smoothstep(day, 0.05, 0.45);
    this.nightLevel = snap ? night : this.nightLevel + (night - this.nightLevel) * Math.min(1, dt * 1.5);
    const n = this.nightLevel;
    const cx = this.layout.cols / 2;
    const cz = this.layout.rows / 2;
    const az = ((clock.hour - 12) / 12) * Math.PI * 0.6;
    this.sun.position.set(cx + Math.sin(az) * 30, 38, cz + 22 + Math.cos(az) * 6);
    this.sun.intensity = THREE.MathUtils.lerp(this.winter ? 1.6 : 2.5, 0.35, n);
    this.sun.color.setHex(n > 0.5 ? 0x9fb4ff : day < 0.5 ? 0xffc890 : 0xfff0d0);
    this.hemi.intensity = THREE.MathUtils.lerp(1.15, 0.35, n);
    const sky = (this.scene.background as THREE.Color).copy(this.skyDay).lerp(this.skyNight, n);
    const fog = this.scene.fog as THREE.Fog;
    fog.color.copy(sky);
    // Seuche: grünlicher, dichter Dunst über der Stadt
    const state = this.bridge.getState();
    const plague = (state.cities[this.cityId].plagueUntilTick ?? 0) > state.tick;
    if (plague) fog.color.lerp(PLAGUE_FOG, 0.45);
    fog.near = plague ? 30 : 40;
    fog.far = plague ? 75 : 85;
    setNightGlow(n);
    for (const l of this.lampLights) l.intensity = n * 3;
    for (const l of this.beacons) l.intensity = n * 12;
    (this.terrain.water.material as THREE.MeshStandardMaterial).emissive.setHex(0x0a1830).multiplyScalar(n);
  }

  /** Ein zufälliges Gebäude brennt eine Weile (die Simulation rechnet den Schaden sofort ab). */
  private startFire(): void {
    this.overlay.flash('#ff7a2a', 900);
    const candidates = this.layout.buildings.filter(
      (b) => b.kind === 'house' || b.kind === 'business' || b.kind === 'tavern',
    );
    const b = candidates[Math.floor(Math.random() * candidates.length)];
    if (!b) return;
    const fire = new FireEffect(
      new THREE.Vector3(b.x + b.w / 2, this.footprintTop(b) + 1.6, b.y + b.h / 2),
      Math.min(b.w, b.h) * 0.7,
    );
    this.scene.add(fire.group);
    this.fires.push(fire);
    this.rig.shake(0.08, 0.4);
  }

  private onSimEvents(events: SimEvent[]): void {
    for (const e of events) {
      if (e.type === 'GoodsTraded' && e.cityId === this.cityId && e.direction === 'sell') {
        this.floatAbovePlayer(`+${Math.round(e.totalPrice)} GS`, '#ffd166');
      }
      if (e.type === 'FireBrokeOut' && e.cityId === this.cityId) this.startFire();
    }
  }

  dispose(): void {
    this.unsubscribe();
    this.overlay.closeMinigame();
    this.overlay.hideTooltip();
    this.overlay.showBusy(null);
    this.minigame = null;
    this.scene.traverse((o) => {
      if (o instanceof THREE.Mesh || o instanceof THREE.Line) o.geometry.dispose();
    });
    // Labels (CSS2DObject) hängen direkt an der Szene und entfernen ihr DOM-Element beim Entfernen.
    for (const child of [...this.scene.children]) this.scene.remove(child);
    this.sun.shadow.map?.dispose();
  }
}
