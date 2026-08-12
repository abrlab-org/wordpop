// admob.js — Google AdMob adapter for the Capacitor (Android/iOS) build.
//
// Reached through the Capacitor bridge global rather than an `import`, exactly
// like the portal adapters read window.ytgame / window.PokiSDK. That keeps this
// file dependency-free, so the same source still builds the plain-web bundles
// without dragging a native plugin into them.
//
// Plugin: @capacitor-community/admob (registers as Capacitor.Plugins.AdMob)
//   AdMob.initialize(opts)                 -> Promise<void>
//   AdMob.prepareInterstitial({adId,...})  -> Promise<AdLoadInfo>
//   AdMob.showInterstitial()               -> Promise<void>
//   AdMob.prepareRewardVideoAd({adId,...}) -> Promise<AdLoadInfo>
//   AdMob.showRewardVideoAd()              -> Promise<AdMobRewardItem {type, amount}>

import { localStore } from "./storage.js";

// Google's public test ad units. REPLACE with the real units from the AdMob
// console before shipping — see isTesting() below for why that swap is safe.
const GOOGLE_TEST_PUBLISHER = "ca-app-pub-3940256099942544";

export const AD_UNITS = {
  interstitial: `${GOOGLE_TEST_PUBLISHER}/1033173712`,
  rewarded: `${GOOGLE_TEST_PUBLISHER}/5224354917`,
};

// Derive the testing flag from the ad unit itself instead of a hand-set boolean.
// Getting this pair wrong is the classic AdMob footgun in both directions: ship
// with isTesting stuck on and you serve test ads that earn nothing; develop
// against live units and the self-generated clicks read as invalid traffic,
// which is how accounts get suspended. Tying it to the ID makes both impossible.
const isTesting = (adId) => adId.startsWith(GOOGLE_TEST_PUBLISHER);

export function detect() {
  if (typeof window === "undefined") return false;
  const cap = window.Capacitor;
  return !!(cap?.isNativePlatform?.() && cap.Plugins?.AdMob);
}

export function create() {
  const AdMob = window.Capacitor.Plugins.AdMob;

  return {
    name: "admob",
    supportsRewarded: true,

    async init() {
      try {
        await AdMob.initialize({
          // App is declared 13+, so no child-directed treatment, but cap the
          // content rating so served ads stay appropriate for a teen audience.
          initializeForTesting: isTesting(AD_UNITS.rewarded),
          tagForChildDirectedTreatment: false,
          maxAdContentRating: "Teen",
        });
      } catch { /* never block the game on ad setup */ }
    },

    firstFrameReady() {},
    ready() {},
    gameplayStart() {},
    gameplayStop() {},
    happytime() {},

    async commercialBreak() {
      const adId = AD_UNITS.interstitial;
      try {
        await AdMob.prepareInterstitial({ adId, isTesting: isTesting(adId) });
        await AdMob.showInterstitial();
      } catch { /* no fill, offline, or dismissed — carry on silently */ }
    },

    // Resolves true only when AdMob actually reports a reward. main.js grants
    // the hints either way (see its handleRewardHints comment), but the honest
    // signal still belongs here so the caller can decide.
    async rewardedBreak() {
      const adId = AD_UNITS.rewarded;
      try {
        await AdMob.prepareRewardVideoAd({ adId, isTesting: isTesting(adId) });
        const reward = await AdMob.showRewardVideoAd();
        return !!reward && Number(reward.amount) > 0;
      } catch {
        return false;
      }
    },

    // Native WebView has a normal, persistent localStorage.
    saveProgress: localStore.save,
    loadProgress: localStore.load,

    // No host-level mute on native; the in-game speaker button owns audio.
    isAudioEnabled() { return true; },
    onAudioChange() { return () => {}; },
    onPause() { return () => {}; },
    onResume() { return () => {}; },
  };
}
