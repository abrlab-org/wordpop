// poki.js — Poki SDK adapter.
//
// SDK surface (per https://sdk.poki.com/html5):
//   PokiSDK.init()                              -> Promise<void>
//   PokiSDK.gameLoadingFinished()               -> void
//   PokiSDK.gameplayStart() / gameplayStop()    -> void
//   PokiSDK.commercialBreak(onStart?)           -> Promise<void>
//   PokiSDK.rewardedBreak({size, onStart})      -> Promise<boolean>
//
// Poki provides no cloud save, so progress uses local storage.

import { localStore } from "./storage.js";

export function detect() {
  return typeof window !== "undefined" && !!window.PokiSDK;
}

export function create() {
  const p = window.PokiSDK;

  return {
    name: "poki",
    supportsRewarded: true,

    async init() {
      // Poki asks that the game still load if init fails.
      try { await p.init(); } catch { /* continue anyway */ }
    },

    firstFrameReady() {},
    ready() { try { p.gameLoadingFinished?.(); } catch {} },

    gameplayStart() { try { p.gameplayStart?.(); } catch {} },
    gameplayStop() { try { p.gameplayStop?.(); } catch {} },
    happytime() { try { p.happyTime?.(1); } catch {} },

    async commercialBreak() {
      try { await p.commercialBreak?.(); } catch { /* never block the game */ }
    },

    async rewardedBreak() {
      try { return (await p.rewardedBreak?.({ size: "medium" })) === true; }
      catch { return false; }
    },

    saveProgress: localStore.save,
    loadProgress: localStore.load,

    // Poki handles ad audio itself; the game owns its own mute button.
    isAudioEnabled() { return true; },
    onAudioChange() { return () => {}; },
    onPause() { return () => {}; },
    onResume() { return () => {}; },
  };
}
