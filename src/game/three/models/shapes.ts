import * as THREE from 'three';
import { mat } from '../materials';

/** Kleine Bausteine für die prozeduralen Modelle. Alle Maße in Kacheln (1 = eine Kachel). */

const geoCache = new Map<string, THREE.BufferGeometry>();

function cached(key: string, make: () => THREE.BufferGeometry): THREE.BufferGeometry {
  let g = geoCache.get(key);
  if (!g) {
    g = make();
    geoCache.set(key, g);
  }
  return g;
}

export function shadowed<T extends THREE.Object3D>(obj: T, cast = true): T {
  obj.traverse((o) => {
    if (o instanceof THREE.Mesh) {
      o.castShadow = cast;
      o.receiveShadow = true;
    }
  });
  return obj;
}

export function mesh(geometry: THREE.BufferGeometry, material: THREE.Material | number): THREE.Mesh {
  const m = new THREE.Mesh(geometry, typeof material === 'number' ? mat(material) : material);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

/** Quader, der auf y = 0 steht (Boden ist die Unterkante). */
export function box(w: number, h: number, d: number, material: THREE.Material | number): THREE.Mesh {
  const g = cached(`box${w}|${h}|${d}`, () => new THREE.BoxGeometry(w, h, d).translate(0, h / 2, 0));
  return mesh(g, material);
}

export function cylinder(
  rTop: number,
  rBottom: number,
  h: number,
  material: THREE.Material | number,
  seg = 8,
): THREE.Mesh {
  const g = cached(`cyl${rTop}|${rBottom}|${h}|${seg}`, () =>
    new THREE.CylinderGeometry(rTop, rBottom, h, seg).translate(0, h / 2, 0),
  );
  return mesh(g, material);
}

export function cone(r: number, h: number, material: THREE.Material | number, seg = 8): THREE.Mesh {
  const g = cached(`cone${r}|${h}|${seg}`, () => new THREE.ConeGeometry(r, h, seg).translate(0, h / 2, 0));
  return mesh(g, material);
}

/** Halbkugel, Unterkante auf y = 0. */
export function dome(r: number, material: THREE.Material | number, seg = 14): THREE.Mesh {
  const g = cached(
    `dome${r}|${seg}`,
    () => new THREE.SphereGeometry(r, seg, Math.ceil(seg / 2), 0, Math.PI * 2, 0, Math.PI / 2),
  );
  return mesh(g, material);
}

export function sphere(r: number, material: THREE.Material | number, detail = 0): THREE.Mesh {
  const g = cached(`ico${r}|${detail}`, () => new THREE.IcosahedronGeometry(r, detail));
  return mesh(g, material);
}

/**
 * Satteldach: First entlang der x-Achse, Breite `w` (x), Tiefe `d` (z), Höhe `h`.
 * Unterkante auf y = 0, mittig.
 */
export function gableRoof(w: number, d: number, h: number, material: THREE.Material | number): THREE.Mesh {
  const g = cached(`gable${w}|${d}|${h}`, () => {
    const shape = new THREE.Shape();
    shape.moveTo(-d / 2, 0);
    shape.lineTo(d / 2, 0);
    shape.lineTo(0, h);
    shape.closePath();
    const geo = new THREE.ExtrudeGeometry(shape, { depth: w, bevelEnabled: false });
    geo.translate(0, 0, -w / 2);
    geo.rotateY(Math.PI / 2);
    return geo;
  });
  return mesh(g, material);
}

/** Giebelwand (Dreieck) als dünne Platte, für Fachwerk-Giebel. */
export function gableWall(
  d: number,
  h: number,
  thickness: number,
  material: THREE.Material | number,
): THREE.Mesh {
  const g = cached(`gwall${d}|${h}|${thickness}`, () => {
    const shape = new THREE.Shape();
    shape.moveTo(-d / 2, 0);
    shape.lineTo(d / 2, 0);
    shape.lineTo(0, h);
    shape.closePath();
    const geo = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false });
    geo.translate(0, 0, -thickness / 2);
    geo.rotateY(Math.PI / 2);
    return geo;
  });
  return mesh(g, material);
}

/** Walmdach / Pyramide über rechteckigem Grundriss. */
export function hipRoof(w: number, d: number, h: number, material: THREE.Material | number): THREE.Mesh {
  const g = cached(`hip${w}|${d}|${h}`, () => {
    const geo = new THREE.ConeGeometry(Math.SQRT1_2, 1, 4, 1).rotateY(Math.PI / 4);
    geo.scale(w, h, d);
    geo.translate(0, h / 2, 0);
    return geo;
  });
  return mesh(g, material);
}

/** Zinnenkranz auf einer rechteckigen Fläche (Oberkante bei y = 0 der Gruppe). */
export function crenellations(
  w: number,
  d: number,
  size: number,
  material: THREE.Material | number,
): THREE.Group {
  const group = new THREE.Group();
  const add = (x: number, z: number) => {
    const c = box(size, size, size, material);
    c.position.set(x, 0, z);
    group.add(c);
  };
  const nx = Math.max(2, Math.round(w / (size * 2)));
  const nz = Math.max(2, Math.round(d / (size * 2)));
  for (let i = 0; i <= nx; i++) {
    const x = -w / 2 + size / 2 + (i * (w - size)) / nx;
    add(x, -d / 2 + size / 2);
    add(x, d / 2 - size / 2);
  }
  for (let i = 1; i < nz; i++) {
    const z = -d / 2 + size / 2 + (i * (d - size)) / nz;
    add(-w / 2 + size / 2, z);
    add(w / 2 - size / 2, z);
  }
  return group;
}

/** Wimpel/Fahne an einer Stange. */
export function flag(height: number, color: number): THREE.Group {
  const g = new THREE.Group();
  g.add(cylinder(0.025, 0.025, height, 0x5a4632, 5));
  const cloth = box(0.4, 0.25, 0.02, color);
  cloth.position.set(0.2, height - 0.3, 0);
  g.add(cloth);
  return g;
}
