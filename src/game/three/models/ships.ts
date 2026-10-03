import * as THREE from 'three';
import { WOOD, WOOD_DARK } from '../materials';
import { box, cylinder, mesh } from './shapes';

/** Kogge als Platzhalter: Rumpf aus extrudiertem Umriss, ein Mast, Rahsegel. Bug zeigt nach +x. */
export function ship(sailColor = 0xf4ecd8, stripe = 0xa2432f, scale = 1): THREE.Group {
  const g = new THREE.Group();
  const shape = new THREE.Shape();
  shape.moveTo(-1.6, -0.55);
  shape.lineTo(1.0, -0.55);
  shape.quadraticCurveTo(1.9, -0.3, 2.0, 0);
  shape.quadraticCurveTo(1.9, 0.3, 1.0, 0.55);
  shape.lineTo(-1.6, 0.55);
  shape.quadraticCurveTo(-1.9, 0, -1.6, -0.55);
  const hullGeo = new THREE.ExtrudeGeometry(shape, { depth: 0.7, bevelEnabled: false });
  hullGeo.rotateX(-Math.PI / 2);
  hullGeo.translate(0, -0.35, 0);
  const hull = mesh(hullGeo, WOOD);
  g.add(hull);
  const deck = box(3.0, 0.04, 0.95, 0xc49a62);
  deck.position.set(0, 0.35, 0);
  g.add(deck);
  const rail = box(3.4, 0.1, 1.15, WOOD_DARK);
  rail.position.set(0.1, 0.3, 0);
  g.add(rail);
  // Achterkastell
  const castle = box(0.8, 0.45, 1.05, WOOD);
  castle.position.set(-1.2, 0.35, 0);
  g.add(castle);
  const mast = cylinder(0.06, 0.08, 3.0, WOOD_DARK, 6);
  mast.position.set(0.2, 0.35, 0);
  g.add(mast);
  const yard = cylinder(0.035, 0.035, 1.9, WOOD_DARK, 5);
  yard.rotation.x = Math.PI / 2;
  yard.position.set(0.25, 2.9, 0);
  g.add(yard);
  const sailGeo = new THREE.PlaneGeometry(1.8, 1.7, 4, 4);
  const pos = sailGeo.attributes['position'] as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    pos.setZ(i, 0.25 * (1 - (x / 0.9) ** 2) * (1 - ((y + 0.2) / 1.1) ** 2));
  }
  sailGeo.computeVertexNormals();
  sailGeo.rotateY(Math.PI / 2);
  const sail = new THREE.Mesh(
    sailGeo,
    new THREE.MeshStandardMaterial({
      color: sailColor,
      side: THREE.DoubleSide,
      flatShading: true,
      roughness: 0.9,
    }),
  );
  sail.castShadow = true;
  sail.position.set(0.32, 2.0, 0);
  g.add(sail);
  const pennant = box(0.4, 0.15, 0.02, stripe);
  pennant.position.set(0.0, 3.35, 0);
  g.add(pennant);
  g.scale.setScalar(scale);
  g.traverse((o) => {
    if (o instanceof THREE.Mesh) o.castShadow = true;
  });
  return g;
}
