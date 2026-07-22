// storage.js — localStorage-backed progress store with an in-memory fallback,
// used by platforms that don't provide their own cloud save.

const KEY = "wordpop_save";
let memory = null;

export const localStore = {
  async save(obj) {
    const json = JSON.stringify(obj || {});
    memory = json;
    try { window.localStorage?.setItem(KEY, json); } catch { /* private mode */ }
  },
  async load() {
    let raw = null;
    try { raw = window.localStorage?.getItem(KEY); } catch { /* private mode */ }
    if (raw == null) raw = memory;
    try { return raw ? JSON.parse(raw) : null; } catch { return null; }
  },
};
