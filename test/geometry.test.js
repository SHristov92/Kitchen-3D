import { describe, expect, it } from 'vitest';
import {
  area, centroid, inwardNormal, isSelfIntersecting, itemCorners, offsetPolygon, pointInItem, pointInPolygon,
} from '../src/geometry.js';
import { PRESETS } from '../src/model.js';

const rect = PRESETS.rectangle(400, 300);

describe('geometry', () => {
  it('computes area and centroid of a rectangle', () => {
    expect(area(rect)).toBe(120000);
    expect(centroid(rect)).toEqual({ x: 200, y: 150 });
  });

  it('computes the area of an L-shape', () => {
    // 450x400 minus the 202.5x180 notch, using the rounded preset corners.
    const l = PRESETS.lshape(450, 400);
    expect(area(l)).toBe(450 * 400 - (450 - 248) * (400 - 220));
  });

  it('finds inward normals regardless of winding', () => {
    expect(inwardNormal(rect, 0)).toEqual({ x: -0, y: 1 });
    const reversed = [...rect].reverse();
    // reversed[0] -> reversed[1] runs along the bottom wall (y = 300); inside is -y
    const n = inwardNormal(reversed, 0);
    expect(n.x).toBeCloseTo(0);
    expect(n.y).toBeCloseTo(-1);
  });

  it('offsets outward with mitred corners', () => {
    const out = offsetPolygon(rect, 10);
    expect(out[0].x).toBeCloseTo(-10);
    expect(out[0].y).toBeCloseTo(-10);
    expect(out[2].x).toBeCloseTo(410);
    expect(out[2].y).toBeCloseTo(310);
  });

  it('tests points against polygons', () => {
    const l = PRESETS.lshape(450, 400);
    expect(pointInPolygon({ x: 50, y: 50 }, l)).toBe(true);
    expect(pointInPolygon({ x: 400, y: 380 }, l)).toBe(false);
  });

  it('detects crossing walls', () => {
    expect(isSelfIntersecting(rect)).toBe(false);
    expect(isSelfIntersecting([{ x: 0, y: 0 }, { x: 100, y: 100 }, { x: 100, y: 0 }, { x: 0, y: 100 }])).toBe(true);
  });

  it('handles rotated items', () => {
    const it = { x: 100, y: 100, w: 60, d: 40, rotation: 90 };
    const c = itemCorners(it);
    expect(c[0].x).toBeCloseTo(120);
    expect(c[0].y).toBeCloseTo(70);
    expect(pointInItem(it, { x: 100, y: 125 })).toBe(true);
    expect(pointInItem(it, { x: 125, y: 100 })).toBe(false);
  });
});
