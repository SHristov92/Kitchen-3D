import { describe, expect, it } from 'vitest';
import { catalogEntry } from '../src/catalog.js';
import { EXAMPLES, createExampleProject } from '../src/examples.js';
import { normalizeProject, roomProblems } from '../src/model.js';

const footprint = (it) => {
  const r = ((it.rotation % 180) + 180) % 180;
  const [w, d] = r === 90 ? [it.d, it.w] : [it.w, it.d];
  return { x0: it.x - w / 2, x1: it.x + w / 2, y0: it.y - d / 2, y1: it.y + d / 2 };
};
const overlap = (a, b) => Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0) > 0.5 && Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0) > 0.5;
// Floor-standing objects and wall-hung ones are checked separately (cabinets hang above worktops).
const layer = (it) => (catalogEntry(it.type).opening ? 'opening' : it.elevation >= 140 ? 'high' : 'floor');

describe('example kitchens', () => {
  for (const ex of EXAMPLES) {
    it(`${ex.name} is a valid project with objects inside the room`, () => {
      const p = createExampleProject(ex.id);
      expect(normalizeProject(structuredClone(p))).toEqual(p);
      expect(roomProblems(p.room.points)).toEqual([]);
      expect(p.items.length).toBeGreaterThan(5);
      const xs = p.room.points.map((q) => q.x); const ys = p.room.points.map((q) => q.y);
      const solid = p.items.filter((it) => layer(it) !== 'opening');
      for (const it of solid) {
        const f = footprint(it);
        expect(f.x0, it.type).toBeGreaterThanOrEqual(Math.min(...xs) - 0.01);
        expect(f.x1, it.type).toBeLessThanOrEqual(Math.max(...xs) + 0.01);
        expect(f.y0, it.type).toBeGreaterThanOrEqual(Math.min(...ys) - 0.01);
        expect(f.y1, it.type).toBeLessThanOrEqual(Math.max(...ys) + 0.01);
      }
      for (let i = 0; i < solid.length; i++) {
        for (let j = i + 1; j < solid.length; j++) {
          const a = solid[i]; const b = solid[j];
          const tallA = a.h + a.elevation > 140 && a.elevation < 140; const tallB = b.h + b.elevation > 140 && b.elevation < 140;
          if (layer(a) !== layer(b) && !tallA && !tallB) continue;
          expect(overlap(footprint(a), footprint(b)), `${a.type} overlaps ${b.type}`).toBe(false);
        }
      }
    });
  }

  it('gives every copy its own id', () => {
    expect(createExampleProject('galley').id).not.toBe(createExampleProject('galley').id);
  });
});
