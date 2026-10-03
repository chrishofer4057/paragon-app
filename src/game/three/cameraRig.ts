import * as THREE from 'three';

/**
 * Schräge Draufsicht, die der Figur folgt (docs/ART_DIRECTION.md: hohe, isometrisch anmutende
 * Kamera). Mausrad zoomt, rechte/mittlere Maustaste dreht.
 */
export class CameraRig {
  readonly camera: THREE.PerspectiveCamera;
  readonly target = new THREE.Vector3();
  yaw = 0;
  pitch = 0.92;
  distance = 24;
  minDistance = 7;
  maxDistance = 45;
  private shakeTime = 0;
  private shakeStrength = 0;

  constructor(aspect: number) {
    this.camera = new THREE.PerspectiveCamera(38, aspect, 0.1, 400);
  }

  resize(width: number, height: number): void {
    this.camera.aspect = width / Math.max(1, height);
    this.camera.updateProjectionMatrix();
  }

  zoom(deltaY: number): void {
    this.distance = THREE.MathUtils.clamp(
      this.distance * Math.exp(deltaY * 0.0012),
      this.minDistance,
      this.maxDistance,
    );
  }

  rotate(dx: number, dy: number): void {
    this.yaw -= dx * 0.006;
    this.pitch = THREE.MathUtils.clamp(this.pitch + dy * 0.004, 0.45, 1.35);
  }

  shake(strength = 0.08, seconds = 0.15): void {
    this.shakeStrength = strength;
    this.shakeTime = seconds;
  }

  /** Folgt `focus` weich; `snap` springt sofort dorthin. */
  update(dt: number, focus: THREE.Vector3, snap = false): void {
    if (snap) this.target.copy(focus);
    else this.target.lerp(focus, 1 - Math.exp(-dt * 6));
    const horizontal = Math.cos(this.pitch) * this.distance;
    this.camera.position.set(
      this.target.x + Math.sin(this.yaw) * horizontal,
      this.target.y + Math.sin(this.pitch) * this.distance,
      this.target.z + Math.cos(this.yaw) * horizontal,
    );
    if (this.shakeTime > 0) {
      this.shakeTime -= dt;
      const s = this.shakeStrength;
      this.camera.position.x += (Math.random() - 0.5) * s;
      this.camera.position.y += (Math.random() - 0.5) * s;
    }
    this.camera.lookAt(this.target.x, this.target.y + 0.4, this.target.z);
  }
}
