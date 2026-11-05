// Share a project as a link. The site has no server, so the whole project travels in the
// URL fragment (#share=...): it is trimmed to what is needed, deflate-compressed and
// base64url-encoded. The fragment is never sent to the web server.

import { catalogEntry } from './catalog.js';
import { normalizeProject } from './model.js';

const PARAM = 'share';
const FORMAT = 1;

const round = (n) => Math.round(n * 10) / 10;

/** Strip ids, timestamps and values that equal the catalog defaults. */
export function compactProject(project) {
  const items = project.items.map((it) => {
    const c = catalogEntry(it.type) ?? {};
    const o = { t: it.type, x: round(it.x), y: round(it.y) };
    if (it.rotation) o.r = round(it.rotation);
    if (it.w !== c.w) o.w = round(it.w);
    if (it.d !== c.d) o.d = round(it.d);
    if (it.h !== c.h) o.h = round(it.h);
    if (it.elevation !== (c.elevation ?? 0)) o.e = round(it.elevation);
    if (it.color !== c.color) o.c = it.color;
    return o;
  });
  const r = project.room;
  return {
    v: FORMAT,
    n: project.name,
    p: r.points.flatMap((pt) => [round(pt.x), round(pt.y)]),
    wh: r.wallHeight,
    wt: r.wallThickness,
    fc: r.floorColor,
    wc: r.wallColor,
    i: items,
    vw: [round(project.viewer.x), round(project.viewer.y), round(project.viewer.heading)],
  };
}

/** Turn the compact form back into a full project (with fresh ids). */
export function expandProject(c) {
  if (!c || typeof c !== 'object' || !Array.isArray(c.p)) throw new Error('The link does not contain a project.');
  if (typeof c.v === 'number' && c.v > FORMAT) throw new Error('This link was made with a newer version of the app.');
  const points = [];
  for (let k = 0; k + 1 < c.p.length; k += 2) points.push({ x: c.p[k], y: c.p[k + 1] });
  const items = (Array.isArray(c.i) ? c.i : []).map((o) => {
    const cat = catalogEntry(o?.t);
    if (!cat) return null;
    return {
      type: o.t, x: o.x, y: o.y, rotation: o.r ?? 0,
      w: o.w ?? cat.w, d: o.d ?? cat.d, h: o.h ?? cat.h,
      elevation: o.e ?? cat.elevation ?? 0,
      color: o.c ?? cat.color,
    };
  }).filter(Boolean);
  const vw = Array.isArray(c.vw) ? c.vw : [];
  return normalizeProject({
    name: c.n,
    room: { points, wallHeight: c.wh, wallThickness: c.wt, floorColor: c.fc, wallColor: c.wc },
    items,
    viewer: { x: vw[0], y: vw[1], heading: vw[2] },
  });
}

async function pipe(bytes, stream) {
  const out = new Blob([bytes]).stream().pipeThrough(stream);
  return new Uint8Array(await new Response(out).arrayBuffer());
}

function toBase64Url(bytes) {
  let bin = '';
  for (let k = 0; k < bytes.length; k += 0x8000) bin += String.fromCharCode(...bytes.subarray(k, k + 0x8000));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(text) {
  const b64 = text.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
  return Uint8Array.from(bin, (ch) => ch.charCodeAt(0));
}

export async function encodeProject(project) {
  const json = new TextEncoder().encode(JSON.stringify(compactProject(project)));
  return toBase64Url(await pipe(json, new CompressionStream('deflate-raw')));
}

export async function decodeProject(token) {
  let json;
  try {
    json = new TextDecoder().decode(await pipe(fromBase64Url(token), new DecompressionStream('deflate-raw')));
  } catch {
    throw new Error('The link is incomplete or damaged. Ask for it to be sent again.');
  }
  return expandProject(JSON.parse(json));
}

/** Full link to the current page that opens this project. */
export async function shareUrl(project, base = location.href) {
  const url = new URL(base);
  url.search = '';
  url.hash = `${PARAM}=${await encodeProject(project)}`;
  return url.toString();
}

/** The share token in a location hash, or null. */
export function shareTokenFromHash(hash = location.hash) {
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  return params.get(PARAM);
}
