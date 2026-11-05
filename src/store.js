// Holds the open project, undo/redo history and change notifications.

const MAX_HISTORY = 100;

export class Store {
  constructor(project) {
    this.project = project;
    this.selection = null; // { kind: 'vertex'|'wall'|'item', index?, id? }
    this.past = [];
    this.future = [];
    this.listeners = new Set();
  }

  subscribe(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  emit(reason) {
    for (const fn of this.listeners) fn(reason);
  }

  /** Replace the whole project (open / import / new). Clears history. */
  load(project) {
    this.project = project;
    this.selection = null;
    this.past = [];
    this.future = [];
    this.emit('load');
  }

  /** Remember the current state so the next edits can be undone as one step. */
  checkpoint() {
    this.past.push(JSON.stringify(this.project));
    if (this.past.length > MAX_HISTORY) this.past.shift();
    this.future = [];
  }

  /** Apply an edit. Pass { record: false } while dragging (after a checkpoint). */
  change(mutator, { record = true } = {}) {
    if (record) this.checkpoint();
    mutator(this.project);
    this.project.updatedAt = new Date().toISOString();
    this.emit('change');
  }

  /** The walker position changes constantly; it is saved but not part of undo. */
  setViewer(viewer) {
    Object.assign(this.project.viewer, viewer);
    this.emit('viewer');
  }

  select(selection) {
    this.selection = selection;
    this.emit('select');
  }

  undo() {
    if (!this.past.length) return;
    this.future.push(JSON.stringify(this.project));
    this.project = JSON.parse(this.past.pop());
    this.selection = null;
    this.emit('change');
  }

  redo() {
    if (!this.future.length) return;
    this.past.push(JSON.stringify(this.project));
    this.project = JSON.parse(this.future.pop());
    this.selection = null;
    this.emit('change');
  }

  get canUndo() { return this.past.length > 0; }
  get canRedo() { return this.future.length > 0; }

  selectedItem() {
    if (this.selection?.kind !== 'item') return null;
    return this.project.items.find((it) => it.id === this.selection.id) ?? null;
  }
}
