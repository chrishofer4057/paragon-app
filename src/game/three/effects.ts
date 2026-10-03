import * as THREE from 'three';

/** Brand an einem Gebäude: flackernde Flammen, Funkenlicht und dunkler Rauch, verlischt nach `seconds`. */
export class FireEffect {
  readonly group = new THREE.Group();
  private readonly flames: THREE.Mesh[] = [];
  private readonly smoke: { mesh: THREE.Mesh; age: number }[] = [];
  private readonly light: THREE.PointLight;
  private age = 0;

  constructor(
    position: THREE.Vector3,
    private readonly width: number,
    private readonly seconds = 45,
  ) {
    this.group.position.copy(position);
    const flameMat = new THREE.MeshBasicMaterial({ color: 0xffa23a, transparent: true, opacity: 0.9 });
    const coreMat = new THREE.MeshBasicMaterial({ color: 0xfff1a0, transparent: true, opacity: 0.9 });
    for (let i = 0; i < 9; i++) {
      const flame = new THREE.Mesh(
        new THREE.ConeGeometry(0.22, 0.9, 6).translate(0, 0.45, 0),
        i % 3 ? flameMat : coreMat,
      );
      flame.position.set((Math.random() - 0.5) * width, 0, (Math.random() - 0.5) * width);
      flame.userData['phase'] = Math.random() * 10;
      this.group.add(flame);
      this.flames.push(flame);
    }
    const smokeMat = new THREE.MeshStandardMaterial({
      color: 0x3a3632,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
      flatShading: true,
    });
    for (let i = 0; i < 10; i++) {
      const puff = new THREE.Mesh(new THREE.IcosahedronGeometry(0.3, 0), smokeMat);
      this.group.add(puff);
      this.smoke.push({ mesh: puff, age: i * 0.4 });
    }
    this.light = new THREE.PointLight(0xff8a2a, 6, 12, 1.5);
    this.light.position.y = 1;
    this.group.add(this.light);
  }

  get done(): boolean {
    return this.age >= this.seconds;
  }

  update(dt: number): void {
    this.age += dt;
    // Gegen Ende kleiner werden
    const strength = Math.min(1, (this.seconds - this.age) / 8);
    for (const f of this.flames) {
      const p = (f.userData['phase'] as number) + this.age * 9;
      const s = (0.7 + Math.sin(p) * 0.25 + Math.sin(p * 2.3) * 0.1) * Math.max(0, strength);
      f.scale.set(s, s * (1 + Math.sin(p * 1.7) * 0.3), s);
    }
    for (const puff of this.smoke) {
      puff.age = (puff.age + dt) % 4;
      const k = puff.age / 4;
      puff.mesh.position.set(
        Math.sin(puff.age * 3) * this.width * 0.2 + k * 0.8,
        0.6 + k * 3.5,
        Math.cos(puff.age * 2) * 0.2,
      );
      puff.mesh.scale.setScalar((0.35 + k * 1.3) * Math.max(0.2, strength));
    }
    this.light.intensity = (5 + Math.sin(this.age * 23) * 1.5) * Math.max(0, strength);
  }

  dispose(): void {
    this.group.removeFromParent();
    this.group.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.geometry.dispose();
        (o.material as THREE.Material).dispose();
      }
    });
  }
}
