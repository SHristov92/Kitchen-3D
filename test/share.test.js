import { describe, expect, it } from 'vitest';
import { createItem, createProject } from '../src/model.js';
import { decodeProject, encodeProject, shareTokenFromHash, shareUrl } from '../src/share.js';

const strip = (p) => ({ ...p, id: undefined, createdAt: undefined, updatedAt: undefined, items: p.items.map((it) => ({ ...it, id: undefined })) });

describe('share links', () => {
  it('round-trips a project through a link', async () => {
    const p = createProject('Mum’s kitchen ✓');
    p.items.push(createItem('base-60', 30, 30, 90));
    const custom = createItem('wall-60', 100, 20);
    custom.w = 45; custom.color = '#123456'; custom.elevation = 150;
    p.items.push(custom);
    const url = await shareUrl(p, 'https://example.com/app/?debug#old');
    expect(url.startsWith('https://example.com/app/#share=')).toBe(true);
    const back = await decodeProject(shareTokenFromHash(new URL(url).hash));
    expect(strip(back)).toEqual(strip(p));
    expect(back.id).not.toBe(p.id);
  });

  it('keeps a furnished kitchen link short', async () => {
    const p = createProject('Big');
    for (let k = 0; k < 40; k++) p.items.push(createItem(k % 2 ? 'base-60' : 'wall-60', k * 60 + 30, 30));
    expect((await encodeProject(p)).length).toBeLessThan(1500);
  });

  it('reports a damaged link', async () => {
    await expect(decodeProject('not-a-real-token')).rejects.toThrow(/damaged/);
    expect(shareTokenFromHash('')).toBeNull();
  });
});
