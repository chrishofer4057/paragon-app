import * as THREE from 'three';
import { CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import type { GameBridge } from '../../bridge/bridge';
import { citySignature, CityView } from './cityView';
import { loadModelLibrary, setModelLibrary } from './modelLibrary';
import { Overlay } from './overlay';
import type { PointerInfo, WorldView } from './view';
import { WorldMapView } from './worldMapView';

export interface WorldHandle {
  destroy(): void;
  /** Kennzahlen fürs Profiling (Konsole: `fieraWorld.stats()`). */
  stats(): { fps: number; drawCalls: number; triangles: number };
}

/** Ab so vielen Pixeln Mausweg gilt ein Druck als Ziehen statt als Klick. */
const DRAG_THRESHOLD = 6;
/** Linke Maustaste gedrückt halten: alle … ms neu auf den Zeiger zielen. */
const HOLD_INTERVAL_MS = 220;

/**
 * 3D-Spielwelt mit Three.js (CLAUDE.md §5.1, Spielwelt-Schicht). Kennt nur die GameBridge,
 * nicht Angular. Wählt je nach Aufenthaltsort Stadt oder Weltkarte und baut die Stadt neu auf,
 * wenn sich Besitz ändert, der den Grundriss beeinflusst.
 */
export function createWorld3D(parent: HTMLElement, bridge: GameBridge): WorldHandle {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.95;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const canvas = renderer.domElement;
  canvas.classList.add('world-canvas');
  parent.append(canvas);

  const labels = new CSS2DRenderer();
  labels.domElement.classList.add('world-labels');
  parent.append(labels.domElement);
  const overlay = new Overlay(parent);

  let width = parent.clientWidth || 1280;
  let height = parent.clientHeight || 720;
  let view: WorldView | null = null;
  let signature = '';

  function makeView(): void {
    view?.dispose();
    signature = citySignature(bridge);
    const aspect = width / Math.max(1, height);
    view =
      bridge.getState().player.location.kind === 'city'
        ? new CityView(bridge, overlay, aspect)
        : new WorldMapView(bridge, overlay, aspect);
    view.resize(width, height);
    overlay.flash();
  }

  function resize(): void {
    width = parent.clientWidth || 1;
    height = parent.clientHeight || 1;
    renderer.setSize(width, height);
    labels.setSize(width, height);
    view?.resize(width, height);
  }

  // --- Eingabe ---------------------------------------------------------------
  const ndc = new THREE.Vector2();
  function pointer(e: PointerEvent | MouseEvent): PointerInfo {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    ndc.set((x / rect.width) * 2 - 1, -(y / rect.height) * 2 + 1);
    return { ndc: ndc.clone(), clientX: x, clientY: y };
  }

  let down: {
    button: number;
    x: number;
    y: number;
    lastX: number;
    lastY: number;
    dragging: boolean;
    time: number;
  } | null = null;
  let lastHold = 0;

  const onPointerDown = (e: PointerEvent) => {
    canvas.setPointerCapture(e.pointerId);
    down = {
      button: e.button,
      x: e.clientX,
      y: e.clientY,
      lastX: e.clientX,
      lastY: e.clientY,
      dragging: false,
      time: performance.now(),
    };
  };
  const onPointerMove = (e: PointerEvent) => {
    const p = pointer(e);
    if (down) {
      if (Math.hypot(e.clientX - down.x, e.clientY - down.y) > DRAG_THRESHOLD) down.dragging = true;
      if (down.button !== 0) {
        view?.rotate(e.clientX - down.lastX, e.clientY - down.lastY);
        down.lastX = e.clientX;
        down.lastY = e.clientY;
        return;
      }
    }
    view?.pointerMove(p);
  };
  const onPointerUp = (e: PointerEvent) => {
    if (down && down.button === 0 && !down.dragging) view?.click(pointer(e));
    down = null;
    if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
  };
  const onWheel = (e: WheelEvent) => {
    e.preventDefault();
    view?.zoom(e.deltaY);
  };
  const onContext = (e: Event) => e.preventDefault();
  const onLeave = () => view?.pointerLeave();
  const onKey = (e: KeyboardEvent) => {
    const target = e.target as HTMLElement | null;
    if (target && ['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName)) return;
    if (view?.key(e)) e.preventDefault();
  };
  let lastMove: PointerEvent | null = null;
  const trackMove = (e: PointerEvent) => (lastMove = e);
  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointermove', trackMove);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointerleave', onLeave);
  canvas.addEventListener('wheel', onWheel, { passive: false });
  canvas.addEventListener('contextmenu', onContext);
  window.addEventListener('keydown', onKey);

  const observer = new ResizeObserver(resize);
  observer.observe(parent);
  resize();
  makeView();
  // Echte Modelle nachladen; sobald welche da sind, die Ansicht damit neu aufbauen.
  let destroyed = false;
  void loadModelLibrary().then((library) => {
    if (destroyed || library.size === 0) return;
    setModelLibrary(library);
    makeView();
  });

  // --- Schleife --------------------------------------------------------------
  let raf = 0;
  let last = performance.now();
  let fps = 0;
  const frame = (now: number) => {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.1, (now - last) / 1000);
    fps = fps * 0.95 + (1000 / Math.max(1, now - last)) * 0.05;
    last = now;
    if (citySignature(bridge) !== signature) makeView();
    if (!view) return;
    // Gedrückt halten und ziehen: Figur folgt dem Mauszeiger
    if (down && down.button === 0 && down.dragging && lastMove && now - lastHold > HOLD_INTERVAL_MS) {
      lastHold = now;
      view.hold(pointer(lastMove));
    } else if (
      down &&
      down.button === 0 &&
      !down.dragging &&
      now - down.time > 450 &&
      lastMove &&
      now - lastHold > HOLD_INTERVAL_MS
    ) {
      lastHold = now;
      view.hold(pointer(lastMove));
    }
    view.update(dt);
    renderer.render(view.scene, view.camera);
    labels.render(view.scene, view.camera);
  };
  raf = requestAnimationFrame(frame);

  return {
    stats() {
      return {
        fps: Math.round(fps),
        drawCalls: renderer.info.render.calls,
        triangles: renderer.info.render.triangles,
      };
    },
    destroy(): void {
      destroyed = true;
      cancelAnimationFrame(raf);
      observer.disconnect();
      window.removeEventListener('keydown', onKey);
      view?.dispose();
      view = null;
      overlay.dispose();
      renderer.dispose();
      canvas.remove();
      labels.domElement.remove();
    },
  };
}
