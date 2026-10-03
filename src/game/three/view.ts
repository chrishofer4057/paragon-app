import type * as THREE from 'three';

/** Mausposition: normalisiert (-1..1) für Raycasts und in Pixeln relativ zur Spielfläche. */
export interface PointerInfo {
  ndc: THREE.Vector2;
  clientX: number;
  clientY: number;
}

/** Eine 3D-Ansicht (Stadt oder Weltkarte), die `createWorld` rendert und mit Eingaben füttert. */
export interface WorldView {
  readonly scene: THREE.Scene;
  readonly camera: THREE.Camera;
  update(dt: number): void;
  resize(width: number, height: number): void;
  pointerMove(pointer: PointerInfo): void;
  pointerLeave(): void;
  click(pointer: PointerInfo): void;
  hold(pointer: PointerInfo): void;
  /** Drehen mit gedrückter rechter/mittlerer Maustaste. */
  rotate(dx: number, dy: number): void;
  zoom(deltaY: number): void;
  /** true, wenn die Taste verbraucht wurde. */
  key(event: KeyboardEvent): boolean;
  dispose(): void;
}
