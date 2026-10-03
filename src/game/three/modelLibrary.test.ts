import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { ModelLibrary, normalizeFootprint, normalizeModel } from './modelLibrary';

describe('Modellbibliothek', () => {
  it('stellt ein Modell auf den Boden, zentriert es und skaliert auf die Zielhöhe', () => {
    // Unity-typisch: 300 Einheiten hoch, Ursprung irgendwo
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(100, 300, 50));
    mesh.position.set(40, 500, -20);
    const model = normalizeModel(mesh, 2);
    const box = new THREE.Box3().setFromObject(model);
    expect(box.min.y).toBeCloseTo(0);
    expect(box.max.y).toBeCloseTo(2);
    expect((box.min.x + box.max.x) / 2).toBeCloseTo(0);
    expect((box.min.z + box.max.z) / 2).toBeCloseTo(0);
  });

  it('Gebäude werden auf eine Grundfläche von 1 Kachel gebracht, Proportionen bleiben', () => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(260, 300, 240));
    const model = normalizeFootprint(mesh);
    const size = new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3());
    expect(Math.max(size.x, size.z)).toBeCloseTo(1);
    expect(size.y / size.x).toBeCloseTo(300 / 260);
    expect(new THREE.Box3().setFromObject(model).min.y).toBeCloseTo(0);
  });

  it('liefert Varianten reihum und null für fehlende Schlüssel', () => {
    const lib = new ModelLibrary();
    const a = new THREE.Group();
    a.name = 'a';
    const b = new THREE.Group();
    b.name = 'b';
    lib.add('rock-north', a);
    lib.add('rock-north', b);
    expect(lib.instance('rock-north', 0)?.name).toBe('a');
    expect(lib.instance('rock-north', 3)?.name).toBe('b');
    expect(lib.instance('tree-north', 0)).toBeNull();
    expect(lib.has('rock-north')).toBe(true);
  });
});
