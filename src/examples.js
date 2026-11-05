// Ready-made example kitchens built from the IKEA range. They are generated in code
// (not stored) and open as a new project, so the user always edits a copy.

import { catalogEntry } from './catalog.js';
import { createItem, createProject, uid } from './model.js';

const T = 12; // wall thickness used by the examples

/**
 * Place objects on the walls of a rectangular W × D room.
 * `side` is the wall (top, bottom, left, right); `along` is measured from the wall's
 * start (left end of top/bottom walls, top end of left/right walls).
 */
function planner(p, W, D) {
  const ROT = { top: 0, bottom: 180, left: -90, right: 90 };
  const pos = (side, along, off) => {
    if (side === 'top') return { x: along, y: off };
    if (side === 'bottom') return { x: along, y: D - off };
    if (side === 'left') return { x: off, y: along };
    return { x: W - off, y: along };
  };
  /** One object with its centre `centre` cm along the wall, back against the wall. */
  const at = (side, centre, type) => {
    const it = createItem(type, 0, 0, ROT[side]);
    const opening = !!catalogEntry(type)?.opening;
    if (opening) it.d = T;
    Object.assign(it, pos(side, centre, opening ? -T / 2 : it.d / 2));
    p.items.push(it);
    return it;
  };
  /** A row of objects edge to edge, starting `start` cm along the wall. Numbers are gaps. */
  const run = (side, start, types) => {
    let a = start;
    for (const t of types) {
      if (typeof t === 'number') { a += t; continue; }
      const w = catalogEntry(t).w;
      at(side, a + w / 2, t);
      a += w;
    }
    return a;
  };
  /** A free-standing object anywhere in the room. */
  const free = (type, x, y, rotation = 0) => {
    const it = createItem(type, x, y, rotation);
    p.items.push(it);
    return it;
  };
  return { at, run, free };
}

function room(name, W, D, colors = {}) {
  const p = createProject(name);
  p.room.points = [{ x: 0, y: 0 }, { x: W, y: 0 }, { x: W, y: D }, { x: 0, y: D }];
  p.room.wallThickness = T;
  Object.assign(p.room, colors);
  return p;
}

const I = (t) => `ikea-${t}`;
const ids = (list) => list.map((t) => (typeof t === 'number' ? t : I(t)));

function galley() {
  const W = 270; const D = 440;
  const p = room('Galley kitchen', W, D, { floorColor: '#b9a58c' });
  const { at, run } = planner(p, W, D);
  // Left side: tall fridge and oven, then the sink run.
  run('left', 0, ids(['metod-high-fridge-60', 'metod-high-oven-60', 'metod-3dr-60', 'metod-base-60', 'metod-sink-80', 'lagan-dishwasher-60', 'metod-base-40']));
  run('left', 120, ids(['metod-wall-60x80', 'metod-wall-60x80', 'metod-wall-80x80', 'metod-wall-60x80', 'metod-wall-40x80']));
  // Right side: cooking run, starting clear of the door.
  run('right', 60, ids(['metod-2dr-60', 'metod-hob-base-60', 'metod-3dr-80', 'metod-base-60', 'metod-4dr-60']));
  run('right', 60, ids(['metod-wall-60x80', 'luftig-hood-60', 'metod-wall-80x80', 'metod-wall-60x80', 'metod-wall-60x80']));
  at('top', W / 2, 'door-80');
  at('bottom', W / 2, 'window-120');
  p.viewer = { x: W / 2, y: D - 50, heading: 0 };
  return p;
}

function lShape() {
  const W = 470; const D = 380;
  const p = room('L-shaped kitchen', W, D);
  const { at, run, free } = planner(p, W, D);
  run('top', 0, ids(['metod-corner-88', 'metod-sink-80', 'lagan-dishwasher-60', 'metod-3dr-40', 'metod-hob-base-60', 'metod-2dr-80', 'metod-high-fridge-60']));
  run('top', 0, ids(['metod-wall-corner-68', 100, 'metod-wall-60x80', 'metod-wall-40x80', 'luftig-hood-60', 'metod-wall-80x80']));
  at('top', 128, 'window-kitchen-100');
  run('left', 88, ids(['metod-3dr-60', 'metod-base-80', 'metod-2dr-60']));
  run('left', 68, ids(['metod-wall-60x80', 'metod-wall-80x80', 'metod-wall-80x80']));
  at('bottom', 380, 'door-90');
  free(I('lisabo-table'), 320, 260);
  free(I('lisabo-chair'), 290, 195, 0);
  free(I('lisabo-chair'), 350, 195, 0);
  free(I('lisabo-chair'), 290, 325, 180);
  free(I('lisabo-chair'), 350, 325, 180);
  p.viewer = { x: 420, y: 340, heading: 300 };
  return p;
}

function uShape() {
  const W = 376; const D = 340;
  const p = room('U-shaped kitchen', W, D, { floorColor: '#a89a8a', wallColor: '#eef0ec' });
  const { at, run } = planner(p, W, D);
  run('top', 0, ids(['metod-corner-88', 'lagan-dishwasher-60', 'metod-sink-80', 'metod-base-60', 'metod-corner-88']));
  run('top', 0, ids(['metod-wall-corner-68', 'metod-wall-60x80']));
  run('top', W - 128, ids(['metod-wall-60x80', 'metod-wall-corner-68']));
  at('top', W / 2, 'window-kitchen-100');
  run('left', 88, ids(['metod-hob-base-60', 'metod-2dr-80', 'metod-3dr-60']));
  run('left', 68, ids(['metod-wall-20x80', 'luftig-hood-60', 'metod-wall-80x80', 'metod-wall-60x80']));
  run('right', 88, ids(['metod-4dr-60', 'metod-base-60', 'metod-high-oven-60', 'metod-high-fridge-60']));
  run('right', 68, ids(['metod-wall-20x80', 'metod-wall-60x80', 'metod-wall-60x80']));
  at('bottom', W / 2, 'door-90');
  p.viewer = { x: W / 2, y: D - 30, heading: 0 };
  return p;
}

function island() {
  const W = 520; const D = 440;
  const p = room('Kitchen with island', W, D, { floorColor: '#d2c3ad' });
  const { at, run, free } = planner(p, W, D);
  run('top', 0, ids(['metod-high-fridge-60', 'metod-high-oven-micro-60', 'metod-3dr-60', 'metod-2dr-80', 'metod-hob-base-60', 'metod-sink-60', 'lagan-dishwasher-60', 'metod-high-80']));
  run('top', 120, ids(['metod-wall-60x100', 'metod-wall-80x100', 'luftig-hood-60', 'metod-wall-60x100', 'metod-wall-60x100']));
  free(I('metod-island-240'), 260, 230);
  for (const x of [180, 260, 340]) free(I('glenn-bar'), x, 305, 180);
  at('left', 250, 'window-120');
  at('bottom', 300, 'door-sliding-160');
  at('right', 120, 'door-90');
  p.viewer = { x: 440, y: 390, heading: 310 };
  return p;
}

function oneWall() {
  const W = 340; const D = 290;
  const p = room('Compact one-wall kitchen', W, D, { floorColor: '#c9b9a3' });
  const { at, run, free } = planner(p, W, D);
  run('top', 0, ids(['metod-high-fridge-60', 'metod-sink-60', 'medelstor-dishwasher-45', 'metod-3dr-40', 'metod-hob-base-60', 'metod-2dr-60']));
  run('top', 60, ids(['metod-wall-60x80', 'metod-wall-40x80', 'metod-wall-40x80', 5, 'luftig-hood-60', 'metod-wall-60x80']));
  free(I('docksta'), 220, 190);
  free(I('teodores'), 142, 190, -90);
  free(I('teodores'), 298, 190, 90);
  at('left', 200, 'door-80');
  at('bottom', 200, 'window-120');
  p.viewer = { x: 90, y: 250, heading: 30 };
  return p;
}

export const EXAMPLES = [
  { id: 'galley', name: 'Galley kitchen', description: 'Two parallel runs in a narrow room, tall fridge and oven at one end.', build: galley },
  { id: 'l-shape', name: 'L-shaped kitchen', description: 'Corner layout with the sink under the window and a dining table.', build: lShape },
  { id: 'u-shape', name: 'U-shaped kitchen', description: 'Worktops on three walls with two corner cabinets.', build: uShape },
  { id: 'island', name: 'Kitchen with island', description: 'One long wall of cabinets and a 240 cm island with bar stools.', build: island },
  { id: 'one-wall', name: 'Compact one-wall kitchen', description: 'Everything on one wall, for a small flat, with a round table.', build: oneWall },
];

/** A fresh, editable project built from an example. */
export function createExampleProject(id) {
  const ex = EXAMPLES.find((e) => e.id === id);
  if (!ex) throw new Error(`Unknown example: ${id}`);
  const p = ex.build();
  p.id = uid('proj');
  return p;
}

/** Draw a small top-down plan of a project onto a canvas. */
export function drawThumbnail(canvas, project) {
  const dpr = window.devicePixelRatio || 1;
  const cw = canvas.clientWidth || canvas.width; const ch = canvas.clientHeight || canvas.height;
  canvas.width = cw * dpr; canvas.height = ch * dpr;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  const pts = project.room.points;
  const xs = pts.map((q) => q.x); const ys = pts.map((q) => q.y);
  const minX = Math.min(...xs); const minY = Math.min(...ys);
  const w = Math.max(...xs) - minX; const h = Math.max(...ys) - minY;
  const pad = 8;
  const s = Math.min((cw - pad * 2) / w, (ch - pad * 2) / h);
  const ox = (cw - w * s) / 2 - minX * s; const oy = (ch - h * s) / 2 - minY * s;
  ctx.fillStyle = project.room.floorColor;
  ctx.strokeStyle = '#555';
  ctx.lineWidth = 2;
  ctx.beginPath();
  pts.forEach((q, i) => (i ? ctx.lineTo(ox + q.x * s, oy + q.y * s) : ctx.moveTo(ox + q.x * s, oy + q.y * s)));
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // Floor-standing objects first, then wall cabinets lighter on top.
  const items = [...project.items].sort((a, b) => (a.elevation > 100) - (b.elevation > 100));
  for (const it of items) {
    const c = catalogEntry(it.type);
    ctx.save();
    ctx.translate(ox + it.x * s, oy + it.y * s);
    ctx.rotate((it.rotation * Math.PI) / 180);
    if (c?.opening) {
      ctx.fillStyle = '#fff';
      ctx.fillRect((-it.w / 2) * s, (-it.d / 2) * s, it.w * s, it.d * s);
    } else {
      const high = it.elevation > 100;
      ctx.globalAlpha = high ? 0.35 : 0.9;
      ctx.fillStyle = c?.category === 'furniture' || c?.category === 'island' ? '#8a6a4a' : '#f7f7f5';
      ctx.strokeStyle = '#666';
      ctx.lineWidth = 0.75;
      ctx.fillRect((-it.w / 2) * s, (-it.d / 2) * s, it.w * s, it.d * s);
      ctx.strokeRect((-it.w / 2) * s, (-it.d / 2) * s, it.w * s, it.d * s);
    }
    ctx.restore();
  }
}
