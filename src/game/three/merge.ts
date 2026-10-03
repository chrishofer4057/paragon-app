import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * Fasst alle Meshes einer statischen Gruppe nach Material zu wenigen großen Meshes zusammen.
 * Aus ein paar tausend Bauteilen werden so einige Dutzend Draw-Calls. Instanzierte Meshes
 * bleiben unverändert.
 */
export function mergeStatic(root: THREE.Object3D): THREE.Group {
  root.updateMatrixWorld(true);
  const buckets = new Map<THREE.Material, { geos: THREE.BufferGeometry[]; cast: boolean }>();
  const keep: THREE.Object3D[] = [];
  root.traverse((o) => {
    if (o instanceof THREE.InstancedMesh) {
      keep.push(o);
      return;
    }
    if (!(o instanceof THREE.Mesh) || Array.isArray(o.material)) return;
    const material = o.material as THREE.Material;
    let g = (o.geometry as THREE.BufferGeometry).clone();
    if (g.index) g = g.toNonIndexed();
    // Gleiche Attribute je Material, sonst lässt sich nicht zusammenfassen.
    const attrs = new Set(['position', 'normal']);
    if ('map' in material && material.map) attrs.add('uv');
    if (material.vertexColors) attrs.add('color');
    for (const name of Object.keys(g.attributes)) if (!attrs.has(name)) g.deleteAttribute(name);
    if (!g.attributes['normal']) g.computeVertexNormals();
    if (attrs.has('uv') && !g.attributes['uv'])
      g.setAttribute(
        'uv',
        new THREE.BufferAttribute(new Float32Array(g.attributes['position']!.count * 2), 2),
      );
    if (attrs.has('color') && !g.attributes['color'])
      g.setAttribute(
        'color',
        new THREE.BufferAttribute(new Float32Array(g.attributes['position']!.count * 3).fill(1), 3),
      );
    g.morphAttributes = {};
    g.applyMatrix4(o.matrixWorld);
    let bucket = buckets.get(material);
    if (!bucket) {
      bucket = { geos: [], cast: false };
      buckets.set(material, bucket);
    }
    bucket.geos.push(g);
    bucket.cast ||= o.castShadow;
  });
  const out = new THREE.Group();
  for (const [material, { geos, cast }] of buckets) {
    const merged = mergeGeometries(geos, false);
    for (const g of geos) g.dispose();
    if (!merged) continue;
    const m = new THREE.Mesh(merged, material);
    m.castShadow = cast;
    m.receiveShadow = true;
    out.add(m);
  }
  for (const o of keep) {
    o.updateMatrixWorld(true);
    o.matrixWorld.decompose(o.position, o.quaternion, o.scale);
    out.add(o);
  }
  return out;
}

/** Gibt Geometrien eines Teilbaums frei (Materialien sind geteilt und bleiben). */
export function disposeTree(root: THREE.Object3D): void {
  root.traverse((o) => {
    if (o instanceof THREE.Mesh) o.geometry.dispose();
  });
}
