// crazygames.js — CrazyGames HTML5 SDK v3 adapter.
//
// SDK surface (per https://docs.crazygames.com/sdk/):
//   await window.CrazyGames.SDK.init()
//   window.CrazyGames.SDK.game.gameplayStart() / gameplayStop()
//   window.CrazyGames.SDK.ad.requestAd("midgame"|"rewarded",
//       { adStarted, adFinished, adError })   -- callback based, not a Promise
//
// CrazyGames provides no cloud save on the free tier, so progress uses local storage.

import { localStore } from "./storage.js";

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
    },

    firstFrameReady() {},
    ready() { try { sdk.game?.loadingStop?.(); } catch {} },

    gameplayStart() { try { sdk.game?.gameplayStart?.(); } catch {} },
    gameplayStop() { try { sdk.game?.gameplayStop?.(); } catch {} },

    async commercialBreak() { await requestAd("midgame"); },
    async rewardedBreak() { return await requestAd("rewarded"); },

    saveProgress: localStore.save,
    loadProgress: localStore.load,

    isAudioEnabled() { return true; },
    onAudioChange() { return () => {}; },
    onPause() { return () => {}; },
    onResume() { return () => {}; },
  };
}
