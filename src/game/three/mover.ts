import * as THREE from 'three';
import type { CityLayout } from '../cityLayout';
import type { GridPoint } from '../world/pathfinding';
import { groundHeight } from './terrain';

/** Bewegt eine Figur weich entlang eines Kachelpfads und dreht sie in Laufrichtung. */
export class Mover {
  readonly position = new THREE.Vector3();
  heading = 0;
  /** Tatsächliche Geschwindigkeit im letzten Schritt (für die Animation). */
  currentSpeed = 0;
  private path: GridPoint[] = [];
  private onArrive: (() => void) | null = null;

  constructor(
    private readonly layout: CityLayout,
    public speed: number,
  ) {}

  get tile(): GridPoint {
    return { x: Math.floor(this.position.x), y: Math.floor(this.position.z) };
  }

  get moving(): boolean {
    return this.path.length > 0;
  }

  get destination(): GridPoint | null {
    return this.path.at(-1) ?? null;
  }

  placeAt(x: number, z: number): void {
    this.position.set(x, groundHeight(this.layout, x, z), z);
  }

  setPath(path: GridPoint[], onArrive: (() => void) | null = null): void {
    this.path = path.slice();
    this.onArrive = onArrive;
    if (this.path.length === 0) this.arrive();
  }

  stop(): void {
    this.path = [];
    this.onArrive = null;
  }

  face(x: number, z: number): void {
    this.heading = Math.atan2(x - this.position.x, z - this.position.z);
  }

  update(dt: number): void {
    this.currentSpeed = 0;
    let budget = this.speed * dt;
    while (budget > 0 && this.path.length > 0) {
      const next = this.path[0]!;
      const tx = next.x + 0.5;
      const tz = next.y + 0.5;
      const dx = tx - this.position.x;
      const dz = tz - this.position.z;
      const dist = Math.hypot(dx, dz);
      // Ecken leicht abrunden: Zwischenpunkte gelten etwas früher als erreicht.
      const reach = this.path.length > 1 ? 0.25 : 0.02;
      if (dist <= Math.max(reach, budget)) {
        if (this.path.length === 1 || dist <= budget) {
          this.position.x = tx;
          this.position.z = tz;
          budget -= dist;
        }
        this.path.shift();
        if (this.path.length === 0) {
          this.arrive();
          break;
        }
        continue;
      }
      this.position.x += (dx / dist) * budget;
      this.position.z += (dz / dist) * budget;
      this.turnTowards(Math.atan2(dx, dz), dt);
      this.currentSpeed = this.speed;
      budget = 0;
    }
    const ground = groundHeight(this.layout, this.position.x, this.position.z);
    this.position.y += (ground - this.position.y) * Math.min(1, dt * 12);
  }

  private turnTowards(angle: number, dt: number): void {
    let diff = angle - this.heading;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    this.heading += diff * Math.min(1, dt * 12);
  }

  private arrive(): void {
    const cb = this.onArrive;
    this.onArrive = null;
    cb?.();
  }
}
