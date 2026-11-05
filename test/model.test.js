import { describe, expect, it } from 'vitest';
import { CATALOG } from '../src/catalog.js';
import { createItem, createProject, normalizeProject, toExportFile } from '../src/model.js';
import { snapItemToWalls } from '../src/snapping.js';

describe('project files', () => {
  it('round-trips through the export format', () => {
    const p = createProject('Test');
    p.items.push(createItem('base-60', 30, 30));
    const back = normalizeProject(JSON.parse(JSON.stringify(toExportFile(p))));
    expect(back).toEqual(p);
  });

  it('accepts a bare project object and fills defaults', () => {
    const p = normalizeProject({ room: { points: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 0, y: 100 }] } });
    expect(p.room.wallHeight).toBe(260);
    expect(p.items).toEqual([]);
    expect(p.name).toBe('Imported kitchen');
  });

  it('rejects files without a usable room', () => {
    expect(() => normalizeProject(null)).toThrow();
    expect(() => normalizeProject({ room: { points: [{ x: 0, y: 0 }] } })).toThrow(/3 corners/);
    expect(() => normalizeProject({ room: { points: [{ x: 0 }, { x: 1, y: 1 }, { x: 2, y: 0 }] } })).toThrow(/invalid/);
    expect(() => normalizeProject({ schemaVersion: 99, room: { points: [] } })).toThrow(/newer/);
  });

  it('drops objects of unknown types', () => {
    const p = createProject();
    p.items.push({ type: 'spaceship', x: 0, y: 0 });
    p.items.push(createItem('fridge', 50, 50));
    expect(normalizeProject(p).items.map((i) => i.type)).toEqual(['fridge']);
  });

  it('has unique catalog types', () => {
    expect(new Set(CATALOG.map((c) => c.type)).size).toBe(CATALOG.length);
  });
});

describe('wall snapping', () => {
  const room = [{ x: 0, y: 0 }, { x: 400, y: 0 }, { x: 400, y: 300 }, { x: 0, y: 300 }];

  it('puts an object flush against the nearest wall, facing the room', () => {
    const it = createItem('base-60', 100, 45, 33);
    expect(snapItemToWalls(it, room)).toEqual({ x: 100, y: 30, rotation: 0 });
    const right = createItem('base-60', 360, 150);
    expect(snapItemToWalls(right, room)).toEqual({ x: 370, y: 150, rotation: 90 });
  });

  it('keeps objects inside the wall ends', () => {
    const it = createItem('base-60', 10, 30);
    expect(snapItemToWalls(it, room).x).toBe(30);
  });

  it('closes small gaps to a neighbour', () => {
    const a = createItem('base-60', 30, 30);
    const b = createItem('base-60', 95, 35);
    const s = snapItemToWalls(b, room, [a, b]);
    expect(s.x).toBeCloseTo(90);
    expect(s.y).toBeCloseTo(30);
  });

  it('ignores objects far from any wall', () => {
    expect(snapItemToWalls(createItem('table-4', 200, 150), room)).toBeNull();
  });
});
