import { renderAdSlot } from './ads.js';
import { CATALOG, CATEGORIES, catalogEntry, matchesSearch } from './catalog.js';
import { h, numberField, fmt } from './dom.js';
import { DRAG_MIME, formatLen } from './editor2d.js';
import { area, dist, perimeter } from './geometry.js';
import { PRESETS, createItem, roomProblems } from './model.js';
import { normalizeAngle, snapItemToWalls } from './snapping.js';

const PRESET_LABELS = { rectangle: 'Rectangle', lshape: 'L-shape', alcove: 'With alcove', angled: 'Angled corner' };

/** Room settings tab. */
export function renderRoomPanel(root, store, editor) {
  const p = store.project;
  const room = p.room;
  let presetKey = 'rectangle';
  let pw = 400;
  let pd = 300;
  const problems = roomProblems(room.points);

  root.replaceChildren(
    h('section', {},
      h('h3', {}, 'Room shape'),
      h('div', { class: 'preset-grid' },
        Object.entries(PRESET_LABELS).map(([key, label]) => h('button', {
          class: key === 'rectangle' ? 'preset active' : 'preset', dataset: { preset: key },
          onclick: (e) => {
            presetKey = key;
            root.querySelectorAll('.preset').forEach((b) => b.classList.toggle('active', b === e.currentTarget));
          },
        }, presetIcon(key), label)),
      ),
      h('div', { class: 'row' },
        numberField('Width', pw, (v) => { pw = v; }, { min: 100, max: 3000 }),
        numberField('Depth', pd, (v) => { pd = v; }, { min: 100, max: 3000 }),
      ),
      h('button', {
        class: 'primary wide',
        onclick: () => {
          store.change((proj) => {
            proj.room.points = PRESETS[presetKey](pw, pd);
            proj.items = [];
            proj.viewer = { x: pw / 2, y: pd - 60, heading: 0 };
          });
          editor.fit();
        },
      }, 'Apply shape (clears objects)'),
    ),
    h('section', {},
      h('h3', {}, 'Walls'),
      h('div', { class: 'row' },
        numberField('Height', room.wallHeight, (v) => store.change((pr) => { pr.room.wallHeight = v; }), { min: 150, max: 600, key: 'wallHeight' }),
        numberField('Thickness', room.wallThickness, (v) => store.change((pr) => { pr.room.wallThickness = v; }), { min: 2, max: 80, key: 'wallThickness' }),
      ),
      h('div', { class: 'row' },
        colorField('Wall colour', room.wallColor, (v) => store.change((pr) => { pr.room.wallColor = v; })),
        colorField('Floor colour', room.floorColor, (v) => store.change((pr) => { pr.room.floorColor = v; })),
      ),
    ),
    h('section', {},
      h('h3', {}, 'Summary'),
      h('dl', { class: 'stats' },
        h('dt', {}, 'Floor area'), h('dd', {}, `${(area(room.points) / 10000).toFixed(2)} m²`),
        h('dt', {}, 'Perimeter'), h('dd', {}, formatLen(perimeter(room.points))),
        h('dt', {}, 'Corners'), h('dd', {}, String(room.points.length)),
        h('dt', {}, 'Objects'), h('dd', {}, String(p.items.length)),
      ),
      problems.map((msg) => h('p', { class: 'warning' }, msg)),
    ),
    h('section', { class: 'help' },
      h('h3', {}, 'Editing the plan'),
      h('ul', {},
        h('li', {}, 'Drag a corner to move it, drag a wall to push it in or out.'),
        h('li', {}, 'Double-click a wall to add a corner, double-click a corner to remove it.'),
        h('li', {}, 'Click a wall or corner to type exact sizes.'),
        h('li', {}, 'Drag the orange dot to move where you stand in walk mode.'),
        h('li', {}, 'Scroll to zoom, drag empty space to pan. Hold Alt to turn snapping off.'),
      ),
    ),
  );
}

/** The object library tab: search, brand filter, collapsible categories, click or drag to add. */
export function renderLibraryPanel(root, editor) {
  const search = h('input', { type: 'search', placeholder: 'Search, e.g. "METOD 60" or "drawers"', class: 'search' });
  const list = h('div', { class: 'library' });
  const SOURCES = [['all', 'All'], ['ikea', 'IKEA'], ['basic', 'Basic']];
  let source = load('k3d.lib.source', 'all');
  const open = new Set(JSON.parse(load('k3d.lib.open', '["opening","base"]')));
  const chips = h('div', { class: 'lib-chips', role: 'radiogroup', 'aria-label': 'Brand' });
  const drawChips = () => chips.replaceChildren(...SOURCES.map(([id, label]) => h('button', {
    class: `chip${source === id ? ' active' : ''}`, role: 'radio', 'aria-checked': String(source === id),
    onclick: () => { source = id; save('k3d.lib.source', id); drawChips(); draw(); },
  }, label)));

  const draw = () => {
    const words = search.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const pool = CATALOG.filter((c) => (source === 'all' || (source === 'ikea') === (c.brand === 'IKEA'))
      && matchesSearch(c, words));
    list.replaceChildren(...CATEGORIES.map((cat) => {
      const entries = pool.filter((c) => c.category === cat.id);
      if (!entries.length) return null;
      const details = h('details', { class: 'lib-cat' },
        h('summary', {}, h('span', {}, cat.name), h('span', { class: 'lib-count' }, String(entries.length))),
        h('div', { class: 'lib-grid' }, entries.map((c) => h('button', {
          class: 'lib-item', draggable: 'true', title: `${c.name}: ${c.w} × ${c.d} × ${c.h} cm. Click to add or drag onto the plan.`,
          ondragstart: (e) => { e.dataTransfer.setData(DRAG_MIME, c.type); e.dataTransfer.effectAllowed = 'copy'; },
          onclick: () => editor.addItem(c.type),
        }, libIcon(c), h('span', { class: 'lib-name' }, c.name), h('span', { class: 'lib-size' }, `${c.w}×${c.d}×${c.h}`)))),
      );
      // While searching, show every match; otherwise remember which groups are open.
      details.open = words.length > 0 || open.has(cat.id);
      details.addEventListener('toggle', () => {
        if (words.length) return;
        if (details.open) open.add(cat.id); else open.delete(cat.id);
        save('k3d.lib.open', JSON.stringify([...open]));
      });
      return details;
    }).filter(Boolean));
    if (!list.children.length) list.append(h('p', { class: 'muted' }, 'No objects match your search.'));
  };
  search.addEventListener('input', draw);
  root.replaceChildren(
    h('p', { class: 'muted small' }, 'Click an object to add it to the plan, or drag it to a spot. Objects near a wall snap against it and line up with their neighbours. Doors and windows snap into the wall.'),
    search, chips, list, renderAdSlot(),
  );
  drawChips();
  draw();
}

function load(key, fallback) {
  try { return localStorage.getItem(key) ?? fallback; } catch { return fallback; }
}
function save(key, value) {
  try { localStorage.setItem(key, value); } catch { /* storage unavailable */ }
}

/** Properties of the selected wall, corner or object. */
export function renderSelectionPanel(root, store, editor) {
  const sel = store.selection;
  const p = store.project;
  const pts = p.room.points;
  root.hidden = !sel;
  if (!sel) { root.replaceChildren(); return; }

  if (sel.kind === 'wall' && pts[sel.index]) {
    const i = sel.index;
    const j = (i + 1) % pts.length;
    const len = dist(pts[i], pts[j]);
    root.replaceChildren(
      header(`Wall ${i + 1}`, () => store.select(null)),
      numberField('Length', len, (v) => store.change((pr) => {
        const a = pr.room.points[i];
        const b = pr.room.points[j];
        const l = dist(a, b) || 1;
        pr.room.points[j] = { x: round1(a.x + ((b.x - a.x) / l) * v), y: round1(a.y + ((b.y - a.y) / l) * v) };
      }), { min: 10, max: 5000, key: 'length' }),
      h('p', { class: 'muted small' }, 'Changing the length moves the wall\'s end corner, so the next wall adjusts.'),
      h('div', { class: 'actions' },
        h('button', { onclick: () => editor.splitWall(i) }, 'Add corner in the middle'),
      ),
    );
  } else if (sel.kind === 'vertex' && pts[sel.index]) {
    const i = sel.index;
    root.replaceChildren(
      header(`Corner ${i + 1}`, () => store.select(null)),
      h('div', { class: 'row' },
        numberField('X', pts[i].x, (v) => store.change((pr) => { pr.room.points[i].x = v; }), { key: 'x' }),
        numberField('Y', pts[i].y, (v) => store.change((pr) => { pr.room.points[i].y = v; }), { key: 'y' }),
      ),
      h('div', { class: 'actions' },
        h('button', { class: 'danger', disabled: pts.length <= 3, onclick: () => editor.removeVertex(i) }, 'Remove corner'),
      ),
    );
  } else if (sel.kind === 'item') {
    const it = store.selectedItem();
    if (!it) { root.hidden = true; return; }
    const entry = catalogEntry(it.type);
    const set = (key) => (v) => store.change((pr) => {
      const t = pr.items.find((x) => x.id === it.id);
      if (t) t[key] = key === 'rotation' ? normalizeAngle(v) : v;
    });
    root.replaceChildren(
      header(entry?.name ?? it.type, () => store.select(null)),
      h('div', { class: 'row three' },
        numberField('Width', it.w, set('w'), { min: 1, max: 1000, key: 'w' }),
        numberField('Depth', it.d, set('d'), { min: 1, max: 1000, key: 'd' }),
        numberField('Height', it.h, set('h'), { min: 1, max: 600, key: 'h' }),
      ),
      h('div', { class: 'row' },
        numberField('Off floor', it.elevation, set('elevation'), { min: 0, max: 500, key: 'elevation' }),
        numberField('Rotation', it.rotation, set('rotation'), { step: 15, unit: '°', key: 'rotation' }),
      ),
      h('div', { class: 'row' },
        numberField('X', it.x, set('x'), { key: 'x' }),
        numberField('Y', it.y, set('y'), { key: 'y' }),
      ),
      colorField('Colour', it.color, set('color')),
      h('div', { class: 'actions' },
        h('button', { onclick: () => rotateSelected(store, 90), title: 'R' }, 'Rotate 90°'),
        h('button', { onclick: () => duplicateSelected(store), title: 'Ctrl+D' }, 'Duplicate'),
        h('button', { class: 'danger', onclick: () => deleteSelected(store, editor), title: 'Delete' }, 'Delete'),
      ),
    );
  }
}

/** Refresh values in an already rendered panel without stealing focus from an input. */
export function syncFields(root, values) {
  for (const input of root.querySelectorAll('input[data-key]')) {
    if (document.activeElement === input) continue;
    const v = values[input.dataset.key];
    if (v !== undefined) input.value = fmt(v);
  }
}

export function selectionValues(store) {
  const sel = store.selection;
  const pts = store.project.room.points;
  if (!sel) return {};
  if (sel.kind === 'wall' && pts[sel.index]) return { length: dist(pts[sel.index], pts[(sel.index + 1) % pts.length]) };
  if (sel.kind === 'vertex' && pts[sel.index]) return { ...pts[sel.index] };
  if (sel.kind === 'item') return { ...(store.selectedItem() ?? {}) };
  return {};
}

export function rotateSelected(store, deg) {
  const it = store.selectedItem();
  if (!it) return;
  store.change((pr) => {
    const t = pr.items.find((x) => x.id === it.id);
    t.rotation = normalizeAngle(t.rotation + deg);
  });
}

export function duplicateSelected(store) {
  const it = store.selectedItem();
  if (!it) return;
  const copy = { ...createItem(it.type, it.x, it.y, it.rotation), w: it.w, d: it.d, h: it.h, elevation: it.elevation, color: it.color };
  const r = (it.rotation * Math.PI) / 180;
  copy.x = it.x + Math.cos(r) * it.w;
  copy.y = it.y + Math.sin(r) * it.w;
  const s = snapItemToWalls(copy, store.project.room.points, store.project.items, 25, store.project.room.wallThickness);
  if (s) Object.assign(copy, s);
  store.change((pr) => { pr.items.push(copy); });
  store.select({ kind: 'item', id: copy.id });
}

export function deleteSelected(store, editor) {
  const sel = store.selection;
  if (sel?.kind === 'item') {
    store.change((pr) => { pr.items = pr.items.filter((x) => x.id !== sel.id); });
    store.select(null);
  } else if (sel?.kind === 'vertex') {
    editor.removeVertex(sel.index);
  }
}

function header(title, onClose) {
  return h('div', { class: 'sel-header' }, h('h3', {}, title), h('button', { class: 'icon', title: 'Close', onclick: onClose }, '×'));
}

function colorField(label, value, onCommit) {
  const input = h('input', { type: 'color', value, onchange: () => onCommit(input.value) });
  return h('label', { class: 'field color' }, h('span', {}, label), input);
}

function round1(v) { return Math.round(v * 10) / 10; }

function presetIcon(key) {
  const pts = PRESETS[key](100, 80);
  const minY = Math.min(...pts.map((p) => p.y));
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${p.x * 0.3 + 3},${(p.y - minY) * 0.3 + 3}`).join(' ') + 'Z';
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 36 36');
  svg.setAttribute('class', 'preset-icon');
  svg.innerHTML = `<path d="${d}" />`;
  return svg;
}

function libIcon(c) {
  const el = h('span', { class: `lib-icon style-${c.style}${(c.elevation ?? 0) >= 100 ? ' raised' : ''}${c.opening ? ' opening' : ''}` });
  const ratio = c.d / c.w;
  el.style.setProperty('--w', `${Math.min(28, 28 / Math.max(ratio, 1))}px`);
  el.style.setProperty('--d', `${Math.min(28, 28 * ratio)}px`);
  el.style.setProperty('--c', c.color);
  return el;
}
