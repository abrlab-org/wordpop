// crazygames.js — CrazyGames HTML5 SDK v3 adapter.
//
// SDK surface (per https://docs.crazygames.com/sdk/):
//   await window.CrazyGames.SDK.init()
//   SDK.game.loadingStart() / loadingStop()
//   SDK.game.gameplayStart() / gameplayStop()
//   SDK.game.happytime()                        -- site confetti, use sparingly
//   SDK.game.settings.muteAudio                 -- boolean; overrides in-game audio
//   SDK.game.addSettingsChangeListener(fn)      -- fires when settings change
//   SDK.data.getItem(k) / setItem(k, v)         -- synced across the user's devices
//   SDK.ad.requestAd("midgame"|"rewarded", { adStarted, adFinished, adError })
//
// Progress uses the Data Module (not raw localStorage) so it syncs with the
// player's CrazyGames account, which their submission flow asks about directly.

import { localStore } from "./storage.js";

const KEY = "wordpop_save";

export function detect() {
  return typeof window !== "undefined" && !!window.CrazyGames?.SDK;
}

export function create() {
  const sdk = window.CrazyGames.SDK;

  // Wrap the callback-based ad API in a Promise. Resolves true only when the ad
  // actually finished (that's what gates a reward); resolves false on any error
  // or missing fill, so the game never gets stuck waiting on an ad.
  function requestAd(type) {
    return new Promise((resolve) => {
      let settled = false;
      const done = (ok) => { if (!settled) { settled = true; resolve(ok); } };
      try {
        sdk.ad.requestAd(type, {
          adStarted: () => {},
          adFinished: () => done(true),
          adError: () => done(false),
        });
      } catch { done(false); }
      // Safety net: never hang the game if no callback ever fires.
      setTimeout(() => done(false), 45000);
    });
  }

  return {
    name: "crazygames",
    supportsRewarded: true,

    async init() {
      try { await sdk.init(); } catch { /* continue anyway */ }
      try { sdk.game?.loadingStart?.(); } catch {}
    },

    firstFrameReady() {},
    ready() { try { sdk.game?.loadingStop?.(); } catch {} },

    gameplayStart() { try { sdk.game?.gameplayStart?.(); } catch {} },
    gameplayStop() { try { sdk.game?.gameplayStop?.(); } catch {} },

    // Fire the site's celebration effect on a genuine milestone (level-up only).
    happytime() { try { sdk.game?.happytime?.(); } catch {} },

    async commercialBreak() { await requestAd("midgame"); },
    async rewardedBreak() { return await requestAd("rewarded"); },

    // Data Module keeps progress synced to the CrazyGames account; fall back to
    // local storage if it's unavailable (e.g. the game embedded on another site).
    async saveProgress(obj) {
      const json = JSON.stringify(obj || {});
      try {
        if (sdk.data?.setItem) { sdk.data.setItem(KEY, json); return; }
      } catch {}
      await localStore.save(obj);
    },
    async loadProgress() {
      try {
        if (sdk.data?.getItem) {
          const raw = sdk.data.getItem(KEY);
          if (raw) return JSON.parse(raw);
          return null;
        }
      } catch {}
      return await localStore.load();
    },

    // CrazyGames' muteAudio setting must take priority over in-game audio.
    isAudioEnabled() {
      try { return !sdk.game?.settings?.muteAudio; } catch { return true; }
    },
    onAudioChange(cb) {
      try {
        const listener = (settings) => cb(!settings?.muteAudio);
        sdk.game?.addSettingsChangeListener?.(listener);
        return () => { try { sdk.game?.removeSettingsChangeListener?.(listener); } catch {} };
      } catch { return () => {}; }
    },

    onPause() { return () => {}; },
    onResume() { return () => {}; },
  };
}
