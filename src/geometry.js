// Pure 2D geometry helpers. Plan coordinates are in centimetres, x to the right, y down.

export function signedArea(points) {
  let a = 0;
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    const q = points[(i + 1) % points.length];
    a += p.x * q.y - q.x * p.y;
  }
  return a / 2;
}

export function area(points) {
  return Math.abs(signedArea(points));
}

export function perimeter(points) {
  let s = 0;
  for (let i = 0; i < points.length; i++) s += dist(points[i], points[(i + 1) % points.length]);
  return s;
}

export function dist(a, b) {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

export function centroid(points) {
  const A = signedArea(points);
  if (Math.abs(A) < 1e-9) {
    const s = points.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x: 0, y: 0 });
    return { x: s.x / points.length, y: s.y / points.length };
  }
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    const q = points[(i + 1) % points.length];
    const f = p.x * q.y - q.x * p.y;
    cx += (p.x + q.x) * f;
    cy += (p.y + q.y) * f;
  }
  return { x: cx / (6 * A), y: cy / (6 * A) };
}

export function bounds(points) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of points) {
    minX = Math.min(minX, p.x); minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y);
  }
  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
}

export function pointInPolygon(pt, points) {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const a = points[i];
    const b = points[j];
    if ((a.y > pt.y) !== (b.y > pt.y) && pt.x < ((b.x - a.x) * (pt.y - a.y)) / (b.y - a.y) + a.x) {
      inside = !inside;
    }
  }
  return inside;
}

/** Closest point on segment ab to p, with t in [0,1] and the distance. */
export function projectOnSegment(p, a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  let t = len2 === 0 ? 0 : ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  const point = { x: a.x + dx * t, y: a.y + dy * t };
  return { t, point, distance: dist(p, point) };
}

/** Unit normal of edge i (points[i] -> points[i+1]) that points into the room. */
export function inwardNormal(points, i) {
  const a = points[i];
  const b = points[(i + 1) % points.length];
  const len = dist(a, b) || 1;
  const dx = (b.x - a.x) / len;
  const dy = (b.y - a.y) / len;
  // With positive signed area the interior lies at (-dy, dx).
  const s = signedArea(points) >= 0 ? 1 : -1;
  return { x: -dy * s, y: dx * s };
}

/**
 * Offset a polygon outward by `d` with mitred corners (used for wall outer faces).
 * Very sharp corners are clamped so the mitre never spikes far away.
 */
export function offsetPolygon(points, d) {
  const n = points.length;
  const normals = [];
  for (let i = 0; i < n; i++) {
    const inN = inwardNormal(points, i);
    normals.push({ x: -inN.x, y: -inN.y });
  }
  const out = [];
  for (let i = 0; i < n; i++) {
    const n1 = normals[(i - 1 + n) % n];
    const n2 = normals[i];
    const dot = n1.x * n2.x + n1.y * n2.y;
    let k = 1 + dot;
    let mx = n1.x + n2.x;
    let my = n1.y + n2.y;
    if (k < 1e-6) {
      // Edges fold back on themselves; just push along one normal.
      out.push({ x: points[i].x + n2.x * d, y: points[i].y + n2.y * d });
      continue;
    }
    let scale = d / k;
    const len = Math.hypot(mx, my) * scale;
    const maxLen = d * 4;
    if (len > maxLen) scale *= maxLen / len;
    out.push({ x: points[i].x + mx * scale, y: points[i].y + my * scale });
  }
  return out;
}

function segmentsIntersect(p1, p2, p3, p4) {
  const d = (a, b, c) => (c.x - a.x) * (b.y - a.y) - (b.x - a.x) * (c.y - a.y);
  const d1 = d(p3, p4, p1);
  const d2 = d(p3, p4, p2);
  const d3 = d(p1, p2, p3);
  const d4 = d(p1, p2, p4);
  return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
}

export function isSelfIntersecting(points) {
  const n = points.length;
  for (let i = 0; i < n; i++) {
    const a1 = points[i];
    const a2 = points[(i + 1) % n];
    for (let j = i + 1; j < n; j++) {
      if (Math.abs(i - j) <= 1 || (i === 0 && j === n - 1)) continue;
      if (segmentsIntersect(a1, a2, points[j], points[(j + 1) % n])) return true;
    }
  }
  return false;
}

/** Corners of a rotated rectangle item (centre x,y, width w along local x, depth d along local y). */
export function itemCorners(item) {
  const r = (item.rotation * Math.PI) / 180;
  const c = Math.cos(r);
  const s = Math.sin(r);
  const hw = item.w / 2;
  const hd = item.d / 2;
  return [
    [-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd],
  ].map(([lx, ly]) => ({ x: item.x + lx * c - ly * s, y: item.y + lx * s + ly * c }));
}

/** Point in item-local coordinates. */
export function toItemLocal(item, p) {
  const r = (item.rotation * Math.PI) / 180;
  const dx = p.x - item.x;
  const dy = p.y - item.y;
  return { x: dx * Math.cos(r) + dy * Math.sin(r), y: -dx * Math.sin(r) + dy * Math.cos(r) };
}

export function pointInItem(item, p, margin = 0) {
  const l = toItemLocal(item, p);
  return Math.abs(l.x) <= item.w / 2 + margin && Math.abs(l.y) <= item.d / 2 + margin;
}
