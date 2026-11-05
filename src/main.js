import './style.css';
import { h } from './dom.js';
import { Editor2D } from './editor2d.js';
import { createItem, createProject, normalizeProject, toExportFile, uid } from './model.js';
import {
  deleteSelected, duplicateSelected, renderLibraryPanel, renderRoomPanel, renderSelectionPanel,
  rotateSelected, selectionValues, syncFields,
} from './panels.js';
import { Store } from './store.js';
import * as storage from './storage.js';
import { decodeProject, shareTokenFromHash, shareUrl } from './share.js';
import { View3D } from './view3d.js';

const $ = (id) => document.getElementById(id);

/** A furnished example so the first visit shows something to walk around in. */
function sampleProject() {
  const p = createProject('Sample kitchen');
  p.room.points = [{ x: 0, y: 0 }, { x: 420, y: 0 }, { x: 420, y: 360 }, { x: 0, y: 360 }];
  let x = 0;
  const run = ['fridge', 'base-60', 'sink-80', 'dishwasher', 'hob-base', 'drawers-60'];
  const centres = {};
  for (const type of run) {
    const it = createItem(type, 0, 0, 0);
    it.x = x + it.w / 2;
    it.y = it.d / 2;
    centres[type] = it.x;
    x += it.w;
    p.items.push(it);
  }
  for (const [type, over] of [['wall-60', 'base-60'], ['wall-80', 'sink-80'], ['hood', 'hob-base'], ['wall-60', 'drawers-60']]) {
    const it = createItem(type, centres[over], 0, 0);
    it.y = it.d / 2;
    p.items.push(it);
  }
  // Tall units along the left wall, facing into the room.
  const tall = createItem('oven-tower', 30, 0, -90);
  tall.y = 70 + 30 + 20;
  p.items.push(tall);
  p.items.push(createItem('table-4', 270, 250, 0));
  p.items.push(createItem('chair', 240, 198, 0));
  p.items.push(createItem('chair', 300, 198, 0));
  p.items.push(createItem('chair', 240, 302, 180));
  p.items.push(createItem('chair', 300, 302, 180));
  p.viewer = { x: 130, y: 300, heading: 15 };
  return p;
}

async function boot() {
  let project = null;
  try {
    const last = storage.getLastProjectId();
    if (last) project = await storage.getProject(last);
    if (!project) {
      const list = await storage.listProjects();
      if (list.length) project = await storage.getProject(list[0].id);
    }
  } catch (err) {
    console.error(err);
    toast('Browser storage is not available. Your work will not be saved; use Export to keep it.');
  }
  project = project ? normalizeProject(project) : sampleProject();

  // A shared link (#share=...) opens as a new copy; the visitor's own projects stay untouched.
  let sharedName = null;
  const token = shareTokenFromHash();
  if (token) {
    try {
      project = await decodeProject(token);
      sharedName = project.name;
    } catch (err) {
      setTimeout(() => toast(`Could not open the shared link. ${err.message}`), 0);
    }
    history.replaceState(null, '', location.pathname + location.search);
  }

  const store = new Store(project);
  const editor = new Editor2D($('plan'), store);
  const view = new View3D($('view3d'), store);
  window.kitchen = { store, editor, view }; // handy for debugging in the console
  if (view.softwareGL) {
    setTimeout(() => toast('Your browser is drawing 3D without the graphics card, so it will be slow. Turn on hardware acceleration in the browser settings.'), 1500);
  }
  if (new URLSearchParams(location.search).has('debug')) {
    import('./debug.js').then((m) => m.startDebugOverlay({ view, editor }));
  }

  // ---------- autosave ----------
  let saveTimer = null;
  const status = $('save-status');
  const scheduleSave = () => {
    status.textContent = 'Saving…';
    clearTimeout(saveTimer);
    saveTimer = setTimeout(async () => {
      try {
        await storage.saveProject(store.project);
        storage.setLastProjectId(store.project.id);
        status.textContent = 'Saved in browser';
      } catch (err) {
        console.error(err);
        status.textContent = 'Not saved';
      }
    }, 500);
  };
  scheduleSave();
  if (sharedName) toast(`Opened a shared copy of "${sharedName}". It is saved in your projects.`);

  // ---------- panels ----------
  const roomTab = $('tab-room');
  const selRoot = $('selection');
  let selSignature = '';
  const refreshPanels = (reason) => {
    const sig = JSON.stringify(store.selection);
    if (reason === 'select' || reason === 'load' || sig !== selSignature || !selRoot.children.length) {
      renderSelectionPanel(selRoot, store, editor);
      selSignature = sig;
    } else {
      syncFields(selRoot, selectionValues(store));
    }
    if (reason !== 'select' && !roomTab.contains(document.activeElement)) renderRoomPanel(roomTab, store, editor);
    const nameInput = $('project-name');
    if (document.activeElement !== nameInput) nameInput.value = store.project.name;
    $('btn-undo').disabled = !store.canUndo;
    $('btn-redo').disabled = !store.canRedo;
  };
  store.subscribe((reason) => {
    if (reason === 'change' || reason === 'viewer' || reason === 'load') scheduleSave();
    if (reason === 'change' && store.selection && !Object.keys(selectionValues(store)).length) store.selection = null;
    if (reason !== 'viewer') refreshPanels(reason);
  });
  renderRoomPanel(roomTab, store, editor);
  renderLibraryPanel($('tab-library'), editor);
  refreshPanels('load');

  document.querySelectorAll('.tab').forEach((tab) => tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t === tab));
    $('tab-room').hidden = tab.dataset.tab !== 'room';
    $('tab-library').hidden = tab.dataset.tab !== 'library';
  }));

  $('project-name').addEventListener('change', (e) => {
    const name = e.target.value.trim() || 'Untitled kitchen';
    store.change((p) => { p.name = name; });
  });

  // ---------- toolbar ----------
  $('btn-undo').onclick = () => store.undo();
  $('btn-redo').onclick = () => store.redo();
  $('btn-fit').onclick = () => editor.fit();
  $('btn-reset-cam').onclick = () => (view.mode === 'orbit' ? view.frameOrbit() : view.setMode('walk'));

  const setMode = (mode) => {
    view.setMode(mode);
    $('mode-orbit').classList.toggle('active', mode === 'orbit');
    $('mode-walk').classList.toggle('active', mode === 'walk');
    $('walk-help').hidden = mode !== 'walk';
    $('orbit-help').hidden = mode !== 'orbit';
  };
  $('mode-orbit').onclick = () => setMode('orbit');
  $('mode-walk').onclick = () => setMode('walk');

  const openProject = async (p) => {
    clearTimeout(saveTimer);
    await storage.saveProject(store.project).catch(() => {});
    store.load(normalizeProject(p));
    storage.setLastProjectId(store.project.id);
    scheduleSave();
  };

  $('btn-new').onclick = async () => {
    await openProject(createProject('New kitchen'));
    toast('Started a new project. Pick a room shape or drag the corners.');
  };

  $('btn-export').onclick = () => {
    const blob = new Blob([JSON.stringify(toExportFile(store.project), null, 2)], { type: 'application/json' });
    const a = h('a', { href: URL.createObjectURL(blob), download: `${slug(store.project.name)}.kitchen.json` });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  $('btn-import').onclick = () => $('file-input').click();
  $('file-input').addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const p = normalizeProject(JSON.parse(await file.text()));
      // Imports become a new project so they never overwrite one already in the browser.
      p.id = uid('proj');
      await openProject(p);
      toast(`Imported "${p.name}".`);
    } catch (err) {
      toast(`Could not import this file. ${err instanceof SyntaxError ? 'It is not valid JSON.' : err.message}`);
    }
  });

  // ---------- share ----------
  const shareDialog = $('share-dialog');
  shareDialog.querySelector('[data-close]').onclick = () => shareDialog.close();
  shareDialog.addEventListener('click', (e) => { if (e.target === shareDialog) shareDialog.close(); });
  const shareProject = async (p) => {
    let url;
    try {
      url = await shareUrl(p);
    } catch (err) {
      console.error(err);
      toast('This browser cannot make share links. Use Export to send the project as a file.');
      return;
    }
    $('share-name').textContent = `"${p.name}"`;
    $('share-url').value = url;
    $('share-copy').textContent = 'Copy link';
    $('share-copy').onclick = async () => {
      try {
        await navigator.clipboard.writeText(url);
      } catch {
        $('share-url').select();
        document.execCommand?.('copy');
      }
      $('share-copy').textContent = 'Copied';
    };
    const native = $('share-native');
    native.hidden = !navigator.share;
    native.onclick = () => navigator.share({ title: `${p.name} · Kitchen 3D`, url }).catch(() => {});
    if (!shareDialog.open) shareDialog.showModal();
    $('share-url').focus();
    $('share-url').select();
  };
  $('btn-share').onclick = () => shareProject(store.project);
  // A share link pasted into the address bar of an open tab only changes the hash.
  window.addEventListener('hashchange', () => { if (shareTokenFromHash()) location.reload(); });
  $('share-url').addEventListener('focus', (e) => e.target.select());

  // ---------- projects dialog ----------
  const dialog = $('projects-dialog');
  dialog.querySelector('[data-close]').onclick = () => dialog.close();
  dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.close(); });
  const renderProjectList = async () => {
    await storage.saveProject(store.project).catch(() => {});
    const list = await storage.listProjects().catch(() => []);
    $('project-list').replaceChildren(...list.map((meta) => h('li', { class: meta.id === store.project.id ? 'current' : '' },
      h('div', { class: 'pl-info' },
        h('strong', {}, meta.name),
        h('span', { class: 'muted small' }, `${meta.itemCount} objects · edited ${new Date(meta.updatedAt).toLocaleString()}`),
      ),
      h('div', { class: 'pl-actions' },
        meta.id === store.project.id ? h('span', { class: 'badge' }, 'Open') : h('button', {
          class: 'primary',
          onclick: async () => { await openProject(await storage.getProject(meta.id)); dialog.close(); },
        }, 'Open'),
        h('button', {
          onclick: async () => {
            const src = await storage.getProject(meta.id);
            const copy = { ...structuredClone(src), id: uid('proj'), name: `${src.name} (copy)`, updatedAt: new Date().toISOString() };
            await storage.saveProject(copy);
            renderProjectList();
          },
        }, 'Duplicate'),
        h('button', {
          onclick: async () => {
            const src = meta.id === store.project.id ? store.project : await storage.getProject(meta.id);
            dialog.close();
            shareProject(normalizeProject(src));
          },
        }, 'Share'),
        h('button', {
          class: 'danger',
          onclick: async () => {
            if (!confirm(`Delete "${meta.name}"? This cannot be undone.`)) return;
            await storage.deleteProject(meta.id);
            if (meta.id === store.project.id) {
              const rest = await storage.listProjects();
              store.load(rest.length ? normalizeProject(await storage.getProject(rest[0].id)) : createProject('New kitchen'));
              scheduleSave();
            }
            renderProjectList();
          },
        }, 'Delete'),
      ),
    )));
  };
  $('btn-projects').onclick = async () => { await renderProjectList(); dialog.showModal(); };

  // ---------- keyboard ----------
  window.addEventListener('keydown', (e) => {
    const typing = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName);
    if (typing || dialog.open || shareDialog.open) return;
    const mod = e.ctrlKey || e.metaKey;
    const k = e.key.toLowerCase();
    if (mod && k === 'z') { e.preventDefault(); if (e.shiftKey) store.redo(); else store.undo(); return; }
    if (mod && k === 'y') { e.preventDefault(); store.redo(); return; }
    if (mod && k === 'd') { e.preventDefault(); duplicateSelected(store); return; }
    if (view.mode === 'walk') return; // movement keys belong to the walker
    if (k === 'delete' || k === 'backspace') { e.preventDefault(); deleteSelected(store, editor); }
    else if (k === 'r') rotateSelected(store, e.shiftKey ? -90 : 90);
    else if (k === 'escape') store.select(null);
    else if (k === 'f') editor.fit();
    else if (k.startsWith('arrow') && store.selectedItem()) {
      e.preventDefault();
      const step = e.shiftKey ? 10 : 1;
      const id = store.selection.id;
      store.change((p) => {
        const it = p.items.find((x) => x.id === id);
        if (k === 'arrowleft') it.x -= step;
        if (k === 'arrowright') it.x += step;
        if (k === 'arrowup') it.y -= step;
        if (k === 'arrowdown') it.y += step;
      });
    }
  });

  // ---------- splitter ----------
  const splitter = $('splitter');
  const workspace = document.querySelector('.workspace');
  splitter.addEventListener('pointerdown', (e) => {
    splitter.setPointerCapture(e.pointerId);
    const move = (ev) => {
      const r = workspace.getBoundingClientRect();
      const sidebar = document.querySelector('.sidebar').getBoundingClientRect().width;
      const frac = (ev.clientX - r.left - sidebar) / (r.width - sidebar);
      workspace.style.setProperty('--plan-frac', String(Math.min(0.8, Math.max(0.2, frac))));
    };
    const up = () => { splitter.removeEventListener('pointermove', move); splitter.removeEventListener('pointerup', up); };
    splitter.addEventListener('pointermove', move);
    splitter.addEventListener('pointerup', up);
  });

  window.addEventListener('beforeunload', () => { storage.saveProject(store.project).catch(() => {}); });
}

function slug(name) {
  return (name || 'kitchen').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'kitchen';
}

let toastTimer;
function toast(msg) {
  const el = $('toast');
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 4500);
}

boot();
