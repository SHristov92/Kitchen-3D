// Projects are kept in IndexedDB so they survive reloads and can hold larger plans
// than localStorage allows. Only the id of the last opened project goes to localStorage.

const DB_NAME = 'kitchen-3d';
const STORE = 'projects';
const LAST_KEY = 'kitchen-3d:last-project';

let dbPromise;

function openDb() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbPromise;
}

async function tx(mode, fn) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const result = fn(t.objectStore(STORE));
    t.oncomplete = () => resolve(result?.result ?? result);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
}

export async function listProjects() {
  const all = await tx('readonly', (s) => s.getAll());
  return all
    .map((p) => ({ id: p.id, name: p.name, updatedAt: p.updatedAt, itemCount: p.items?.length ?? 0 }))
    .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
}

export function getProject(id) {
  return tx('readonly', (s) => s.get(id));
}

export function saveProject(project) {
  return tx('readwrite', (s) => s.put(structuredClone(project)));
}

export function deleteProject(id) {
  return tx('readwrite', (s) => s.delete(id));
}

export function getLastProjectId() {
  try { return localStorage.getItem(LAST_KEY); } catch { return null; }
}

export function setLastProjectId(id) {
  try { localStorage.setItem(LAST_KEY, id); } catch { /* storage unavailable */ }
}
