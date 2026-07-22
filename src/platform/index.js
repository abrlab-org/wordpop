// platform/index.js — picks the right host adapter at runtime and exposes one
// stable interface to the game. Whichever SDK script index.html loaded, the
// matching adapter is detected by its global; if none is present (local dev,
// itch.io, a plain web host) the standalone adapter takes over and every call
// degrades to a safe no-op.
//
// Unified interface:
//   name, supportsRewarded
//   init(), firstFrameReady(), ready()
//   gameplayStart(), gameplayStop()
//   commercialBreak() -> Promise<void>
//   rewardedBreak()   -> Promise<boolean>   (true = reward earned)
//   saveProgress(obj) / loadProgress()      -> Promise
//   isAudioEnabled(), onAudioChange(cb), onPause(cb), onResume(cb)

import { localStore } from "./storage.js";
import * as youtube from "./youtube.js";
import * as poki from "./poki.js";
import * as crazygames from "./crazygames.js";

function createStandalone() {
  return {
    name: "standalone",
    supportsRewarded: false,
    async init() {},
    firstFrameReady() {},
    ready() {},
    gameplayStart() {},
    gameplayStop() {},
    async commercialBreak() {},
    async rewardedBreak() { return false; },
    saveProgress: localStore.save,
    loadProgress: localStore.load,
    isAudioEnabled() { return true; },
    onAudioChange() { return () => {}; },
    onPause() { return () => {}; },
    onResume() { return () => {}; },
  };
}

const ADAPTERS = [youtube, poki, crazygames];

// Host SDKs are third-party code loaded from a CDN. Outside their own site (or
// behind an adblocker) a call can reject or simply never settle, so every async
// hand-off is raced against a timer. A stalled SDK must never freeze the game.
function withTimeout(promise, ms, fallback) {
  return Promise.race([
    Promise.resolve(promise).catch(() => fallback),
    new Promise((resolve) => setTimeout(() => resolve(fallback), ms)),
  ]);
}

const TIMEOUTS = { init: 5000, commercial: 60000, rewarded: 90000, storage: 5000 };

function guard(p) {
  return {
    ...p,
    init: () => withTimeout(p.init(), TIMEOUTS.init, undefined),
    commercialBreak: () => withTimeout(p.commercialBreak(), TIMEOUTS.commercial, undefined),
    rewardedBreak: () => withTimeout(p.rewardedBreak(), TIMEOUTS.rewarded, false),
    saveProgress: (obj) => withTimeout(p.saveProgress(obj), TIMEOUTS.storage, undefined),
    loadProgress: () => withTimeout(p.loadProgress(), TIMEOUTS.storage, null),
  };
}

export function createPlatform() {
  for (const adapter of ADAPTERS) {
    try {
      if (adapter.detect()) return guard(adapter.create());
    } catch { /* try the next one */ }
  }
  return guard(createStandalone());
}
