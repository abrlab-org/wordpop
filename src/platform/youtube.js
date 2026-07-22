// youtube.js — YouTube Playables (`ytgame`) adapter.
//
// SDK surface (per YouTube Playables docs):
//   ytgame.game.firstFrameReady()            -> void
//   ytgame.game.gameReady()                  -> void
//   ytgame.game.loadData()                   -> Promise<string>
//   ytgame.game.saveData(data: string)       -> Promise<void>
//   ytgame.system.isAudioEnabled()           -> boolean
//   ytgame.system.onAudioEnabledChange(cb)   -> unsubscribe fn
//   ytgame.system.onPause(cb) / onResume(cb) -> unsubscribe fn
//
// Playables has no ad inventory for developers, so the ad breaks are no-ops.

export function detect() {
  return typeof window !== "undefined" && !!window.ytgame?.game;
}

export function create() {
  const yt = window.ytgame;

  return {
    name: "youtube",
    supportsRewarded: false,

    async init() { /* SDK is ready as soon as the script has loaded */ },

    firstFrameReady() { try { yt.game.firstFrameReady?.(); } catch {} },
    ready() { try { yt.game.gameReady?.(); } catch {} },

    // Playables has no gameplay-event or ad API.
    gameplayStart() {},
    gameplayStop() {},
    async commercialBreak() {},
    async rewardedBreak() { return false; },

    async saveProgress(obj) {
      try { await yt.game.saveData?.(JSON.stringify(obj || {})); } catch {}
    },
    async loadProgress() {
      try {
        const raw = await yt.game.loadData?.();
        return raw ? JSON.parse(raw) : null;
      } catch { return null; }
    },

    isAudioEnabled() {
      try { return yt.system?.isAudioEnabled ? !!yt.system.isAudioEnabled() : true; }
      catch { return true; }
    },
    onAudioChange(cb) {
      try { return yt.system?.onAudioEnabledChange?.(cb) || (() => {}); }
      catch { return () => {}; }
    },
    onPause(cb) { try { return yt.system?.onPause?.(cb) || (() => {}); } catch { return () => {}; } },
    onResume(cb) { try { return yt.system?.onResume?.(cb) || (() => {}); } catch { return () => {}; } },
  };
}
