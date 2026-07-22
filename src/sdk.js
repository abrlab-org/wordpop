// sdk.js — YouTube Playables (`ytgame`) wrapper.
// Isolates the real SDK behind a small, stable interface. Every method degrades
// to a safe no-op / in-memory fallback when `window.ytgame` is absent, so the
// game runs identically as a plain webpage during development.
//
// Real SDK surface (per YouTube Playables docs):
//   ytgame.game.firstFrameReady()            -> void
//   ytgame.game.gameReady()                  -> void
//   ytgame.game.loadData()                   -> Promise<string>
//   ytgame.game.saveData(data: string)       -> Promise<void>
//   ytgame.system.isAudioEnabled()           -> boolean
//   ytgame.system.onAudioEnabledChange(cb)   -> unsubscribe fn
//   ytgame.system.onPause(cb) / onResume(cb) -> unsubscribe fn

const LS_KEY = "wordpop_save_fallback";

export function createSdk() {
  const yt = typeof window !== "undefined" ? window.ytgame : undefined;
  const present = !!(yt && yt.game);

  return {
    present,

    // Signal the platform that the first frame has rendered.
    firstFrameReady() {
      try { yt?.game?.firstFrameReady?.(); } catch {}
    },

    // Signal the platform that the game is loaded and interactive.
    ready() {
      try { yt?.game?.gameReady?.(); } catch {}
    },

    // Persist progress. Accepts a plain object; serialized to a string.
    async saveProgress(obj) {
      const json = JSON.stringify(obj || {});
      if (present && yt.game.saveData) {
        try { await yt.game.saveData(json); return; } catch {}
      }
      // Fallback: sessionless in-memory unless localStorage exists (dev only).
      try { window.localStorage?.setItem(LS_KEY, json); } catch {}
    },

    // Load progress. Returns a parsed object or null.
    async loadProgress() {
      if (present && yt.game.loadData) {
        try {
          const raw = await yt.game.loadData();
          return raw ? JSON.parse(raw) : null;
        } catch { return null; }
      }
      try {
        const raw = window.localStorage?.getItem(LS_KEY);
        return raw ? JSON.parse(raw) : null;
      } catch { return null; }
    },

    // Current platform audio state (true = audio on). Defaults to on.
    isAudioEnabled() {
      try {
        if (present && yt.system?.isAudioEnabled) return !!yt.system.isAudioEnabled();
      } catch {}
      return true;
    },

    // Subscribe to platform mute toggle. Returns an unsubscribe fn (no-op if absent).
    onAudioChange(cb) {
      try {
        if (present && yt.system?.onAudioEnabledChange) {
          return yt.system.onAudioEnabledChange(cb) || (() => {});
        }
      } catch {}
      return () => {};
    },

    // Subscribe to pause/resume. Returns an unsubscribe fn.
    onPause(cb) {
      try { return (present && yt.system?.onPause?.(cb)) || (() => {}); } catch { return () => {}; }
    },
    onResume(cb) {
      try { return (present && yt.system?.onResume?.(cb)) || (() => {}); } catch { return () => {}; }
    },
  };
}
