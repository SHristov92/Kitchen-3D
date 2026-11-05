import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { catalogEntry } from './catalog.js';
import {
  bounds, centroid, inwardNormal, offsetPolygon, pointInItem, pointInPolygon, projectOnSegment,
} from './geometry.js';

const M = 0.01; // plan centimetres -> scene metres
const EYE_HEIGHT = 1.6;
const WALKER_RADIUS = 20; // cm

/**
 * 3D view of the project. Plan (x, y) in cm maps to scene (x, z) in metres, y is up.
 * Two modes: "orbit" (dollhouse view, walls facing the camera fade out) and
 * "walk" (first person at the walker position shown on the plan).
 */
export class View3D {
  constructor(container, store) {
    this.container = container;
    this.store = store;
    this.mode = 'orbit';
    this.keys = new Set();
    this.pitch = -0.08;
    this.materials = new Map();

    this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    container.appendChild(this.renderer.domElement);
    this.canvas = this.renderer.domElement;
    this.canvas.tabIndex = 0;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#dfe6ec');
    this.camera = new THREE.PerspectiveCamera(60, 1, 0.05, 200);
    this.camera.rotation.order = 'YXZ';

    this.scene.add(new THREE.HemisphereLight('#ffffff', '#8d7f6e', 1.3));
    this.sun = new THREE.DirectionalLight('#fff6e8', 1.6);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.bias = -0.0005;
    this.scene.add(this.sun, this.sun.target);

    this.roomGroup = new THREE.Group();
    this.scene.add(this.roomGroup);

    this.orbit = new OrbitControls(this.camera, this.canvas);
    this.orbit.enableDamping = true;
    this.orbit.maxPolarAngle = Math.PI * 0.49;

    this.floorTexture = makeTileTexture();
    this.timer = new THREE.Timer();

    this.bindWalkInput();
    new ResizeObserver(() => this.resize()).observe(container);
    store.subscribe((reason) => {
      if (reason === 'change' || reason === 'load') this.rebuild(reason === 'load');
      if (reason === 'select') this.updateSelection();
    });
    this.rebuild(true);
    this.resize();
    this.renderer.setAnimationLoop(() => this.tick());
  }

  get project() { return this.store.project; }

  setMode(mode) {
    this.mode = mode;
    this.orbit.enabled = mode === 'orbit';
    this.ceiling && (this.ceiling.visible = mode === 'walk');
    if (mode === 'orbit') {
      this.frameOrbit();
    } else {
      this.pitch = -0.08;
      this.canvas.focus();
    }
    for (const w of this.walls) setWallFade(w, false);
  }

  resize() {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  frameOrbit() {
    const pts = this.project.room.points;
    const b = bounds(pts);
    const c = centroid(pts);
    const size = Math.max(b.width, b.height) * M;
    this.orbit.target.set(c.x * M, 0.9, c.y * M);
    this.camera.position.set(c.x * M + size * 0.55, size * 1.1 + 1.5, c.y * M + size * 1.05);
    this.orbit.update();
  }

  // ---------- scene building ----------

  material(color, opts = {}) {
    const key = `${color}|${JSON.stringify(opts)}`;
    if (!this.materials.has(key)) {
      this.materials.set(key, new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0, ...opts }));
    }
    return this.materials.get(key);
  }

  rebuild(reframe = false) {
    disposeGroup(this.roomGroup);
    const { room, items } = this.project;
    const pts = room.points;
    const H = room.wallHeight * M;

    // Floor
    const floorShape = new THREE.Shape(pts.map((p) => new THREE.Vector2(p.x * M, -p.y * M)));
    const floorGeo = new THREE.ShapeGeometry(floorShape);
    floorGeo.rotateX(-Math.PI / 2);
    const floorMat = new THREE.MeshStandardMaterial({ color: room.floorColor, map: this.floorTexture, roughness: 0.8 });
    this.trackDisposable(floorMat);
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.receiveShadow = true;
    this.roomGroup.add(floor);

    // Ceiling, only shown when walking.
    const ceilGeo = new THREE.ShapeGeometry(new THREE.Shape(pts.map((p) => new THREE.Vector2(p.x * M, p.y * M))));
    ceilGeo.rotateX(Math.PI / 2);
    ceilGeo.translate(0, H, 0);
    this.ceiling = new THREE.Mesh(ceilGeo, this.material('#fbfaf7', { roughness: 0.95 }));
    this.ceiling.visible = this.mode === 'walk';
    this.roomGroup.add(this.ceiling);

    // Walls: one mitred prism per wall so single walls can fade in the orbit view.
    const outer = offsetPolygon(pts, room.wallThickness);
    this.walls = [];
    const wallMat = new THREE.MeshStandardMaterial({ color: room.wallColor, roughness: 0.9 });
    this.trackDisposable(wallMat);
    for (let i = 0; i < pts.length; i++) {
      const j = (i + 1) % pts.length;
      const quad = [pts[i], pts[j], outer[j], outer[i]];
      const shape = new THREE.Shape(quad.map((p) => new THREE.Vector2(p.x * M, -p.y * M)));
      const geo = new THREE.ExtrudeGeometry(shape, { depth: H, bevelEnabled: false });
      geo.rotateX(-Math.PI / 2);
      const mesh = new THREE.Mesh(geo, wallMat.clone());
      this.trackDisposable(mesh.material);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      const n = inwardNormal(pts, i);
      mesh.userData = {
        mid: new THREE.Vector3(((pts[i].x + pts[j].x) / 2) * M, H / 2, ((pts[i].y + pts[j].y) / 2) * M),
        outward: new THREE.Vector3(-n.x, 0, -n.y),
      };
      this.walls.push(mesh);
      this.roomGroup.add(mesh);
    }

    // Skirting board along the inner walls.
    const skirtMat = this.material('#e9e4da');
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % pts.length];
      const len = Math.hypot(b.x - a.x, b.y - a.y) * M;
      const n = inwardNormal(pts, i);
      const sk = new THREE.Mesh(new THREE.BoxGeometry(len, 0.08, 0.012), skirtMat);
      sk.position.set(((a.x + b.x) / 2 + n.x * 0.6) * M, 0.04, ((a.y + b.y) / 2 + n.y * 0.6) * M);
      sk.rotation.y = -Math.atan2(b.y - a.y, b.x - a.x);
      this.roomGroup.add(sk);
    }

    // Objects
    this.itemMeshes = new Map();
    for (const it of items) {
      const g = buildItem(it, this);
      g.position.set(it.x * M, it.elevation * M, it.y * M);
      g.rotation.y = (-it.rotation * Math.PI) / 180;
      g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
      this.itemMeshes.set(it.id, g);
      this.roomGroup.add(g);
    }

    // Light from above the room centre.
    const c = centroid(pts);
    const b = bounds(pts);
    const size = Math.max(b.width, b.height) * M;
    this.sun.position.set(c.x * M + size * 0.3, H + size, c.y * M + size * 0.5);
    this.sun.target.position.set(c.x * M, 0, c.y * M);
    const cam = this.sun.shadow.camera;
    cam.left = cam.bottom = -size;
    cam.right = cam.top = size;
    cam.far = H + size * 3;
    cam.updateProjectionMatrix();
    const lamp = new THREE.PointLight('#fff1dc', 6, size * 2.5, 1.6);
    lamp.position.set(c.x * M, H - 0.2, c.y * M);
    this.roomGroup.add(lamp);

    this.updateSelection();
    if (reframe) this.frameOrbit();
  }

  trackDisposable(mat) {
    (this.roomGroup.userData.disposables ??= []).push(mat);
  }

  updateSelection() {
    if (this.selectionBox) {
      this.scene.remove(this.selectionBox);
      this.selectionBox.geometry.dispose();
      this.selectionBox = null;
    }
    const it = this.store.selectedItem();
    const g = it && this.itemMeshes?.get(it.id);
    if (g) {
      this.selectionBox = new THREE.BoxHelper(g, '#2f7cf6');
      this.scene.add(this.selectionBox);
    }
  }

  // ---------- walking ----------

  bindWalkInput() {
    const isTyping = () => ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName);
    window.addEventListener('keydown', (e) => {
      if (this.mode !== 'walk' || isTyping()) return;
      const k = e.key.toLowerCase();
      if (['w', 'a', 's', 'd', 'q', 'e', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'shift'].includes(k)) {
        this.keys.add(k);
        if (k.startsWith('arrow')) e.preventDefault();
      }
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.key.toLowerCase()));
    window.addEventListener('blur', () => this.keys.clear());

    // Drag to look around (works without pointer lock, also on touch).
    let last = null;
    this.canvas.addEventListener('pointerdown', (e) => {
      if (this.mode !== 'walk') return;
      this.canvas.focus();
      last = { x: e.clientX, y: e.clientY };
      this.canvas.setPointerCapture(e.pointerId);
    });
    this.canvas.addEventListener('pointermove', (e) => {
      if (this.mode !== 'walk' || !last) return;
      const dx = e.clientX - last.x;
      const dy = e.clientY - last.y;
      last = { x: e.clientX, y: e.clientY };
      this.store.setViewer({ heading: this.project.viewer.heading + dx * 0.25 });
      this.pitch = THREE.MathUtils.clamp(this.pitch - dy * 0.004, -1.3, 1.3);
    });
    const end = () => { last = null; };
    this.canvas.addEventListener('pointerup', end);
    this.canvas.addEventListener('pointercancel', end);
  }

  canStand(p) {
    const { room, items } = this.project;
    const pts = room.points;
    if (!pointInPolygon(p, pts)) return false;
    for (let i = 0; i < pts.length; i++) {
      if (projectOnSegment(p, pts[i], pts[(i + 1) % pts.length]).distance < WALKER_RADIUS) return false;
    }
    for (const it of items) {
      if (it.elevation < 100 && it.h > 30 && pointInItem(it, p, WALKER_RADIUS * 0.75)) return false;
    }
    return true;
  }

  walk(dt) {
    const k = this.keys;
    const v = this.project.viewer;
    let heading = v.heading;
    const turn = (k.has('arrowleft') || k.has('q') ? -1 : 0) + (k.has('arrowright') || k.has('e') ? 1 : 0);
    heading += turn * 90 * dt;
    const fwd = (k.has('w') || k.has('arrowup') ? 1 : 0) - (k.has('s') || k.has('arrowdown') ? 1 : 0);
    const side = (k.has('d') ? 1 : 0) - (k.has('a') ? 1 : 0);
    let { x, y } = v;
    if (fwd || side) {
      const speed = (k.has('shift') ? 280 : 140) * dt; // cm per second
      const h = (heading * Math.PI) / 180;
      const f = { x: Math.sin(h), y: -Math.cos(h) };
      const r = { x: Math.cos(h), y: Math.sin(h) };
      const len = Math.hypot(fwd, side);
      const dx = ((f.x * fwd + r.x * side) / len) * speed;
      const dy = ((f.y * fwd + r.y * side) / len) * speed;
      const free = !this.canStand({ x, y }); // let the walker leave a spot that is already blocked
      if (free || this.canStand({ x: x + dx, y: y + dy })) { x += dx; y += dy; }
      else if (this.canStand({ x: x + dx, y })) x += dx;
      else if (this.canStand({ x, y: y + dy })) y += dy;
    }
    if (heading !== v.heading || x !== v.x || y !== v.y) {
      this.store.setViewer({ x, y, heading: ((heading % 360) + 360) % 360 });
    }
    this.camera.position.set(v.x * M, EYE_HEIGHT, v.y * M);
    this.camera.rotation.set(this.pitch, (-v.heading * Math.PI) / 180, 0);
  }

  fadeWalls() {
    const cam = this.camera.position;
    const tmp = new THREE.Vector3();
    for (const w of this.walls) {
      tmp.copy(cam).sub(w.userData.mid);
      tmp.y = 0;
      setWallFade(w, tmp.dot(w.userData.outward) > 0.3);
    }
  }

  tick() {
    this.timer.update();
    const dt = Math.min(this.timer.getDelta(), 0.1);
    if (this.mode === 'walk') {
      this.walk(dt);
    } else {
      this.orbit.update();
      this.fadeWalls();
    }
    this.selectionBox?.update();
    this.renderer.render(this.scene, this.camera);
  }
}

function setWallFade(mesh, faded) {
  const m = mesh.material;
  if (m.transparent === faded) return;
  m.transparent = faded;
  m.opacity = faded ? 0.12 : 1;
  m.depthWrite = !faded;
  mesh.castShadow = !faded;
  m.needsUpdate = true;
}

function disposeGroup(group) {
  group.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
  for (const m of group.userData.disposables ?? []) m.dispose();
  group.userData.disposables = [];
  group.clear();
}

function makeTileTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 2; i++) {
    for (let j = 0; j < 2; j++) {
      const shade = 236 + ((i + j) % 2) * 10;
      g.fillStyle = `rgb(${shade},${shade},${shade})`;
      g.fillRect(i * 128 + 2, j * 128 + 2, 124, 124);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t; // one texture repeat per metre = 50 cm tiles
}

// ---------- object models ----------
// Every object is built in its own frame: width along x, depth along z with the front
// at +z, height along y starting at 0. Units are metres.

const COUNTER = '#d9d5cc';
const DARK = '#2a2c30';
const STEEL = '#b9bdc2';

function box(view, w, h, d, color, x, y, z, opts) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), view.material(color, opts));
  m.position.set(x, y + h / 2, z);
  return m;
}

function cyl(view, r, h, color, x, y, z, opts) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 24), view.material(color, opts));
  m.position.set(x, y + h / 2, z);
  return m;
}

/** Doors or drawer fronts on the +z face, split into a grid with small gaps. */
function fronts(view, g, { w, d, y0, y1, cols = 1, rows = 1, color, handle = 'bar', handleLow = false }) {
  const gap = 0.004;
  const fw = w / cols;
  const fh = (y1 - y0) / rows;
  for (let c = 0; c < cols; c++) {
    for (let r = 0; r < rows; r++) {
      const x = -w / 2 + fw * (c + 0.5);
      const y = y0 + fh * r;
      g.add(box(view, fw - gap * 2, fh - gap * 2, 0.018, color, x, y + gap, d / 2 + 0.009));
      if (handle === 'bar') {
        const hx = rows > 1 ? x : x + (c % 2 === 0 ? 1 : -1) * (fw / 2 - 0.04);
        const hy = rows > 1 ? y + fh - 0.05 : handleLow ? y + 0.17 : y + fh - 0.06;
        const hw = rows > 1 ? Math.min(0.2, fw * 0.5) : 0.012;
        const hh = rows > 1 ? 0.012 : 0.12;
        g.add(box(view, hw, hh, 0.02, STEEL, hx, hy - hh, d / 2 + 0.028, { metalness: 0.8, roughness: 0.3 }));
      }
    }
  }
}

function baseUnit(view, g, it, { rows = 1, cols, countertop = true, front = true } = {}) {
  const w = it.w * M; const d = it.d * M; const h = it.h * M;
  const plinth = 0.1;
  const top = countertop ? 0.04 : 0;
  g.add(box(view, w, plinth, d - 0.06, DARK, 0, 0, -0.03));
  g.add(box(view, w - 0.004, h - plinth - top, d - 0.02, '#e7e3dc', 0, plinth, -0.01));
  if (front) fronts(view, g, { w, d: d - 0.02, y0: plinth, y1: h - top, rows, cols: cols ?? (w > 0.65 ? 2 : 1), color: it.color });
  if (countertop) g.add(box(view, w, top, d + 0.02, COUNTER, 0, h - top, 0.01, { roughness: 0.35 }));
}

function sinkBasin(view, g, x, z, bw, bd, topY) {
  g.add(box(view, bw, 0.012, bd, '#9ea3a8', x, topY - 0.002, z, { metalness: 0.8, roughness: 0.25 }));
  g.add(box(view, bw - 0.04, 0.013, bd - 0.04, '#4a4e53', x, topY - 0.002, z, { metalness: 0.6, roughness: 0.4 }));
}

function faucet(view, g, x, z, topY) {
  g.add(cyl(view, 0.015, 0.3, STEEL, x, topY, z, { metalness: 0.9, roughness: 0.2 }));
  g.add(box(view, 0.025, 0.025, 0.18, STEEL, x, topY + 0.28, z + 0.08, { metalness: 0.9, roughness: 0.2 }));
}

function hobTop(view, g, w, d, topY, frameless) {
  const hw = Math.min(w - 0.06, 0.58);
  const hd = Math.min(d - 0.08, 0.5);
  g.add(box(view, hw, frameless ? 0.006 : 0.012, hd, '#111214', 0, topY, 0.0, { roughness: 0.15 }));
  for (const [x, z, r] of [[-0.14, -0.11, 0.09], [0.14, -0.11, 0.07], [-0.14, 0.12, 0.07], [0.14, 0.12, 0.09]]) {
    const ring = new THREE.Mesh(new THREE.RingGeometry(r * 0.85, r, 32), view.material('#6b6e73'));
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(x * (hw / 0.58), topY + 0.013, z * (hd / 0.5));
    g.add(ring);
  }
}

const BUILDERS = {
  base: (v, g, it) => baseUnit(v, g, it),
  drawers: (v, g, it) => baseUnit(v, g, it, { rows: 3, cols: 1 }),
  dishwasher: (v, g, it) => baseUnit(v, g, it, { rows: 1, cols: 1 }),
  island(v, g, it) {
    const w = it.w * M; const d = it.d * M; const h = it.h * M;
    g.add(box(v, w - 0.1, 0.1, d - 0.4, DARK, 0, 0, 0));
    g.add(box(v, w - 0.02, h - 0.14, d - 0.3, it.color, 0, 0.1, -0.05));
    fronts(v, g, { w: w - 0.02, d: d - 0.4, y0: 0.1, y1: h - 0.04, cols: Math.max(1, Math.round(w / 0.6)), rows: 1, color: it.color });
    g.add(box(v, w + 0.04, 0.04, d, COUNTER, 0, h - 0.04, 0, { roughness: 0.35 }));
  },
  wall(v, g, it) {
    const w = it.w * M; const d = it.d * M; const h = it.h * M;
    g.add(box(v, w - 0.004, h, d - 0.02, '#e7e3dc', 0, 0, -0.01));
    fronts(v, g, { w, d: d - 0.02, y0: 0, y1: h, cols: w > 0.65 ? 2 : 1, rows: 1, color: it.color, handleLow: true });
  },
  shelf(v, g, it) {
    g.add(box(v, it.w * M, it.h * M, it.d * M, it.color, 0, 0, 0));
  },
  tall(v, g, it) {
    const w = it.w * M; const d = it.d * M; const h = it.h * M;
    g.add(box(v, w, 0.1, d - 0.06, DARK, 0, 0, -0.03));
    g.add(box(v, w - 0.004, h - 0.1, d - 0.02, '#e7e3dc', 0, 0.1, -0.01));
    fronts(v, g, { w, d: d - 0.02, y0: 0.1, y1: 0.1 + (h - 0.1) * 0.62, color: it.color });
    fronts(v, g, { w, d: d - 0.02, y0: 0.1 + (h - 0.1) * 0.62, y1: h, color: it.color });
  },
  oventower(v, g, it) {
    const w = it.w * M; const d = it.d * M; const h = it.h * M;
    g.add(box(v, w, 0.1, d - 0.06, DARK, 0, 0, -0.03));
    g.add(box(v, w - 0.004, h - 0.1, d - 0.02, '#e7e3dc', 0, 0.1, -0.01));
    fronts(v, g, { w, d: d - 0.02, y0: 0.1, y1: 0.8, rows: 2, color: it.color });
    g.add(box(v, w - 0.01, 0.6, 0.02, DARK, 0, 0.82, d / 2, { roughness: 0.2 }));
    g.add(box(v, w - 0.12, 0.3, 0.022, '#15171a', 0, 0.94, d / 2, { roughness: 0.05 }));
    fronts(v, g, { w, d: d - 0.02, y0: 1.44, y1: h, color: it.color });
  },
  fridge(v, g, it) {
    const w = it.w * M; const d = it.d * M; const h = it.h * M;
    const opts = { metalness: 0.6, roughness: 0.35 };
    g.add(box(v, w, h, d - 0.03, it.color, 0, 0, -0.015, opts));
    const split = h * 0.62;
    g.add(box(v, w - 0.01, split - 0.02, 0.03, it.color, 0, 0.01, d / 2 - 0.015, opts));
    g.add(box(v, w - 0.01, h - split - 0.02, 0.03, it.color, 0, split + 0.01, d / 2 - 0.015, opts));
    g.add(box(v, 0.02, 0.5, 0.03, '#8e9297', w / 2 - 0.06, split - 0.55, d / 2 + 0.01, opts));
    g.add(box(v, 0.02, 0.4, 0.03, '#8e9297', w / 2 - 0.06, split + 0.1, d / 2 + 0.01, opts));
  },
  stove(v, g, it) {
    const w = it.w * M; const d = it.d * M; const h = it.h * M;
    const opts = { metalness: 0.6, roughness: 0.35 };
    g.add(box(v, w, h - 0.02, d, it.color, 0, 0, 0, opts));
    g.add(box(v, w - 0.06, 0.4, 0.012, '#15171a', 0, 0.2, d / 2, { roughness: 0.05 }));
    g.add(box(v, w - 0.1, 0.02, 0.03, '#8e9297', 0, 0.66, d / 2 + 0.01, opts));
    for (let i = 0; i < 4; i++) g.add(cyl(v, 0.015, 0.02, DARK, -w / 2 + 0.1 + i * ((w - 0.2) / 3), h - 0.12, d / 2, {}));
    hobTop(v, g, w, d, h - 0.02, true);
  },
  hob(v, g, it) {
    baseUnit(v, g, it, { rows: 3, cols: 1 });
    hobTop(v, g, it.w * M, it.d * M, it.h * M, true);
  },
  hood(v, g, it) {
    const w = it.w * M; const d = it.d * M; const h = it.h * M;
    const opts = { metalness: 0.7, roughness: 0.3 };
    g.add(box(v, w, 0.06, d, it.color, 0, 0, 0, opts));
    g.add(box(v, w * 0.45, h - 0.06, d * 0.5, it.color, 0, 0.06, -d * 0.25, opts));
  },
  microwave(v, g, it) {
    const w = it.w * M; const d = it.d * M; const h = it.h * M;
    g.add(box(v, w, h, d, it.color, 0, 0, 0, { roughness: 0.4 }));
    g.add(box(v, w * 0.65, h * 0.7, 0.01, '#0d0e10', -w * 0.12, h * 0.15, d / 2, { roughness: 0.05 }));
  },
  sink(v, g, it) {
    baseUnit(v, g, it);
    const top = it.h * M;
    sinkBasin(v, g, 0, 0.02, Math.min(it.w * M - 0.16, 0.55), 0.42, top);
    faucet(v, g, 0, -it.d * M / 2 + 0.07, top);
  },
  sink2(v, g, it) {
    baseUnit(v, g, it);
    const top = it.h * M;
    const bw = Math.min((it.w * M - 0.2) / 2, 0.45);
    sinkBasin(v, g, -bw / 2 - 0.02, 0.02, bw, 0.42, top);
    sinkBasin(v, g, bw / 2 + 0.02, 0.02, bw, 0.42, top);
    faucet(v, g, 0, -it.d * M / 2 + 0.07, top);
  },
  table(v, g, it) {
    const w = it.w * M; const d = it.d * M; const h = it.h * M;
    g.add(box(v, w, 0.04, d, it.color, 0, h - 0.04, 0, { roughness: 0.5 }));
    const lx = w / 2 - 0.06; const lz = d / 2 - 0.06;
    for (const [x, z] of [[-lx, -lz], [lx, -lz], [-lx, lz], [lx, lz]]) g.add(box(v, 0.05, h - 0.04, 0.05, it.color, x, 0, z));
  },
  chair(v, g, it) {
    const w = it.w * M; const d = it.d * M; const h = it.h * M;
    const seat = 0.46;
    g.add(box(v, w, 0.04, d, it.color, 0, seat - 0.04, 0));
    const lx = w / 2 - 0.03; const lz = d / 2 - 0.03;
    for (const [x, z] of [[-lx, -lz], [lx, -lz], [-lx, lz], [lx, lz]]) g.add(box(v, 0.03, seat - 0.04, 0.03, it.color, x, 0, z));
    g.add(box(v, w, h - seat, 0.03, it.color, 0, seat, -d / 2 + 0.015));
  },
  stool(v, g, it) {
    const h = it.h * M;
    const r = Math.min(it.w, it.d) * M * 0.45;
    g.add(cyl(v, r, 0.05, it.color, 0, h - 0.05, 0));
    g.add(cyl(v, 0.025, h - 0.05, STEEL, 0, 0, 0, { metalness: 0.8, roughness: 0.3 }));
    g.add(cyl(v, r * 0.9, 0.02, STEEL, 0, 0, 0, { metalness: 0.8, roughness: 0.3 }));
  },
};

function buildItem(it, view) {
  const g = new THREE.Group();
  const style = catalogEntry(it.type)?.style ?? 'base';
  (BUILDERS[style] ?? BUILDERS.base)(view, g, it);
  g.userData.itemId = it.id;
  return g;
}
