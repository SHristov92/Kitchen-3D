import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { catalogEntry } from './catalog.js';
import {
  bounds, centroid, inwardNormal, offsetPolygon, pointInItem, pointInPolygon, projectOnSegment, wallOpenings,
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
    this.joy = { x: 0, y: 0 }; // on-screen stick, -1..1 on each axis
    this.touchSeen = window.matchMedia?.('(pointer: coarse)').matches ?? false;
    this.pitch = -0.08;
    this.materials = new Map();
    this.itemCache = new Map(); // item id -> { key, group }, reused while the item is unchanged
    this.needsRender = true;

    // Without a usable graphics card the browser draws WebGL on the CPU, which is very
    // slow; use a cheaper look there (no antialiasing or shadows, fewer pixels).
    this.softwareGL = isSoftwareGL();
    this.renderer = new THREE.WebGLRenderer({ antialias: !this.softwareGL, powerPreference: 'high-performance' });
    // Reading shader logs forces the browser to wait for every compile; skip it.
    this.renderer.debug.checkShaderErrors = false;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = !this.softwareGL;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    // The lights never move, so the shadow map is only redrawn when the scene changes.
    this.renderer.shadowMap.autoUpdate = false;
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
    this.itemsGroup = new THREE.Group();
    this.scene.add(this.roomGroup, this.itemsGroup);

    this.orbit = new OrbitControls(this.camera, this.canvas);
    this.orbit.enableDamping = true;
    this.orbit.maxPolarAngle = Math.PI * 0.49;
    // Damping keeps reporting sub-pixel changes for a long time; ignore those.
    this.lastCam = { p: new THREE.Vector3(Infinity, 0, 0), q: new THREE.Quaternion() };
    this.orbit.addEventListener('change', () => {
      const { p, q } = this.lastCam;
      if (p.distanceToSquared(this.camera.position) < 1e-10 && Math.abs(q.dot(this.camera.quaternion)) > 1 - 1e-10) return;
      p.copy(this.camera.position);
      q.copy(this.camera.quaternion);
      this.invalidate();
    });

    this.floorTexture = makeTileTexture();
    // Room materials live as long as the view. Disposing and recreating them on every
    // edit made the GPU recompile their shaders each time (the main cost of a drag).
    this.floorMat = new THREE.MeshStandardMaterial({ map: this.floorTexture, roughness: 0.8 });
    this.wallMats = [];
    this.timer = new THREE.Timer();

    this.bindWalkInput();
    new ResizeObserver(() => this.resize()).observe(container);
    store.subscribe((reason) => {
      if (reason === 'change' || reason === 'load') this.rebuild(reason === 'load');
      if (reason === 'select') this.updateSelection();
      this.invalidate();
    });
    this.rebuild(true);
    this.resize();
    this.renderer.setAnimationLoop(() => this.tick());
  }

  get project() { return this.store.project; }

  /** Ask for a new frame; nothing is drawn while the view is still. */
  invalidate(shadows = false) {
    this.needsRender = true;
    if (shadows) this.renderer.shadowMap.needsUpdate = true;
  }

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
    this.updateJoystick();
    this.invalidate(true);
  }

  updateJoystick() {
    const el = this.container.querySelector('#joystick');
    if (!el) return;
    const on = this.mode === 'walk' && this.touchSeen;
    el.hidden = !on;
    el.classList.toggle('on', on);
  }

  resize() {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    if (!w || !h) return;
    // Big desktop screens at 2x would mean 8+ million pixels per frame; cap the
    // drawing size so a large window costs about as much as a laptop screen.
    const MAX_PIXELS = this.softwareGL ? 0.35e6 : 2.4e6;
    const dpr = Math.min(window.devicePixelRatio || 1, 2, Math.sqrt(MAX_PIXELS / (w * h)));
    this.renderer.setPixelRatio(Math.max(dpr, this.softwareGL ? 0.4 : 0.75));
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.invalidate();
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
    this.floorMat.color.set(room.floorColor);
    const floor = new THREE.Mesh(floorGeo, this.floorMat);
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
    const openings = wallOpenings(pts, items, (it) => catalogEntry(it.type)?.opening);
    for (let i = 0; i < pts.length; i++) {
      const j = (i + 1) % pts.length;
      const geo = wallGeometry(pts[i], pts[j], outer[i], outer[j], H, openings[i]);
      // One material per wall so each can fade on its own; reused between rebuilds.
      const mat = (this.wallMats[i] ??= new THREE.MeshStandardMaterial({ roughness: 0.9 }));
      mat.color.set(room.wallColor);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.castShadow = !mat.transparent;
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
      const dir = { x: (b.x - a.x) / (len / M), y: (b.y - a.y) / (len / M) };
      // Skip the parts of the wall where a door reaches the floor.
      let start = 0;
      const pieces = [];
      for (const o of openings[i].filter((op) => op.bottom < 8)) {
        if (o.from > start) pieces.push([start, o.from]);
        start = Math.max(start, o.to);
      }
      if (start < len / M) pieces.push([start, len / M]);
      for (const [s0, s1] of pieces) {
        const mid = (s0 + s1) / 2;
        const sk = new THREE.Mesh(new THREE.BoxGeometry((s1 - s0) * M, 0.08, 0.012), skirtMat);
        sk.position.set((a.x + dir.x * mid + n.x * 0.6) * M, 0.04, (a.y + dir.y * mid + n.y * 0.6) * M);
        sk.rotation.y = -Math.atan2(b.y - a.y, b.x - a.x);
        this.roomGroup.add(sk);
      }
    }

    // Objects: only rebuild the ones whose shape changed (moving one keeps its model).
    this.itemMeshes = new Map();
    this.itemsGroup.clear();
    const seen = new Set();
    for (const it of items) {
      const key = itemModelKey(it, room);
      let cached = this.itemCache.get(it.id);
      if (!cached || cached.key !== key) {
        if (cached) disposeItem(cached.group);
        const g = buildItem(it, this);
        g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
        cached = { key, group: g };
        this.itemCache.set(it.id, cached);
      }
      const g = cached.group;
      g.position.set(it.x * M, it.elevation * M, it.y * M);
      g.rotation.y = (-it.rotation * Math.PI) / 180;
      seen.add(it.id);
      this.itemMeshes.set(it.id, g);
      this.itemsGroup.add(g);
    }
    for (const [id, cached] of this.itemCache) {
      if (!seen.has(id)) { disposeItem(cached.group); this.itemCache.delete(id); }
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
    this.invalidate(true);
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

    // On-screen stick for touch screens: push it to walk, like W A S D.
    const stick = this.container.querySelector('#joystick');
    if (stick) {
      const knob = stick.firstElementChild;
      let id = null;
      const move = (e) => {
        const r = stick.getBoundingClientRect();
        const R = r.width / 2;
        let x = (e.clientX - r.left - R) / R;
        let y = (e.clientY - r.top - R) / R;
        const len = Math.hypot(x, y);
        if (len > 1) { x /= len; y /= len; }
        // Small dead zone so resting a thumb on it doesn't creep.
        this.joy = len < 0.15 ? { x: 0, y: 0 } : { x, y };
        knob.style.transform = `translate(${x * R * 0.6}px, ${y * R * 0.6}px)`;
      };
      const release = (e) => {
        if (e.pointerId !== id) return;
        id = null;
        this.joy = { x: 0, y: 0 };
        knob.style.transform = '';
      };
      stick.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        id = e.pointerId;
        stick.setPointerCapture(id);
        move(e);
      });
      stick.addEventListener('pointermove', (e) => { if (e.pointerId === id) move(e); });
      stick.addEventListener('pointerup', release);
      stick.addEventListener('pointercancel', release);
    }

    // Drag to look around (works without pointer lock, also on touch).
    let last = null;
    this.canvas.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'touch' && !this.touchSeen) { this.touchSeen = true; this.updateJoystick(); }
      if (this.mode !== 'walk' || last) return;
      this.canvas.focus();
      last = { x: e.clientX, y: e.clientY, id: e.pointerId };
      this.canvas.setPointerCapture(e.pointerId);
    });
    this.canvas.addEventListener('pointermove', (e) => {
      if (this.mode !== 'walk' || !last || e.pointerId !== last.id) return;
      const dx = e.clientX - last.x;
      const dy = e.clientY - last.y;
      last = { x: e.clientX, y: e.clientY, id: e.pointerId };
      this.store.setViewer({ heading: this.project.viewer.heading + dx * 0.25 });
      this.pitch = THREE.MathUtils.clamp(this.pitch - dy * 0.004, -1.3, 1.3);
      this.invalidate();
    });
    const end = (e) => { if (last && e.pointerId === last.id) last = null; };
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
    const fwd = (k.has('w') || k.has('arrowup') ? 1 : 0) - (k.has('s') || k.has('arrowdown') ? 1 : 0) - this.joy.y;
    const side = (k.has('d') ? 1 : 0) - (k.has('a') ? 1 : 0) + this.joy.x;
    let { x, y } = v;
    if (fwd || side) {
      const speed = (k.has('shift') ? 280 : 140) * dt; // cm per second
      const h = (heading * Math.PI) / 180;
      const f = { x: Math.sin(h), y: -Math.cos(h) };
      const r = { x: Math.cos(h), y: Math.sin(h) };
      const len = Math.hypot(fwd, side);
      const mag = Math.min(1, len); // the stick can walk slowly; keys always go full speed
      const dx = ((f.x * fwd + r.x * side) / len) * speed * mag;
      const dy = ((f.y * fwd + r.y * side) / len) * speed * mag;
      const free = !this.canStand({ x, y }); // let the walker leave a spot that is already blocked
      if (free || this.canStand({ x: x + dx, y: y + dy })) { x += dx; y += dy; }
      else if (this.canStand({ x: x + dx, y })) x += dx;
      else if (this.canStand({ x, y: y + dy })) y += dy;
    }
    if (heading !== v.heading || x !== v.x || y !== v.y) {
      this.store.setViewer({ x, y, heading: ((heading % 360) + 360) % 360 });
    }
    const px = v.x * M; const pz = v.y * M; const yaw = (-v.heading * Math.PI) / 180;
    const c = this.camera;
    if (c.position.x !== px || c.position.z !== pz || c.position.y !== EYE_HEIGHT || c.rotation.x !== this.pitch || c.rotation.y !== yaw) {
      c.position.set(px, EYE_HEIGHT, pz);
      c.rotation.set(this.pitch, yaw, 0);
      this.invalidate();
    }
  }

  fadeWalls() {
    const cam = this.camera.position;
    const tmp = new THREE.Vector3();
    for (const w of this.walls) {
      tmp.copy(cam).sub(w.userData.mid);
      tmp.y = 0;
      if (setWallFade(w, tmp.dot(w.userData.outward) > 0.3)) this.invalidate(true);
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
    if (!this.needsRender) return;
    this.needsRender = false;
    this.selectionBox?.update();
    this.renderer.render(this.scene, this.camera);
  }
}

/**
 * One wall as a prism between the inner edge a-b and the mitred outer edge oa-ob,
 * with rectangular holes for doors and windows. Openings are { from, to, bottom, top }
 * in cm along the inner edge and above the floor.
 */
function wallGeometry(a, b, oa, ob, H, openings = []) {
  const len = Math.hypot(b.x - a.x, b.y - a.y);
  const dir = { x: (b.x - a.x) / len, y: (b.y - a.y) / len };
  // Outer edge points perpendicular to an inner point (valid away from the corners).
  const thick = Math.abs((oa.x - a.x) * -dir.y + (oa.y - a.y) * dir.x) || 0;
  const out = { x: -dir.y, y: dir.x };
  const sign = Math.sign((oa.x - a.x) * out.x + (oa.y - a.y) * out.y) || 1;
  const at = (t) => ({ x: a.x + dir.x * t, y: a.y + dir.y * t });
  const outAt = (t) => ({ x: a.x + dir.x * t + out.x * thick * sign, y: a.y + dir.y * t + out.y * thick * sign });
  const prism = (quad, y0, y1) => {
    const shape = new THREE.Shape(quad.map((p) => new THREE.Vector2(p.x * M, -p.y * M)));
    const geo = new THREE.ExtrudeGeometry(shape, { depth: y1 - y0, bevelEnabled: false });
    geo.rotateX(-Math.PI / 2);
    geo.translate(0, y0, 0);
    return geo.index ? geo.toNonIndexed() : geo;
  };
  if (!openings.length) return prism([a, b, ob, oa], 0, H);

  const parts = [];
  let start = 0;
  let first = true;
  const piece = (t0, t1, y0, y1, isFirst, isLast) => {
    if (t1 - t0 < 0.1 || y1 - y0 < 0.001) return;
    const quad = [isFirst ? a : at(t0), isLast ? b : at(t1), isLast ? ob : outAt(t1), isFirst ? oa : outAt(t0)];
    parts.push(prism(quad, y0, y1));
  };
  for (const o of openings) {
    piece(start, o.from, 0, H, first, false);
    first = false;
    piece(o.from, o.to, 0, Math.min(o.bottom * M, H), false, false);
    piece(o.from, o.to, Math.min(o.top * M, H), H, false, false);
    start = Math.max(start, o.to);
  }
  piece(start, len, 0, H, first, true);
  const geo = mergeGeometries(parts);
  parts.forEach((p) => p.dispose());
  return geo;
}

function setWallFade(mesh, faded) {
  const m = mesh.material;
  if (m.transparent === faded) return false;
  m.transparent = faded;
  m.opacity = faded ? 0.12 : 1;
  m.depthWrite = !faded;
  mesh.castShadow = !faded;
  m.needsUpdate = true;
  return true;
}

function disposeGroup(group) {
  group.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
  group.clear();
}

/** True when WebGL runs on a software renderer (GPU disabled or blocklisted). */
export function isSoftwareGL() {
  try {
    const gl = document.createElement('canvas').getContext('webgl2') || document.createElement('canvas').getContext('webgl');
    if (!gl) return false;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const name = String(gl.getParameter(ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER));
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /swiftshader|llvmpipe|softpipe|software|basic render/i.test(name);
  } catch {
    return false;
  }
}

/** Everything an item's 3D model depends on, apart from where it stands. */
function itemModelKey(it, room) {
  const opening = catalogEntry(it.type)?.opening;
  return [it.type, it.w, it.d, it.h, it.color, opening ? room.wallThickness : ''].join('|');
}

function disposeItem(group) {
  group.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
}

/**
 * Bake an object's many small parts into one mesh per material: a cabinet is ~10
 * boxes but only 2-4 materials, so this cuts draw calls (and shadow draws) several times.
 */
function mergeByMaterial(g) {
  g.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(g.matrixWorld).invert();
  const byMat = new Map();
  g.traverse((o) => {
    if (!o.isMesh) return;
    const geo = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
    geo.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld));
    for (const name of Object.keys(geo.attributes)) if (!['position', 'normal', 'uv'].includes(name)) geo.deleteAttribute(name);
    o.geometry.dispose();
    if (!byMat.has(o.material)) byMat.set(o.material, []);
    byMat.get(o.material).push(geo);
  });
  g.clear();
  for (const [mat, geos] of byMat) {
    const merged = geos.length === 1 ? geos[0] : mergeGeometries(geos);
    if (geos.length > 1) geos.forEach((x) => x.dispose());
    g.add(new THREE.Mesh(merged, mat));
  }
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

const GLASS = { transparent: true, opacity: 0.28, roughness: 0.05, metalness: 0.1 };
const METAL = { metalness: 0.8, roughness: 0.3 };

/** Doors or drawer fronts on the +z face, split into a grid with small gaps. */
function fronts(view, g, { w, d, y0, y1, cols = 1, rows = 1, color, handle = 'bar', handleLow = false, cx = 0, glass = false, lift = false }) {
  const gap = 0.004;
  const fw = w / cols;
  const fh = (y1 - y0) / rows;
  for (let c = 0; c < cols; c++) {
    for (let r = 0; r < rows; r++) {
      const x = cx - w / 2 + fw * (c + 0.5);
      const y = y0 + fh * r;
      if (glass) {
        // Frame with a glass panel.
        const t = 0.05;
        g.add(box(view, fw - gap * 2, t, 0.018, color, x, y + gap, d / 2 + 0.009));
        g.add(box(view, fw - gap * 2, t, 0.018, color, x, y + fh - gap - t, d / 2 + 0.009));
        g.add(box(view, t, fh - gap * 2 - 2 * t, 0.018, color, x - fw / 2 + gap + t / 2, y + gap + t, d / 2 + 0.009));
        g.add(box(view, t, fh - gap * 2 - 2 * t, 0.018, color, x + fw / 2 - gap - t / 2, y + gap + t, d / 2 + 0.009));
        g.add(box(view, fw - 2 * t, fh - 2 * t, 0.006, '#cfe3e8', x, y + t, d / 2 + 0.006, GLASS));
      } else {
        g.add(box(view, fw - gap * 2, fh - gap * 2, 0.018, color, x, y + gap, d / 2 + 0.009));
      }
      if (handle === 'bar') {
        const horizontal = rows > 1 || lift;
        const hx = horizontal ? x : x + (c % 2 === 0 ? 1 : -1) * (fw / 2 - 0.04);
        const hy = horizontal ? (lift ? y + 0.05 + 0.012 : y + fh - 0.05) : handleLow ? y + 0.17 : y + fh - 0.06;
        const hw = horizontal ? Math.min(0.2, fw * 0.5) : 0.012;
        const hh = horizontal ? 0.012 : 0.12;
        g.add(box(view, hw, hh, 0.02, STEEL, hx, hy - hh, d / 2 + 0.028, METAL));
      }
    }
  }
}

function baseUnit(view, g, it, { rows = 1, cols, countertop = true, front = true, drawer = false, top = COUNTER } = {}) {
  const w = it.w * M; const d = it.d * M; const h = it.h * M;
  const plinth = 0.1;
  const tt = countertop ? 0.04 : 0;
  g.add(box(view, w, plinth, d - 0.06, DARK, 0, 0, -0.03));
  g.add(box(view, w - 0.004, h - plinth - tt, d - 0.02, '#e7e3dc', 0, plinth, -0.01));
  const c = cols ?? (w > 0.65 ? 2 : 1);
  if (front && drawer) {
    const split = h - tt - 0.16;
    fronts(view, g, { w, d: d - 0.02, y0: plinth, y1: split, rows: 1, cols: c, color: it.color });
    fronts(view, g, { w, d: d - 0.02, y0: split, y1: h - tt, rows: 2, cols: c, color: it.color });
  } else if (front) {
    fronts(view, g, { w, d: d - 0.02, y0: plinth, y1: h - tt, rows, cols: c, color: it.color });
  }
  if (countertop) g.add(box(view, w, tt, d + 0.02, top, 0, h - tt, 0.01, { roughness: 0.35 }));
}

function wallUnit(view, g, it, look = {}) {
  const w = it.w * M; const d = it.d * M; const h = it.h * M;
  g.add(box(view, w - 0.004, h, d - 0.02, '#e7e3dc', 0, 0, -0.01));
  fronts(view, g, {
    w, d: d - 0.02, y0: 0, y1: h, cols: look.cols ?? (w > 0.65 ? 2 : 1), rows: 1, color: it.color,
    handleLow: true, glass: look.glass, lift: look.lift,
  });
}

/** L-shaped corner unit filling a square footprint: arms along the back (-z) and left (-x). */
function cornerUnit(view, g, it, armCm, build) {
  const back = new THREE.Group();
  build(back, { ...it, d: armCm });
  back.position.z = (-it.d / 2 + armCm / 2) * M;
  g.add(back);
  const side = new THREE.Group();
  build(side, { ...it, w: it.d - armCm, d: armCm });
  side.rotation.y = Math.PI / 2;
  side.position.set((-it.w / 2 + armCm / 2) * M, 0, (armCm / 2) * M);
  g.add(side);
}

function sinkBasin(view, g, x, z, bw, bd, topY, color = '#9ea3a8') {
  const opts = color === '#9ea3a8' || color === '#c9ccd0' ? { metalness: 0.8, roughness: 0.25 } : { roughness: 0.4 };
  g.add(box(view, bw, 0.012, bd, color, x, topY - 0.002, z, opts));
  g.add(box(view, bw - 0.04, 0.013, bd - 0.04, '#4a4e53', x, topY - 0.002, z, { metalness: 0.6, roughness: 0.4 }));
}

function faucet(view, g, x, z, topY, color = STEEL, height = 0.3) {
  g.add(cyl(view, 0.015, height, color, x, topY, z, { metalness: 0.9, roughness: 0.2 }));
  g.add(box(view, 0.025, 0.025, 0.18, color, x, topY + height - 0.02, z + 0.08, { metalness: 0.9, roughness: 0.2 }));
}

function hobTop(view, g, w, d, topY, frameless, { gas = false, zones = 4, color = '#111214' } = {}) {
  const hw = Math.min(w - 0.02, 0.9);
  const hd = Math.min(d - 0.02, 0.52);
  g.add(box(view, hw, frameless ? 0.006 : 0.012, hd, color, 0, topY, 0.0, gas ? METAL : { roughness: 0.15 }));
  const spots = zones === 1 ? [[0, 0, 0.1]] : [[-0.14, -0.11, 0.09], [0.14, -0.11, 0.07], [-0.14, 0.12, 0.07], [0.14, 0.12, 0.09]];
  const sx = zones === 1 ? 1 : Math.min(hw / 0.58, 1.3);
  const sz = zones === 1 ? 1 : hd / 0.5;
  for (const [x, z, r] of spots) {
    if (gas) {
      g.add(cyl(view, r * 0.55, 0.02, DARK, x * sx, topY + 0.006, z * sz, {}));
      g.add(box(view, r * 2.2, 0.01, 0.012, DARK, x * sx, topY + 0.026, z * sz));
      g.add(box(view, 0.012, 0.01, r * 2.2, DARK, x * sx, topY + 0.026, z * sz));
    } else {
      const ring = new THREE.Mesh(new THREE.RingGeometry(r * 0.85, r, 32), view.material('#6b6e73'));
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(x * sx, topY + 0.013, z * sz);
      g.add(ring);
    }
  }
}

function ovenFront(view, g, w, d, y, color) {
  g.add(box(view, w - 0.01, 0.6, 0.02, color === DARK ? DARK : color, 0, y, d / 2, { roughness: 0.2, metalness: color === DARK ? 0 : 0.5 }));
  g.add(box(view, w - 0.12, 0.3, 0.022, '#15171a', 0, y + 0.14, d / 2, { roughness: 0.05 }));
  g.add(box(view, w - 0.14, 0.015, 0.03, STEEL, 0, y + 0.5, d / 2 + 0.02, METAL));
}

function microFront(view, g, w, d, y, h) {
  g.add(box(view, w - 0.01, h, 0.02, DARK, 0, y, d / 2, { roughness: 0.2 }));
  g.add(box(view, w * 0.62, h * 0.7, 0.022, '#0d0e10', -w * 0.12, y + h * 0.15, d / 2, { roughness: 0.05 }));
}

/** Shelves held by four corner posts. */
function rack(view, g, it, { shelves = 3, top, posts = it.color, legsOnly = false } = {}) {
  const w = it.w * M; const d = it.d * M; const h = it.h * M;
  const post = 0.025;
  const lx = w / 2 - post / 2; const lz = d / 2 - post / 2;
  for (const [x, z] of [[-lx, -lz], [lx, -lz], [-lx, lz], [lx, lz]]) g.add(box(view, post, h, post, posts, x, 0, z, METAL));
  const n = Math.max(1, shelves);
  for (let i = 0; i < n; i++) {
    const y = legsOnly ? 0.15 : 0.06 + ((h - 0.08) * i) / Math.max(1, n - 1);
    g.add(box(view, w - 0.01, 0.02, d - 0.01, i === n - 1 && top ? top : it.color, 0, Math.min(y, h - 0.02), 0, { roughness: 0.5 }));
  }
}

export const BUILDERS = {
  base: (v, g, it, look) => baseUnit(v, g, it, { cols: look.cols, countertop: look.countertop ?? true, drawer: look.drawer }),
  drawers: (v, g, it, look) => baseUnit(v, g, it, { rows: look.rows ?? 3, cols: 1 }),
  dishwasher: (v, g, it) => baseUnit(v, g, it, { rows: 1, cols: 1 }),
  blindcorner(v, g, it) {
    baseUnit(v, g, it, { front: false });
    const w = it.w * M; const d = it.d * M; const h = it.h * M;
    const doorW = Math.min(0.6, w * 0.5);
    g.add(box(v, w - doorW - 0.004, h - 0.14, 0.018, it.color, -doorW / 2, 0.104, d / 2));
    fronts(v, g, { w: doorW, d: d - 0.02, y0: 0.1, y1: h - 0.04, color: it.color, cx: w / 2 - doorW / 2 });
  },
  corner: (v, g, it) => cornerUnit(v, g, it, 60, (sub, part) => baseUnit(v, sub, part, { cols: 1 })),
  wallcorner: (v, g, it) => cornerUnit(v, g, it, 37, (sub, part) => wallUnit(v, sub, part, { cols: 1 })),
  ovenbase(v, g, it) {
    baseUnit(v, g, it, { front: false });
    const w = it.w * M; const d = it.d * M; const h = it.h * M;
    fronts(v, g, { w, d: d - 0.02, y0: 0.1, y1: h - 0.66, color: it.color, rows: 1 });
    ovenFront(v, g, w, d - 0.02, h - 0.65, DARK);
  },
  island(v, g, it, look) {
    const w = it.w * M; const d = it.d * M; const h = it.h * M;
    g.add(box(v, w - 0.1, 0.1, d - 0.4, DARK, 0, 0, 0));
    g.add(box(v, w - 0.02, h - 0.14, d - 0.3, it.color, 0, 0.1, -0.05));
    fronts(v, g, { w: w - 0.02, d: d - 0.4, y0: 0.1, y1: h - 0.04, cols: Math.max(1, Math.round(w / 0.6)), rows: 1, color: it.color });
    g.add(box(v, w + 0.04, 0.04, d, look.top ?? COUNTER, 0, h - 0.04, 0, { roughness: 0.35 }));
  },
  opentable(v, g, it, look) {
    const w = it.w * M; const d = it.d * M; const h = it.h * M;
    const leg = 0.05;
    const lx = w / 2 - leg / 2 - 0.02; const lz = d / 2 - leg / 2 - 0.02;
    for (const [x, z] of [[-lx, -lz], [lx, -lz], [-lx, lz], [lx, lz]]) g.add(box(v, leg, h - 0.04, leg, it.color, x, 0, z));
    for (let i = 0; i < (look.shelves ?? 1); i++) {
      g.add(box(v, w - 0.06, 0.025, d - 0.06, it.color, 0, 0.12 + i * 0.3, 0, { roughness: 0.6 }));
    }
    g.add(box(v, w, 0.04, d, look.top ?? it.color, 0, h - 0.04, 0, { roughness: 0.45 }));
  },
  wall: (v, g, it, look) => wallUnit(v, g, it, look),
  shelf(v, g, it) {
    g.add(box(v, it.w * M, it.h * M, it.d * M, it.color, 0, 0, 0));
  },
  railshelf(v, g, it) {
    const w = it.w * M; const d = it.d * M; const h = it.h * M;
    g.add(box(v, w, 0.015, d, it.color, 0, h - 0.015, 0, METAL));
    for (const x of [-w / 2 + 0.03, w / 2 - 0.03]) g.add(box(v, 0.01, h, 0.02, it.color, x, 0, -d / 2 + 0.01, METAL));
    const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, w - 0.04, 12), v.material(it.color, METAL));
    rail.rotation.z = Math.PI / 2;
    rail.position.set(0, 0.03, -d / 2 + 0.03);
    g.add(rail);
  },
  rail(v, g, it) {
    const w = it.w * M; const d = it.d * M;
    const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, w, 12), v.material(it.color, METAL));
    rail.rotation.z = Math.PI / 2;
    rail.position.set(0, 0.015, d / 2 - 0.01);
    g.add(rail);
    for (const x of [-w / 2 + 0.03, w / 2 - 0.03]) g.add(box(v, 0.012, 0.012, d, it.color, x, 0.009, 0, METAL));
  },
  rack: (v, g, it, look) => rack(v, g, it, look),
  cubes(v, g, it, look) {
    const w = it.w * M; const d = it.d * M; const h = it.h * M;
    const t = 0.035; const cols = look.cols ?? 2; const rows = look.rows ?? 4;
    g.add(box(v, w, t, d, it.color, 0, 0, 0));
    g.add(box(v, w, t, d, it.color, 0, h - t, 0));
    g.add(box(v, w, h, 0.005, '#d9d6cf', 0, 0, -d / 2 + 0.003));
    for (let c = 0; c <= cols; c++) g.add(box(v, t, h - 2 * t, d, it.color, -w / 2 + t / 2 + ((w - t) * c) / cols, t, 0));
    for (let r = 1; r < rows; r++) g.add(box(v, w - 2 * t, 0.015, d, it.color, 0, t + ((h - 2 * t) * r) / rows, 0));
  },
  tall(v, g, it, look) {
    const w = it.w * M; const d = it.d * M; const h = it.h * M;
    const plinth = look.plinth === false ? 0 : 0.1;
    if (plinth) g.add(box(v, w, plinth, d - 0.06, DARK, 0, 0, -0.03));
    g.add(box(v, w - 0.004, h - plinth, d - 0.02, '#e7e3dc', 0, plinth, -0.01));
    const splits = [0, ...(look.splits ?? [0.62]), 1];
    const cols = look.cols ?? 1;
    for (let i = 0; i < splits.length - 1; i++) {
      const y0 = plinth + (h - plinth) * splits[i];
      const y1 = plinth + (h - plinth) * splits[i + 1];
      fronts(v, g, { w, d: d - 0.02, y0, y1, cols, color: it.color, handleLow: i > 0 });
    }
  },
  oventower(v, g, it) {
    const w = it.w * M; const d = it.d * M; const h = it.h * M;
    g.add(box(v, w, 0.1, d - 0.06, DARK, 0, 0, -0.03));
    g.add(box(v, w - 0.004, h - 0.1, d - 0.02, '#e7e3dc', 0, 0.1, -0.01));
    fronts(v, g, { w, d: d - 0.02, y0: 0.1, y1: 0.8, rows: 2, color: it.color });
    ovenFront(v, g, w, d, 0.82, DARK);
    fronts(v, g, { w, d: d - 0.02, y0: 1.44, y1: h, color: it.color });
  },
  ovenmicro(v, g, it) {
    const w = it.w * M; const d = it.d * M; const h = it.h * M;
    g.add(box(v, w, 0.1, d - 0.06, DARK, 0, 0, -0.03));
    g.add(box(v, w - 0.004, h - 0.1, d - 0.02, '#e7e3dc', 0, 0.1, -0.01));
    fronts(v, g, { w, d: d - 0.02, y0: 0.1, y1: 0.8, rows: 2, color: it.color });
    ovenFront(v, g, w, d, 0.82, DARK);
    microFront(v, g, w, d, 1.44, 0.38);
    fronts(v, g, { w, d: d - 0.02, y0: 1.84, y1: h, color: it.color, handleLow: true });
  },
  oven(v, g, it) {
    const w = it.w * M; const d = it.d * M; const h = it.h * M;
    g.add(box(v, w - 0.01, h, d - 0.02, '#3a3c40', 0, 0, -0.01));
    ovenFront(v, g, w, d - 0.02, Math.max(0, h - 0.6), it.color === '#2b2d31' ? DARK : it.color);
  },
  fridge(v, g, it, look) {
    const w = it.w * M; const d = it.d * M; const h = it.h * M;
    const opts = { metalness: 0.6, roughness: 0.35 };
    g.add(box(v, w, h, d - 0.03, it.color, 0, 0, -0.015, opts));
    if (look.sideBySide) {
      g.add(box(v, w / 2 - 0.01, h - 0.02, 0.03, it.color, -w / 4, 0.01, d / 2 - 0.015, opts));
      g.add(box(v, w / 2 - 0.01, h - 0.02, 0.03, it.color, w / 4, 0.01, d / 2 - 0.015, opts));
      for (const x of [-0.03, 0.03]) g.add(box(v, 0.02, 0.6, 0.03, '#8e9297', x, h / 2 - 0.3, d / 2 + 0.01, opts));
      return;
    }
    const split = h * (look.split ?? 0.62);
    if (split > 0.01) g.add(box(v, w - 0.01, split - 0.02, 0.03, it.color, 0, 0.01, d / 2 - 0.015, opts));
    g.add(box(v, w - 0.01, h - split - 0.02, 0.03, it.color, 0, split + 0.01, d / 2 - 0.015, opts));
    if (split > 0.01) g.add(box(v, 0.02, Math.min(0.5, split * 0.5), 0.03, '#8e9297', w / 2 - 0.06, split - Math.min(0.55, split * 0.6), d / 2 + 0.01, opts));
    g.add(box(v, 0.02, Math.min(0.4, (h - split) * 0.4), 0.03, '#8e9297', w / 2 - 0.06, split + 0.1, d / 2 + 0.01, opts));
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
  hob(v, g, it, look) {
    baseUnit(v, g, it, { rows: look.rows ?? 3, cols: 1 });
    hobTop(v, g, it.w * M, it.d * M, it.h * M, true);
  },
  hobonly(v, g, it, look) {
    const w = it.w * M; const d = it.d * M; const h = it.h * M;
    if (h > 0.03) g.add(box(v, w, h - 0.006, d, look.gas ? it.color : DARK, 0, 0, 0, look.gas ? METAL : {}));
    hobTop(v, g, w + 0.02, d + 0.02, Math.max(0, h - 0.006), true, { gas: look.gas, zones: look.zones, color: look.gas ? it.color : '#111214' });
  },
  appliancebox(v, g, it, look) {
    const w = it.w * M; const d = it.d * M; const h = it.h * M;
    g.add(box(v, w, h, d, it.color, 0, 0, 0, { roughness: 0.35, metalness: 0.2 }));
    if (look.panel) g.add(box(v, w - 0.04, 0.08, 0.01, '#3a3c40', 0, h - 0.1, d / 2, { roughness: 0.2 }));
    else g.add(box(v, w * 0.6, h * 0.3, 0.01, '#15171a', 0, h * 0.55, d / 2, { roughness: 0.1 }));
  },
  canister(v, g, it) {
    const h = it.h * M; const r = Math.min(it.w, it.d) * M * 0.45;
    g.add(cyl(v, r, h, it.color, 0, 0, 0, METAL));
  },
  hood(v, g, it, look) {
    const w = it.w * M; const d = it.d * M; const h = it.h * M;
    const opts = { metalness: 0.7, roughness: 0.3 };
    g.add(box(v, w, 0.06, d, it.color, 0, 0, 0, opts));
    g.add(box(v, w * 0.4, h - 0.06, d * 0.45, it.color, 0, 0.06, look.island ? 0 : -d * 0.275, opts));
  },
  hoodflat(v, g, it) {
    const w = it.w * M; const d = it.d * M; const h = it.h * M;
    g.add(box(v, w - 0.01, h, d, it.color, 0, 0, 0, { metalness: 0.7, roughness: 0.3 }));
    g.add(box(v, w * 0.7, 0.002, d * 0.6, '#55595e', 0, -0.002, 0));
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
  apron(v, g, it, look) {
    // Ceramic farmhouse sink: the bowl's front replaces the top door.
    const w = it.w * M; const d = it.d * M; const h = it.h * M;
    baseUnit(v, g, { ...it, h: it.h - 23 }, { countertop: false, cols: w > 0.65 ? 2 : 1 });
    g.add(box(v, w, 0.23, d - 0.01, '#f7f7f5', 0, h - 0.23, 0.005, { roughness: 0.25 }));
    const bowls = look.bowls ?? 1;
    const bw = (w - 0.08 - (bowls - 1) * 0.04) / bowls;
    for (let i = 0; i < bowls; i++) {
      const x = -w / 2 + 0.04 + bw / 2 + i * (bw + 0.04);
      g.add(box(v, bw, 0.012, d - 0.16, '#d5d6d3', x, h - 0.01, 0.04, { roughness: 0.3 }));
    }
    faucet(v, g, 0, -d / 2 + 0.05, h);
  },
  sinktop(v, g, it, look) {
    const w = it.w * M; const d = it.d * M;
    const bowls = look.bowls ?? 1;
    const color = it.color;
    const opts = color === '#2b2d31' ? { roughness: 0.5 } : METAL;
    g.add(box(v, w, 0.008, d, color, 0, 0, 0, opts));
    if (look.drainer) {
      const bw = w * 0.5;
      g.add(box(v, bw - 0.04, 0.01, d - 0.08, '#4a4e53', -w / 4, 0.001, 0.01, { metalness: 0.6, roughness: 0.4 }));
      for (let i = 0; i < 6; i++) g.add(box(v, w * 0.4, 0.003, 0.006, '#8b9095', w / 4, 0.008, -d / 2 + 0.08 + i * ((d - 0.16) / 5), METAL));
    } else {
      const bw = (w - 0.06 - (bowls - 1) * 0.04) / bowls;
      for (let i = 0; i < bowls; i++) {
        const x = -w / 2 + 0.03 + bw / 2 + i * (bw + 0.04);
        g.add(box(v, bw, 0.01, d - 0.08, '#4a4e53', x, 0.001, 0.01, { metalness: 0.6, roughness: 0.4 }));
      }
    }
    faucet(v, g, look.drainer ? -w / 4 : 0, -d / 2 + 0.03, 0, STEEL, 0.28);
  },
  tap(v, g, it) {
    faucet(v, g, 0, -it.d * M / 2 + 0.02, 0, it.color, it.h * M);
  },
  worktop(v, g, it) {
    g.add(box(v, it.w * M, it.h * M, it.d * M, it.color, 0, 0, 0, { roughness: 0.4 }));
  },
  table(v, g, it) {
    const w = it.w * M; const d = it.d * M; const h = it.h * M;
    g.add(box(v, w, 0.04, d, it.color, 0, h - 0.04, 0, { roughness: 0.5 }));
    const lx = w / 2 - 0.06; const lz = d / 2 - 0.06;
    for (const [x, z] of [[-lx, -lz], [lx, -lz], [-lx, lz], [lx, lz]]) g.add(box(v, 0.05, h - 0.04, 0.05, it.color, x, 0, z));
  },
  roundtable(v, g, it) {
    const h = it.h * M; const r = Math.min(it.w, it.d) * M / 2;
    g.add(cyl(v, r, 0.035, it.color, 0, h - 0.035, 0, { roughness: 0.5 }));
    g.add(cyl(v, 0.06, h - 0.035, it.color, 0, 0, 0));
    g.add(cyl(v, r * 0.45, 0.03, it.color, 0, 0, 0));
  },
  chair(v, g, it, look) {
    const w = it.w * M; const d = it.d * M; const h = it.h * M;
    const seat = (look.seat ?? 46) * M;
    g.add(box(v, w, 0.04, d, it.color, 0, seat - 0.04, 0));
    const lx = w / 2 - 0.03; const lz = d / 2 - 0.03;
    for (const [x, z] of [[-lx, -lz], [lx, -lz], [-lx, lz], [lx, lz]]) g.add(box(v, 0.03, seat - 0.04, 0.03, it.color, x, 0, z));
    if (look.seat) g.add(box(v, w - 0.04, 0.02, 0.02, it.color, 0, 0.25, lz));
    g.add(box(v, w, h - seat, 0.03, it.color, 0, seat, -d / 2 + 0.015));
  },
  stool(v, g, it) {
    const h = it.h * M;
    const r = Math.min(it.w, it.d) * M * 0.45;
    g.add(cyl(v, r, 0.05, it.color, 0, h - 0.05, 0));
    g.add(cyl(v, 0.025, h - 0.05, STEEL, 0, 0, 0, METAL));
    g.add(cyl(v, r * 0.9, 0.02, STEEL, 0, 0, 0, METAL));
  },

  // ---------- doors and windows (sit inside the wall thickness) ----------
  door(v, g, it, look) {
    const w = it.w * M; const h = it.h * M;
    const t = v.project.room.wallThickness * M;
    const frame = 0.05;
    const fd = t + 0.02;
    // Frame (jambs + head) wraps the wall on both sides.
    g.add(box(v, frame, h, fd, it.color, -w / 2 + frame / 2, 0, 0));
    g.add(box(v, frame, h, fd, it.color, w / 2 - frame / 2, 0, 0));
    g.add(box(v, w, frame, fd, it.color, 0, h - frame, 0));
    const lw = w - 2 * frame;
    const lh = h - frame - 0.01;
    const leaves = look.sliding ? 2 : look.leaves ?? 1;
    const leafW = lw / leaves;
    for (let i = 0; i < leaves; i++) {
      const x = -lw / 2 + leafW * (i + 0.5);
      const z = look.sliding ? (i ? -0.02 : 0.02) : t / 2 - 0.025;
      const lwid = look.sliding ? leafW + 0.03 : leafW - 0.004;
      if (look.glass || look.sliding) {
        const b = 0.07;
        g.add(box(v, lwid, b, 0.04, it.color, x, 0.005, z));
        g.add(box(v, lwid, b, 0.04, it.color, x, lh - b, z));
        g.add(box(v, b, lh - 2 * b, 0.04, it.color, x - lwid / 2 + b / 2, b, z));
        g.add(box(v, b, lh - 2 * b, 0.04, it.color, x + lwid / 2 - b / 2, b, z));
        g.add(box(v, lwid - 2 * b, lh - 2 * b, 0.008, '#cfe3e8', x, b, z, GLASS));
      } else {
        g.add(box(v, lwid, lh, 0.04, it.color, x, 0.005, z, { roughness: 0.5 }));
      }
      // Lever handles on both faces, at the opening edge of each leaf.
      const hx = leaves === 1 ? x + leafW / 2 - 0.08 : x + (i === 0 ? leafW / 2 - 0.06 : -leafW / 2 + 0.06);
      for (const side of [1, -1]) {
        g.add(box(v, 0.12, 0.02, 0.02, STEEL, hx + (leaves === 2 && i === 1 ? 0.04 : -0.04), 1.04, z + side * 0.035, METAL));
      }
    }
  },
  passage(v, g, it) {
    const w = it.w * M; const h = it.h * M;
    const t = v.project.room.wallThickness * M;
    const frame = 0.06;
    g.add(box(v, frame, h, t + 0.01, it.color, -w / 2 + frame / 2, 0, 0));
    g.add(box(v, frame, h, t + 0.01, it.color, w / 2 - frame / 2, 0, 0));
    g.add(box(v, w, frame, t + 0.01, it.color, 0, h - frame, 0));
  },
  window(v, g, it, look) {
    const w = it.w * M; const h = it.h * M;
    const t = v.project.room.wallThickness * M;
    const f = 0.06;
    const fd = 0.08;
    const z = -t / 2 + fd / 2 + 0.02;
    g.add(box(v, w, f, fd, it.color, 0, 0, z));
    g.add(box(v, w, f, fd, it.color, 0, h - f, z));
    g.add(box(v, f, h - 2 * f, fd, it.color, -w / 2 + f / 2, f, z));
    g.add(box(v, f, h - 2 * f, fd, it.color, w / 2 - f / 2, f, z));
    const panes = look.panes ?? 1;
    for (let i = 1; i < panes; i++) g.add(box(v, 0.05, h - 2 * f, fd, it.color, -w / 2 + (w * i) / panes, f, z));
    g.add(box(v, w - 2 * f, h - 2 * f, 0.008, '#cfe3e8', 0, f, z, GLASS));
    // Window sill on the room side.
    g.add(box(v, w + 0.06, 0.025, t / 2 + 0.04, '#f2f0eb', 0, -0.025, t / 4 + 0.02));
  },
};

export function buildItem(it, view) {
  const g = new THREE.Group();
  const entry = catalogEntry(it.type);
  const style = entry?.style ?? 'base';
  (BUILDERS[style] ?? BUILDERS.base)(view, g, it, entry?.look ?? {});
  mergeByMaterial(g);
  g.userData.itemId = it.id;
  return g;
}
