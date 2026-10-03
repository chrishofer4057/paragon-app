import * as THREE from 'three';
import { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import type { GameBridge } from '../../bridge/bridge';
import { CITIES, CITY_IDS, type CityId } from '../../sim/data/cities';
import { hashFloat } from '../../sim/rng';
import { CameraRig } from './cameraRig';
import { PALETTE } from './materials';
import { box, cone, cylinder, dome, sphere } from './models/shapes';
import { ship } from './models/ships';
import type { Overlay } from './overlay';
import type { WorldView } from './view';

/** Kartenkoordinaten (0..100) → Welt. */
const SCALE_X = 1.4;
const SCALE_Z = 1.0;

function toWorld(mapX: number, mapY: number): THREE.Vector3 {
  return new THREE.Vector3(mapX * SCALE_X, 0, mapY * SCALE_Z);
}

function cityPos(id: CityId): THREE.Vector3 {
  const c = CITIES[id];
  return toWorld(c.mapX, c.mapY);
}

/**
 * Weltkarte in 3D (CLAUDE.md §5.3): sichtbar, solange die Figur unterwegs ist. Inseln mit
 * Städten, eigene Schiffe auf See, das Schiff der Figur. Ziele wählt man in der Oberfläche.
 */
export class WorldMapView implements WorldView {
  readonly scene = new THREE.Scene();
  readonly rig: CameraRig;
  private readonly water: THREE.Mesh;
  private readonly waterBase: Float32Array;
  private readonly traveler: THREE.Group;
  private readonly route: THREE.Line;
  private readonly shipMarkers = new Map<string, THREE.Group>();
  private elapsed = 0;

  constructor(
    private readonly bridge: GameBridge,
    private readonly overlay: Overlay,
    aspect: number,
  ) {
    this.rig = new CameraRig(aspect);
    this.rig.distance = 48;
    this.rig.minDistance = 20;
    this.rig.maxDistance = 120;
    this.rig.pitch = 1.05;
    this.scene.background = new THREE.Color(0x8fc6e4);
    this.scene.fog = new THREE.Fog(0x8fc6e4, 90, 220);
    this.scene.add(new THREE.HemisphereLight(0xfff4dc, 0x2a5f80, 1.2));
    const sun = new THREE.DirectionalLight(0xfff0d0, 2.2);
    sun.position.set(60, 80, 90);
    sun.target.position.set(70, 0, 50);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -90, right: 90, top: 70, bottom: -70, near: 1, far: 260 });
    this.scene.add(sun, sun.target);

    const geo = new THREE.PlaneGeometry(260, 200, 90, 70).rotateX(-Math.PI / 2).translate(70, -0.15, 50);
    this.water = new THREE.Mesh(
      geo,
      new THREE.MeshStandardMaterial({ color: 0x2a86b8, roughness: 0.3, flatShading: true }),
    );
    this.water.receiveShadow = true;
    this.waterBase = Float32Array.from((geo.attributes['position'] as THREE.BufferAttribute).array);
    this.scene.add(this.water);

    for (const id of CITY_IDS) this.addIsland(id);

    this.traveler = ship(0xf4ecd8, 0xc0392b, 1.5);
    this.scene.add(this.traveler);
    this.route = new THREE.Line(
      new THREE.BufferGeometry(),
      new THREE.LineDashedMaterial({
        color: 0xfff8e7,
        dashSize: 0.8,
        gapSize: 0.6,
        transparent: true,
        opacity: 0.8,
      }),
    );
    this.scene.add(this.route);
    this.overlay.setBanner('Auf Reisen – die Zeit läuft schneller');
    this.update(0);
    this.rig.update(0, this.traveler.position, true);
  }

  get camera(): THREE.Camera {
    return this.rig.camera;
  }

  private addIsland(id: CityId): void {
    const c = CITIES[id];
    const pal = PALETTE[c.culture];
    const p = cityPos(id);
    const k = CITY_IDS.indexOf(id);
    const island = new THREE.Group();
    island.position.copy(p);
    // Landmasse aus ein paar überlappenden flachen Hügeln
    for (let i = 0; i < 5; i++) {
      const r = 2.2 + hashFloat(0x15, k, i) * 2.2;
      const blob = cylinder(r, r + 0.5, 0.6 + hashFloat(0x16, k, i) * 0.5, pal.ground, 9);
      blob.position.set((hashFloat(0x17, k, i) - 0.5) * 5, -0.4, (hashFloat(0x18, k, i) - 0.5) * 3.5);
      island.add(blob);
      const beach = cylinder(r + 0.55, r + 0.75, 0.3, pal.sand, 9);
      beach.position.copy(blob.position).setY(-0.45);
      island.add(beach);
    }
    // Ein paar Häuser
    for (let i = 0; i < 4 + (c.size === 'large' ? 3 : 0); i++) {
      const hx = (hashFloat(0x19, k, i) - 0.5) * 3;
      const hz = (hashFloat(0x1a, k, i) - 0.5) * 2;
      const house = box(0.55, 0.5, 0.55, pal.wall);
      house.position.set(hx, 0.4, hz);
      island.add(house);
      if (c.culture === 'north') {
        const roof = cone(0.48, 0.55, pal.roofs[i % pal.roofs.length]!, 4);
        roof.rotation.y = Math.PI / 4;
        roof.position.set(hx, 0.9, hz);
        island.add(roof);
      } else {
        const d = dome(0.24, pal.roofs[0]!);
        d.position.set(hx, 0.9, hz);
        island.add(d);
      }
    }
    for (let i = 0; i < 4; i++) {
      const t = sphere(0.35, pal.foliage);
      t.position.set((hashFloat(0x1b, k, i) - 0.5) * 6, 0.6, (hashFloat(0x1c, k, i) - 0.5) * 4);
      island.add(t);
    }
    island.traverse((o) => {
      if (o instanceof THREE.Mesh) o.castShadow = true;
    });
    this.scene.add(island);
    const el = document.createElement('div');
    el.className = 'world-label';
    el.textContent = c.name;
    const label = new CSS2DObject(el);
    label.position.set(p.x, 2.2, p.z);
    this.scene.add(label);
  }

  pointerMove(): void {}
  pointerLeave(): void {}
  click(): void {}
  hold(): void {}
  key(): boolean {
    return false;
  }

  rotate(dx: number, dy: number): void {
    this.rig.rotate(dx, dy);
  }

  zoom(deltaY: number): void {
    this.rig.zoom(deltaY);
  }

  resize(width: number, height: number): void {
    this.rig.resize(width, height);
  }

  update(dt: number): void {
    this.elapsed += dt;
    const t = this.elapsed;
    const state = this.bridge.getState();
    const loc = state.player.location;
    if (loc.kind === 'travel') {
      const k = Math.min(1, (state.tick - loc.departTick) / Math.max(1, loc.arriveTick - loc.departTick));
      const a = cityPos(loc.from);
      const b = cityPos(loc.to);
      this.traveler.position.lerpVectors(a, b, k).setY(Math.sin(t * 1.4) * 0.05);
      this.traveler.rotation.y = Math.atan2(-(b.z - a.z), b.x - a.x);
      this.traveler.rotation.z = Math.sin(t * 1.1) * 0.04;
      this.route.geometry.setFromPoints([a.clone().setY(0.05), b.clone().setY(0.05)]);
      this.route.computeLineDistances();
    }
    for (const s of Object.values(state.ships)) {
      if (s.location.kind !== 'sea') {
        const old = this.shipMarkers.get(s.id);
        if (old) {
          this.scene.remove(old);
          this.shipMarkers.delete(s.id);
        }
        continue;
      }
      const l = s.location;
      const k = Math.min(1, (state.tick - l.departTick) / Math.max(1, l.arriveTick - l.departTick));
      let marker = this.shipMarkers.get(s.id);
      if (!marker) {
        marker = ship(0xf4ecd8, 0x2f5f9e, 0.9);
        this.scene.add(marker);
        this.shipMarkers.set(s.id, marker);
      }
      const a = cityPos(l.from);
      const b = cityPos(l.to);
      marker.position.lerpVectors(a, b, k).setY(0);
      marker.rotation.y = Math.atan2(-(b.z - a.z), b.x - a.x);
    }
    const pos = this.water.geometry.attributes['position'] as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const x = this.waterBase[i * 3]!;
      const z = this.waterBase[i * 3 + 2]!;
      pos.setY(
        i,
        this.waterBase[i * 3 + 1]! + Math.sin(x * 0.35 + t) * 0.08 + Math.cos(z * 0.4 + t * 0.8) * 0.08,
      );
    }
    pos.needsUpdate = true;
    this.rig.update(dt, this.traveler.position);
  }

  dispose(): void {
    this.overlay.setBanner(null);
    this.scene.traverse((o) => {
      if (o instanceof THREE.Mesh || o instanceof THREE.Line) o.geometry.dispose();
    });
    for (const child of [...this.scene.children]) this.scene.remove(child);
  }
}
