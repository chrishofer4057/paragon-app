import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

/**
 * Echte 3D-Modelle (GLB) statt der prozeduralen Platzhalter. Welche Datei wofür steht, regelt
 * `public/models/manifest.json`; fehlt ein Eintrag, bauen die Fabrikfunktionen in `models/`
 * weiter ihre Platzhalter. FBX-Quellen werden mit `tools/fbx2glb.py` umgewandelt.
 *
 * Manifest:
 * ```json
 * { "models": { "tree-north": { "files": ["pine_a.glb", "pine_b.glb"], "height": 2.2 } } }
 * ```
 * `height` ist die Zielhöhe in Kacheln; das Modell wird darauf skaliert und auf den Boden gestellt.
 */

export type ModelKey =
  | 'tree-north'
  | 'tree-south'
  | 'tree-choppable-north'
  | 'tree-choppable-south'
  | 'stump'
  | 'rock-north'
  | 'rock-south'
  | 'quarry-rock'
  | 'bush'
  | 'house-north'
  | 'house-south';

/** Gebäude werden auf ihre Grundfläche skaliert (größte Seite = 1 Kachel), nicht auf eine Höhe. */
export function isFootprintKey(key: ModelKey): boolean {
  return key.startsWith('house-');
}

/** Zielhöhen, falls das Manifest keine angibt. */
export const DEFAULT_HEIGHTS: Record<ModelKey, number> = {
  'tree-north': 2.2,
  'tree-south': 2.0,
  'tree-choppable-north': 2.0,
  'tree-choppable-south': 1.8,
  stump: 0.25,
  'rock-north': 0.55,
  'rock-south': 0.55,
  'quarry-rock': 0.6,
  bush: 0.4,
  'house-north': 3,
  'house-south': 2.5,
};

export interface ManifestEntry {
  files: string[];
  height?: number;
}

export interface Manifest {
  models: Partial<Record<ModelKey, ManifestEntry>>;
}

/**
 * Stellt ein Modell mittig auf den Boden (Fußpunkt 0,0,0) und skaliert es auf `height`.
 * Unity-Exporte haben oft beliebige Ursprünge und Zentimeter-Maßstab.
 */
export function normalizeModel(obj: THREE.Object3D, height: number): THREE.Group {
  const wrapper = new THREE.Group();
  wrapper.add(obj);
  wrapper.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(obj);
  const size = box.getSize(new THREE.Vector3());
  const scale = size.y > 0 ? height / size.y : 1;
  obj.scale.multiplyScalar(scale);
  wrapper.updateMatrixWorld(true);
  const scaled = new THREE.Box3().setFromObject(obj);
  const center = scaled.getCenter(new THREE.Vector3());
  obj.position.x -= center.x;
  obj.position.z -= center.z;
  obj.position.y -= scaled.min.y;
  obj.traverse((o) => {
    if (o instanceof THREE.Mesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  return wrapper;
}

/** Wie `normalizeModel`, aber die größte waagrechte Seite wird 1 (Aufrufer skaliert auf die Grundfläche). */
export function normalizeFootprint(obj: THREE.Object3D): THREE.Group {
  const wrapper = normalizeModel(obj, 1);
  const box = new THREE.Box3().setFromObject(wrapper);
  const size = box.getSize(new THREE.Vector3());
  // normalizeModel hat auf Höhe 1 skaliert; jetzt auf Breite 1 umrechnen
  wrapper.scale.multiplyScalar(1 / Math.max(size.x, size.z));
  return wrapper;
}

export class ModelLibrary {
  private readonly templates = new Map<ModelKey, THREE.Group[]>();

  get size(): number {
    return this.templates.size;
  }

  add(key: ModelKey, template: THREE.Group): void {
    const list = this.templates.get(key) ?? [];
    list.push(template);
    this.templates.set(key, list);
  }

  has(key: ModelKey): boolean {
    return (this.templates.get(key)?.length ?? 0) > 0;
  }

  /** Neue Instanz (Geometrie und Material geteilt) oder `null`, wenn kein Modell vorhanden ist. */
  instance(key: ModelKey, variant: number): THREE.Group | null {
    const list = this.templates.get(key);
    if (!list || list.length === 0) return null;
    const template = list[Math.abs(Math.floor(variant)) % list.length]!;
    return template.clone(true);
  }
}

let active: ModelLibrary | null = null;

/** Die gerade geladene Bibliothek (oder `null`): von den Fabrikfunktionen abgefragt. */
export function modelLibrary(): ModelLibrary | null {
  return active;
}

export function setModelLibrary(library: ModelLibrary | null): void {
  active = library;
}

/** Lädt Manifest und Modelle. Fehlt das Manifest, kommt eine leere Bibliothek zurück. */
export async function loadModelLibrary(baseUrl = 'models/'): Promise<ModelLibrary> {
  const library = new ModelLibrary();
  let manifest: Manifest;
  try {
    const response = await fetch(`${baseUrl}manifest.json`);
    if (!response.ok) return library;
    manifest = (await response.json()) as Manifest;
  } catch {
    return library;
  }
  const loader = new GLTFLoader();
  const jobs: Promise<void>[] = [];
  for (const [key, entry] of Object.entries(manifest.models ?? {}) as [ModelKey, ManifestEntry][]) {
    for (const file of entry.files) {
      jobs.push(
        loader
          .loadAsync(`${baseUrl}${file}`)
          .then((gltf) =>
            library.add(
              key,
              isFootprintKey(key)
                ? normalizeFootprint(gltf.scene)
                : normalizeModel(gltf.scene, entry.height ?? DEFAULT_HEIGHTS[key]),
            ),
          )
          .catch((error: unknown) => console.warn(`Modell ${file} konnte nicht geladen werden`, error)),
      );
    }
  }
  await Promise.all(jobs);
  return library;
}
