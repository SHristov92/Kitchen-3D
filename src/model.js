import { catalogEntry } from './catalog.js';
import { isSelfIntersecting } from './geometry.js';

export const SCHEMA_VERSION = 1;
export const FILE_KIND = 'kitchen-3d-project';

export function uid(prefix = 'id') {
  const rnd = globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}_${rnd}`;
}

export const PRESETS = {
  rectangle: (w = 400, d = 300) => [
    { x: 0, y: 0 }, { x: w, y: 0 }, { x: w, y: d }, { x: 0, y: d },
  ],
  lshape: (w = 450, d = 400) => [
    { x: 0, y: 0 }, { x: w, y: 0 }, { x: w, y: Math.round(d * 0.55) },
    { x: Math.round(w * 0.55), y: Math.round(d * 0.55) }, { x: Math.round(w * 0.55), y: d }, { x: 0, y: d },
  ],
  alcove: (w = 450, d = 350) => [
    { x: 0, y: 0 }, { x: Math.round(w * 0.35), y: 0 }, { x: Math.round(w * 0.35), y: -80 },
    { x: Math.round(w * 0.75), y: -80 }, { x: Math.round(w * 0.75), y: 0 }, { x: w, y: 0 },
    { x: w, y: d }, { x: 0, y: d },
  ],
  angled: (w = 450, d = 350) => [
    { x: 0, y: 0 }, { x: Math.round(w * 0.7), y: 0 }, { x: w, y: Math.round(d * 0.35) },
    { x: w, y: d }, { x: 0, y: d },
  ],
};

export function createProject(name = 'My kitchen') {
  const now = new Date().toISOString();
  return {
    schemaVersion: SCHEMA_VERSION,
    id: uid('proj'),
    name,
    createdAt: now,
    updatedAt: now,
    room: {
      points: PRESETS.rectangle(400, 300),
      wallHeight: 260,
      wallThickness: 12,
      floorColor: '#c8b7a0',
      wallColor: '#f4f1ea',
    },
    items: [],
    viewer: { x: 200, y: 220, heading: 180 },
  };
}

export function createItem(type, x, y, rotation = 0) {
  const c = catalogEntry(type);
  if (!c) throw new Error(`Unknown object type: ${type}`);
  return {
    id: uid('item'),
    type,
    x, y, rotation,
    w: c.w, d: c.d, h: c.h,
    elevation: c.elevation ?? 0,
    color: c.color,
  };
}

const num = (v, fallback) => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);
const str = (v, fallback) => (typeof v === 'string' && v.length ? v : fallback);

/**
 * Validate a project from storage or an imported file and fill in defaults.
 * Throws an Error with a readable message when the data cannot be used.
 */
export function normalizeProject(raw) {
  if (!raw || typeof raw !== 'object') throw new Error('The file does not contain a project.');
  const data = raw.kind === FILE_KIND && raw.project ? raw.project : raw;
  if (typeof data.schemaVersion === 'number' && data.schemaVersion > SCHEMA_VERSION) {
    throw new Error('This project was made with a newer version of the app.');
  }
  const room = data.room;
  if (!room || !Array.isArray(room.points) || room.points.length < 3) {
    throw new Error('The project has no valid room shape (needs at least 3 corners).');
  }
  const points = room.points.map((p) => ({ x: num(p?.x, NaN), y: num(p?.y, NaN) }));
  if (points.some((p) => Number.isNaN(p.x) || Number.isNaN(p.y))) {
    throw new Error('The room shape has corners with invalid coordinates.');
  }
  const base = createProject();
  const items = (Array.isArray(data.items) ? data.items : [])
    .filter((it) => it && catalogEntry(it.type))
    .map((it) => {
      const c = catalogEntry(it.type);
      return {
        id: str(it.id, uid('item')),
        type: it.type,
        x: num(it.x, 0), y: num(it.y, 0), rotation: num(it.rotation, 0),
        w: Math.max(1, num(it.w, c.w)), d: Math.max(1, num(it.d, c.d)), h: Math.max(1, num(it.h, c.h)),
        elevation: Math.max(0, num(it.elevation, c.elevation ?? 0)),
        color: str(it.color, c.color),
      };
    });
  return {
    schemaVersion: SCHEMA_VERSION,
    id: str(data.id, uid('proj')),
    name: str(data.name, 'Imported kitchen'),
    createdAt: str(data.createdAt, base.createdAt),
    updatedAt: str(data.updatedAt, base.updatedAt),
    room: {
      points,
      wallHeight: Math.max(150, num(room.wallHeight, base.room.wallHeight)),
      wallThickness: Math.max(1, num(room.wallThickness, base.room.wallThickness)),
      floorColor: str(room.floorColor, base.room.floorColor),
      wallColor: str(room.wallColor, base.room.wallColor),
    },
    items,
    viewer: {
      x: num(data.viewer?.x, base.viewer.x),
      y: num(data.viewer?.y, base.viewer.y),
      heading: num(data.viewer?.heading, base.viewer.heading),
    },
  };
}

export function toExportFile(project) {
  return {
    kind: FILE_KIND,
    exportedAt: new Date().toISOString(),
    project,
  };
}

export function roomProblems(points) {
  const problems = [];
  if (points.length < 3) problems.push('A room needs at least 3 corners.');
  if (isSelfIntersecting(points)) problems.push('Walls cross each other. Move corners so the outline does not overlap.');
  return problems;
}
