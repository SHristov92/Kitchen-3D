import { dist, inwardNormal, toItemLocal } from './geometry.js';

/**
 * Pull an object against the nearest wall: its back goes flush to the wall and its
 * front faces into the room. Then line it up edge-to-edge with neighbours on that wall.
 * Returns a new { x, y, rotation } or null when no wall is close enough.
 */
export function snapItemToWalls(item, points, items = [], threshold = 25) {
  let best = null;
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    const len = dist(a, b);
    if (len < 1) continue;
    const dir = { x: (b.x - a.x) / len, y: (b.y - a.y) / len };
    const n = inwardNormal(points, i);
    const rel = { x: item.x - a.x, y: item.y - a.y };
    const along = rel.x * dir.x + rel.y * dir.y;
    const off = rel.x * n.x + rel.y * n.y; // distance from the wall into the room
    if (along < -item.w / 2 || along > len + item.w / 2) continue;
    // Use the item's depth as seen from this wall.
    const gap = Math.abs(off - item.d / 2);
    if (off < -item.d / 2 || gap > threshold) continue;
    if (!best || gap < best.gap) best = { gap, a, dir, n, along, len };
  }
  if (!best) return null;
  const { a, dir, n, len } = best;
  let along = best.along;
  if (len >= item.w) along = Math.min(Math.max(along, item.w / 2), len - item.w / 2);
  const rotation = normalizeAngle((Math.atan2(-n.x, n.y) * 180) / Math.PI);
  const snapped = {
    x: a.x + dir.x * along + n.x * (item.d / 2),
    y: a.y + dir.y * along + n.y * (item.d / 2),
    rotation,
  };
  return snapToNeighbours({ ...item, ...snapped }, items);
}

/** Close small gaps between objects that stand in the same line. */
export function snapToNeighbours(item, items, threshold = 8) {
  let shift = null;
  for (const other of items) {
    if (other.id === item.id) continue;
    if (Math.abs(normalizeAngle(other.rotation - item.rotation)) > 0.5) continue;
    // Only snap objects in the same layer (floor units vs wall units).
    const overlapV = item.elevation < other.elevation + other.h && other.elevation < item.elevation + item.h;
    if (!overlapV) continue;
    const o = toItemLocal(item, other);
    if (Math.abs(o.y - (other.d - item.d) / 2) > 5 && Math.abs(o.y) > 5) continue;
    const touch = (item.w + other.w) / 2;
    for (const gap of [o.x - touch, o.x + touch]) {
      if (Math.abs(gap) < threshold && (!shift || Math.abs(gap) < Math.abs(shift))) shift = gap;
    }
  }
  if (shift === null) return { x: item.x, y: item.y, rotation: item.rotation };
  const r = (item.rotation * Math.PI) / 180;
  return { x: item.x + Math.cos(r) * shift, y: item.y + Math.sin(r) * shift, rotation: item.rotation };
}

export function normalizeAngle(deg) {
  let a = ((deg % 360) + 360) % 360;
  if (a > 180) a -= 360;
  if (Math.abs(a) < 1e-9) a = 0;
  return Math.round(a * 1000) / 1000;
}
