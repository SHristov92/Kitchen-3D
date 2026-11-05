import { catalogEntry } from './catalog.js';
import {
  bounds, dist, itemCorners, offsetPolygon, pointInItem, projectOnSegment, isSelfIntersecting,
} from './geometry.js';
import { createItem } from './model.js';
import { snapItemToWalls } from './snapping.js';

const GRID_SNAP = 5; // cm
const HIT_PX = 9;

export const DRAG_MIME = 'application/x-kitchen-item';

/** The plan view: room outline, objects and the walker, edited with the mouse. */
export class Editor2D {
  constructor(canvas, store) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.store = store;
    this.view = { scale: 1, ox: 0, oy: 0 };
    this.drag = null;
    this.hover = null;
    this.needsFit = true;

    new ResizeObserver(() => this.resize()).observe(canvas);
    canvas.addEventListener('pointerdown', (e) => this.onDown(e));
    canvas.addEventListener('pointermove', (e) => this.onMove(e));
    canvas.addEventListener('pointerup', (e) => this.onUp(e));
    canvas.addEventListener('pointercancel', (e) => this.onUp(e));
    canvas.addEventListener('dblclick', (e) => this.onDoubleClick(e));
    canvas.addEventListener('wheel', (e) => this.onWheel(e), { passive: false });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    canvas.addEventListener('dragover', (e) => {
      if (e.dataTransfer.types.includes(DRAG_MIME)) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; }
    });
    canvas.addEventListener('drop', (e) => this.onDrop(e));

    store.subscribe((reason) => {
      if (reason === 'load') this.needsFit = true;
      this.requestDraw();
    });
    this.resize();
  }

  get project() { return this.store.project; }

  resize() {
    const r = this.canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this.width = r.width;
    this.height = r.height;
    this.canvas.width = Math.max(1, Math.round(r.width * dpr));
    this.canvas.height = Math.max(1, Math.round(r.height * dpr));
    this.dpr = dpr;
    if (this.needsFit) this.fit();
    this.draw();
  }

  fit() {
    if (!this.width || !this.height) return;
    const b = bounds(this.project.room.points);
    const pad = 70;
    const scale = Math.min((this.width - pad * 2) / Math.max(b.width, 50), (this.height - pad * 2) / Math.max(b.height, 50));
    this.view.scale = Math.max(0.05, Math.min(scale, 8));
    this.view.ox = this.width / 2 - (b.minX + b.width / 2) * this.view.scale;
    this.view.oy = this.height / 2 - (b.minY + b.height / 2) * this.view.scale;
    this.needsFit = false;
    this.requestDraw();
  }

  toWorld(sx, sy) {
    return { x: (sx - this.view.ox) / this.view.scale, y: (sy - this.view.oy) / this.view.scale };
  }

  toScreen(p) {
    return { x: p.x * this.view.scale + this.view.ox, y: p.y * this.view.scale + this.view.oy };
  }

  eventPos(e) {
    const r = this.canvas.getBoundingClientRect();
    const sx = e.clientX - r.left;
    const sy = e.clientY - r.top;
    return { sx, sy, world: this.toWorld(sx, sy) };
  }

  /** Visible centre of the plan, used when adding objects by click. */
  viewCenter() {
    return this.toWorld(this.width / 2, this.height / 2);
  }

  // ---------- hit testing ----------

  hitTest(world) {
    const tol = HIT_PX / this.view.scale;
    const p = this.project;
    const v = p.viewer;
    if (dist(world, v) < Math.max(tol, 22)) return { kind: 'viewer' };
    const pts = p.room.points;
    for (let i = 0; i < pts.length; i++) {
      if (dist(world, pts[i]) < tol) return { kind: 'vertex', index: i };
    }
    // Items: wall-mounted ones last so floor units are easier to grab? Prefer the selected one.
    const sel = this.store.selectedItem();
    if (sel && pointInItem(sel, world)) return { kind: 'item', id: sel.id };
    for (let i = p.items.length - 1; i >= 0; i--) {
      if (pointInItem(p.items[i], world)) return { kind: 'item', id: p.items[i].id };
    }
    const wallTol = Math.max(tol, p.room.wallThickness);
    for (let i = 0; i < pts.length; i++) {
      const { distance } = projectOnSegment(world, pts[i], pts[(i + 1) % pts.length]);
      if (distance < wallTol) return { kind: 'wall', index: i };
    }
    return null;
  }

  // ---------- pointer handling ----------

  onDown(e) {
    this.canvas.setPointerCapture(e.pointerId);
    const { sx, sy, world } = this.eventPos(e);
    if (e.button === 1 || e.button === 2) {
      this.drag = { kind: 'pan', sx, sy, ox: this.view.ox, oy: this.view.oy };
      return;
    }
    const hit = this.hitTest(world);
    if (!hit) {
      this.store.select(null);
      this.drag = { kind: 'pan', sx, sy, ox: this.view.ox, oy: this.view.oy };
      return;
    }
    if (hit.kind !== 'viewer') this.store.select(hit);
    const p = this.project;
    if (hit.kind === 'vertex') {
      this.drag = { kind: 'vertex', index: hit.index, started: false };
    } else if (hit.kind === 'wall') {
      const i = hit.index;
      const pts = p.room.points;
      this.drag = {
        kind: 'wall', index: i, start: world, started: false,
        a0: { ...pts[i] }, b0: { ...pts[(i + 1) % pts.length] },
      };
    } else if (hit.kind === 'item') {
      const it = p.items.find((x) => x.id === hit.id);
      this.drag = { kind: 'item', id: hit.id, dx: world.x - it.x, dy: world.y - it.y, started: false };
    } else if (hit.kind === 'viewer') {
      this.drag = { kind: 'viewer', dx: world.x - p.viewer.x, dy: world.y - p.viewer.y };
    }
  }

  beginDrag() {
    if (!this.drag.started) {
      this.store.checkpoint();
      this.drag.started = true;
    }
  }

  onMove(e) {
    const { sx, sy, world } = this.eventPos(e);
    const d = this.drag;
    const free = e.altKey;
    if (!d) {
      const hit = this.hitTest(world);
      this.canvas.style.cursor = !hit ? 'grab'
        : hit.kind === 'vertex' ? 'move'
        : hit.kind === 'wall' ? 'ew-resize'
        : 'pointer';
      return;
    }
    const pts = this.project.room.points;
    if (d.kind === 'pan') {
      this.view.ox = d.ox + (sx - d.sx);
      this.view.oy = d.oy + (sy - d.sy);
      this.canvas.style.cursor = 'grabbing';
      this.requestDraw();
    } else if (d.kind === 'vertex') {
      this.beginDrag();
      const p = free ? world : this.snapVertex(world, d.index);
      this.store.change((proj) => { proj.room.points[d.index] = p; }, { record: false });
    } else if (d.kind === 'wall') {
      this.beginDrag();
      const { a0, b0 } = d;
      const len = dist(a0, b0) || 1;
      const nx = -(b0.y - a0.y) / len;
      const ny = (b0.x - a0.x) / len;
      let t = (world.x - d.start.x) * nx + (world.y - d.start.y) * ny;
      if (!free) t = Math.round(t / GRID_SNAP) * GRID_SNAP;
      const j = (d.index + 1) % pts.length;
      this.store.change((proj) => {
        proj.room.points[d.index] = { x: round1(a0.x + nx * t), y: round1(a0.y + ny * t) };
        proj.room.points[j] = { x: round1(b0.x + nx * t), y: round1(b0.y + ny * t) };
      }, { record: false });
    } else if (d.kind === 'item') {
      this.beginDrag();
      this.store.change((proj) => {
        const it = proj.items.find((x) => x.id === d.id);
        if (!it) return;
        it.x = world.x - d.dx;
        it.y = world.y - d.dy;
        if (!free) {
          it.x = Math.round(it.x);
          it.y = Math.round(it.y);
          const s = snapItemToWalls(it, proj.room.points, proj.items);
          if (s) Object.assign(it, s);
        }
      }, { record: false });
    } else if (d.kind === 'viewer') {
      this.store.setViewer({ x: world.x - d.dx, y: world.y - d.dy });
    }
  }

  onUp(e) {
    if (this.canvas.hasPointerCapture(e.pointerId)) this.canvas.releasePointerCapture(e.pointerId);
    this.drag = null;
  }

  snapVertex(world, index) {
    const pts = this.project.room.points;
    let x = Math.round(world.x / GRID_SNAP) * GRID_SNAP;
    let y = Math.round(world.y / GRID_SNAP) * GRID_SNAP;
    const tol = 10 / this.view.scale;
    // Keep walls straight: line the corner up with its neighbours when close.
    for (const k of [index - 1, index + 1]) {
      const q = pts[(k + pts.length) % pts.length];
      if (Math.abs(world.x - q.x) < tol) x = q.x;
      if (Math.abs(world.y - q.y) < tol) y = q.y;
    }
    return { x, y };
  }

  onDoubleClick(e) {
    const { world } = this.eventPos(e);
    const hit = this.hitTest(world);
    if (hit?.kind === 'vertex') {
      this.removeVertex(hit.index);
    } else if (hit?.kind === 'wall') {
      this.splitWall(hit.index, world);
    }
  }

  splitWall(index, at) {
    const pts = this.project.room.points;
    const a = pts[index];
    const b = pts[(index + 1) % pts.length];
    const p = at ? projectOnSegment(at, a, b).point : { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    this.store.change((proj) => {
      proj.room.points.splice(index + 1, 0, { x: Math.round(p.x), y: Math.round(p.y) });
    });
    this.store.select({ kind: 'vertex', index: index + 1 });
  }

  removeVertex(index) {
    if (this.project.room.points.length <= 3) return;
    this.store.change((proj) => { proj.room.points.splice(index, 1); });
    this.store.select(null);
  }

  onWheel(e) {
    e.preventDefault();
    const { sx, sy } = this.eventPos(e);
    const factor = Math.exp(-e.deltaY * 0.0015);
    const before = this.toWorld(sx, sy);
    this.view.scale = Math.max(0.05, Math.min(this.view.scale * factor, 10));
    this.view.ox = sx - before.x * this.view.scale;
    this.view.oy = sy - before.y * this.view.scale;
    this.requestDraw();
  }

  onDrop(e) {
    const type = e.dataTransfer.getData(DRAG_MIME);
    if (!type) return;
    e.preventDefault();
    const { world } = this.eventPos(e);
    this.addItem(type, world);
  }

  /** Add a library object at a plan position (snapped to a wall if one is close). */
  addItem(type, at = this.viewCenter()) {
    const item = createItem(type, Math.round(at.x), Math.round(at.y));
    const s = snapItemToWalls(item, this.project.room.points, this.project.items, 60);
    if (s) Object.assign(item, s);
    this.store.change((proj) => { proj.items.push(item); });
    this.store.select({ kind: 'item', id: item.id });
    return item;
  }

  // ---------- drawing ----------

  requestDraw() {
    if (this.raf) return;
    this.raf = requestAnimationFrame(() => {
      this.raf = null;
      this.draw();
    });
  }

  draw() {
    const { ctx, width, height } = this;
    if (!width) return;
    const css = getComputedStyle(document.documentElement);
    const col = (name) => css.getPropertyValue(name).trim();
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.fillStyle = col('--plan-bg');
    ctx.fillRect(0, 0, width, height);
    this.drawGrid(col);

    const p = this.project;
    const pts = p.room.points;
    const bad = isSelfIntersecting(pts);
    const sel = this.store.selection;

    // Floor
    ctx.beginPath();
    this.pathPoly(pts);
    ctx.fillStyle = bad ? 'rgba(220,60,60,0.15)' : col('--plan-floor');
    ctx.fill();

    // Walls as a band between the inner outline and its outward offset.
    const outer = offsetPolygon(pts, p.room.wallThickness);
    ctx.beginPath();
    this.pathPoly(outer);
    this.pathPoly([...pts].reverse());
    ctx.fillStyle = bad ? '#c44' : col('--plan-wall');
    ctx.fill('evenodd');

    if (sel?.kind === 'wall' && pts[sel.index]) {
      const a = this.toScreen(pts[sel.index]);
      const b = this.toScreen(pts[(sel.index + 1) % pts.length]);
      ctx.strokeStyle = col('--accent');
      ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    }

    // Items: floor units first, wall units on top.
    const items = [...p.items].sort((a, b) => a.elevation - b.elevation);
    for (const it of items) this.drawItem(it, sel?.kind === 'item' && sel.id === it.id, col);

    this.drawDimensions(pts, outer, col);

    // Corners
    pts.forEach((pt, i) => {
      const s = this.toScreen(pt);
      const active = sel?.kind === 'vertex' && sel.index === i;
      ctx.beginPath();
      ctx.arc(s.x, s.y, active ? 7 : 5, 0, Math.PI * 2);
      ctx.fillStyle = active ? col('--accent') : '#fff';
      ctx.strokeStyle = col('--accent');
      ctx.lineWidth = 2;
      ctx.fill(); ctx.stroke();
    });

    this.drawViewer(col);
    this.drawScaleBar(col);
  }

  pathPoly(points) {
    points.forEach((pt, i) => {
      const s = this.toScreen(pt);
      if (i === 0) this.ctx.moveTo(s.x, s.y); else this.ctx.lineTo(s.x, s.y);
    });
    this.ctx.closePath();
  }

  drawGrid(col) {
    const { ctx, width, height, view } = this;
    const steps = [10, 50, 100];
    for (const step of steps) {
      const px = step * view.scale;
      if (px < 8) continue;
      ctx.strokeStyle = step === 100 ? col('--grid-major') : col('--grid-minor');
      ctx.lineWidth = 1;
      ctx.beginPath();
      const start = this.toWorld(0, 0);
      const x0 = Math.floor(start.x / step) * step;
      const y0 = Math.floor(start.y / step) * step;
      for (let x = x0; x * view.scale + view.ox < width; x += step) {
        const sx = Math.round(x * view.scale + view.ox) + 0.5;
        ctx.moveTo(sx, 0); ctx.lineTo(sx, height);
      }
      for (let y = y0; y * view.scale + view.oy < height; y += step) {
        const sy = Math.round(y * view.scale + view.oy) + 0.5;
        ctx.moveTo(0, sy); ctx.lineTo(width, sy);
      }
      ctx.stroke();
    }
  }

  drawItem(it, selected, col) {
    const { ctx } = this;
    const entry = catalogEntry(it.type);
    const corners = itemCorners(it).map((c) => this.toScreen(c));
    const wallMounted = it.elevation >= 100;
    ctx.save();
    ctx.beginPath();
    corners.forEach((c, i) => (i ? ctx.lineTo(c.x, c.y) : ctx.moveTo(c.x, c.y)));
    ctx.closePath();
    ctx.globalAlpha = wallMounted ? 0.55 : 0.95;
    ctx.fillStyle = it.color;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.setLineDash(wallMounted ? [5, 4] : []);
    ctx.strokeStyle = selected ? col('--accent') : 'rgba(30,30,30,0.7)';
    ctx.lineWidth = selected ? 2.5 : 1;
    ctx.stroke();
    ctx.setLineDash([]);
    // Front edge (corners 2 -> 3) shows which way the object faces.
    ctx.beginPath();
    ctx.moveTo(corners[2].x, corners[2].y);
    ctx.lineTo(corners[3].x, corners[3].y);
    ctx.strokeStyle = selected ? col('--accent') : 'rgba(30,30,30,0.9)';
    ctx.lineWidth = 3;
    ctx.stroke();

    const c = this.toScreen(it);
    const wpx = it.w * this.view.scale;
    // Wall units hang above floor units; only label them when nothing is underneath.
    const covered = wallMounted && this.project.items.some((o) => o !== it && o.elevation < 100 && pointInItem(o, it));
    if (!covered && wpx > 36 && it.d * this.view.scale > 18) {
      ctx.translate(c.x, c.y);
      let r = (it.rotation * Math.PI) / 180;
      if (r > Math.PI / 2 || r < -Math.PI / 2) r += Math.PI; // keep text upright
      ctx.rotate(r);
      ctx.fillStyle = luminance(it.color) > 0.5 ? '#222' : '#fff';
      ctx.font = '11px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const label = fitText(ctx, entry?.name ?? it.type, wpx - 6);
      ctx.fillText(label, 0, 0);
    }
    ctx.restore();
  }

  drawDimensions(pts, outer, col) {
    const { ctx } = this;
    ctx.font = '12px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % pts.length];
      const len = dist(a, b);
      if (len * this.view.scale < 30) continue;
      const oa = outer[i];
      const ob = outer[(i + 1) % pts.length];
      const mid = this.toScreen({ x: (oa.x + ob.x) / 2, y: (oa.y + ob.y) / 2 });
      const ia = this.toScreen({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
      const dx = mid.x - ia.x;
      const dy = mid.y - ia.y;
      const dl = Math.hypot(dx, dy) || 1;
      const x = mid.x + (dx / dl) * 14;
      const y = mid.y + (dy / dl) * 14;
      const text = `${formatLen(len)}`;
      const w = ctx.measureText(text).width + 8;
      ctx.fillStyle = col('--label-bg');
      ctx.fillRect(x - w / 2, y - 9, w, 18);
      ctx.fillStyle = col('--text');
      ctx.fillText(text, x, y);
    }
  }

  drawViewer(col) {
    const { ctx } = this;
    const v = this.project.viewer;
    const s = this.toScreen(v);
    const h = (v.heading * Math.PI) / 180;
    // Heading 0 looks towards -y (up on the plan); positive turns clockwise.
    const dir = { x: Math.sin(h), y: -Math.cos(h) };
    const fov = 0.5;
    const len = 46;
    ctx.beginPath();
    ctx.moveTo(s.x, s.y);
    ctx.lineTo(s.x + Math.sin(h - fov) * len, s.y - Math.cos(h - fov) * len);
    ctx.lineTo(s.x + Math.sin(h + fov) * len, s.y - Math.cos(h + fov) * len);
    ctx.closePath();
    ctx.fillStyle = 'rgba(255,140,0,0.22)';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(s.x, s.y, 8, 0, Math.PI * 2);
    ctx.fillStyle = '#ff8c00';
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(s.x, s.y);
    ctx.lineTo(s.x + dir.x * 14, s.y + dir.y * 14);
    ctx.strokeStyle = '#fff';
    ctx.stroke();
  }

  drawScaleBar(col) {
    const { ctx, height } = this;
    const targets = [10, 20, 50, 100, 200, 500, 1000];
    const cm = targets.find((t) => t * this.view.scale >= 70) ?? 1000;
    const px = cm * this.view.scale;
    const x = 16;
    const y = height - 18;
    ctx.strokeStyle = col('--text');
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, y - 5); ctx.lineTo(x, y); ctx.lineTo(x + px, y); ctx.lineTo(x + px, y - 5);
    ctx.stroke();
    ctx.fillStyle = col('--text');
    ctx.font = '11px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    ctx.fillText(formatLen(cm), x + px + 6, y + 1);
  }
}

export function formatLen(cm) {
  return cm >= 100 ? `${(cm / 100).toFixed(2)} m` : `${Math.round(cm)} cm`;
}

function round1(v) { return Math.round(v * 10) / 10; }

function luminance(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
  if (!m) return 1;
  const n = parseInt(m[1], 16);
  return (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
}

function fitText(ctx, text, maxW) {
  if (ctx.measureText(text).width <= maxW) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(`${t}…`).width > maxW) t = t.slice(0, -1);
  return `${t}…`;
}
