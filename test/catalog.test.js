import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { CATALOG, CATEGORIES, catalogEntry, matchesSearch } from '../src/catalog.js';
import { wallOpenings } from '../src/geometry.js';
import { createItem, createProject } from '../src/model.js';
import { snapItemToWalls } from '../src/snapping.js';
import { BUILDERS, buildItem } from '../src/view3d.js';

const fakeView = (project) => ({
  project,
  material: (color, opts = {}) => new THREE.MeshStandardMaterial({ color, ...opts }),
});

describe('catalog', () => {
  it('has at least 100 IKEA items', () => {
    expect(CATALOG.filter((c) => c.brand === 'IKEA').length).toBeGreaterThanOrEqual(100);
  });

  it('gives every entry a known category, positive size and a 3D builder', () => {
    const cats = new Set(CATEGORIES.map((c) => c.id));
    for (const c of CATALOG) {
      expect(cats.has(c.category), c.type).toBe(true);
      expect(c.w > 0 && c.d > 0 && c.h > 0, c.type).toBe(true);
      expect(BUILDERS[c.style], `${c.type} style ${c.style}`).toBeTypeOf('function');
    }
  });

  it('builds a 3D model for every entry', () => {
    const p = createProject();
    for (const c of CATALOG) {
      const g = buildItem(createItem(c.type, 0, 0), fakeView(p));
      expect(g.children.length, c.type).toBeGreaterThan(0);
    }
  });

  it('searches by series and size', () => {
    const hits = CATALOG.filter((c) => matchesSearch(c, ['metod', '60']));
    expect(hits.length).toBeGreaterThan(5);
    expect(hits.every((c) => c.w === 60 || /\b60\b/.test(c.name))).toBe(true);
    expect(CATALOG.filter((c) => matchesSearch(c, ['door'])).length).toBeGreaterThan(5);
  });
});

describe('doors and windows', () => {
  const room = [{ x: 0, y: 0 }, { x: 400, y: 0 }, { x: 400, y: 300 }, { x: 0, y: 300 }];

  it('snap into the wall thickness', () => {
    const door = createItem('door-80', 200, 30);
    const s = snapItemToWalls(door, room, [], 60, 12);
    expect(s).toMatchObject({ x: 200, y: -6, rotation: 0, d: 12 });
  });

  it('cut an opening in the wall they sit in', () => {
    const door = { ...createItem('door-80', 200, -6), d: 12 };
    const win = { ...createItem('window-120', 406, 150, 90), d: 12 };
    const base = createItem('base-60', 100, 30);
    const ops = wallOpenings(room, [door, win, base], (it) => catalogEntry(it.type)?.opening);
    expect(ops[0]).toEqual([{ from: 160, to: 240, bottom: 0, top: 205 }]);
    expect(ops[1]).toEqual([{ from: 90, to: 210, bottom: 90, top: 230 }]);
    expect(ops[2]).toEqual([]);
  });
});
