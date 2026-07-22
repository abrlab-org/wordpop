// main.js — wires modules together and owns the round lifecycle.

import { WORDS } from "./words.js";
import { createWordBank, bandForLevel } from "./wordbank.js";
import { createState } from "./state.js";
import { createAudio } from "./audio.js";
import { createPlatform } from "./platform/index.js";
import { createUI } from "./ui.js";

const platform = createPlatform();
const audio = createAudio();
const state = createState();
const bank = createWordBank(WORDS);

let current = null;      // current round: {word, emoji, theme, tiles}
let locked = false;      // true during the correct-answer transition
let adInFlight = false;  // guards against double-triggering an ad

const REWARD_HINTS = 3;

const ui = createUI({
  onPlay: startGame,
  onTileTap: handleTileTap,
  onSlotTap: handleSlotTap,
  onHintLetter: handleHintLetter,
  onSay: () => current && audio.speak(current.word),
  onMute: toggleMute,
  onLevelNext: handleLevelNext,
  onRewardHints: handleRewardHints,
});

// Level = difficulty band offset so the first band reads as "Level 1".
const levelFromCleared = (cleared) => bandForLevel(cleared) - 2;

// ---------- Boot ----------
async function boot() {
  platform.firstFrameReady();

  // Fake-but-quick loading fill so the platform load signal feels intentional.
  let p = 0;
  const iv = setInterval(() => {
    p = Math.min(1, p + 0.2);
    ui.setLoadingProgress(p);
    if (p >= 1) clearInterval(iv);
  }, 80);

  // Portal SDKs (Poki, CrazyGames) must be initialized before anything else.
  await platform.init();

  // Restore saved progress (score/cleared/best) if any.
  const saved = await platform.loadProgress();
  state.load(saved);

  // Sync mute with the platform audio setting + subscribe to changes.
  audio.setMuted(!platform.isAudioEnabled());
  ui.setMuteIcon(audio.isMuted());
  platform.onAudioChange((enabled) => {
    audio.setMuted(!enabled);
    ui.setMuteIcon(audio.isMuted());
  });

  setTimeout(() => {
    ui.showScreen("start");
    platform.ready();
  }, 500);
}

function startGame() {
  audio.unlock(); // unlock WebAudio on the user gesture
  ui.showScreen("game");
  platform.gameplayStart();
  nextRound();
}

// ---------- Ad helpers ----------
// Run an ad break with gameplay stopped and audio muted, then restore both.
// Never lets a failed or missing ad block the game.
async function withAdBreak(run) {
  if (adInFlight) return false;
  adInFlight = true;
  const wasMuted = audio.isMuted();
  platform.gameplayStop();
  audio.setMuted(true);
  try {
    return await run();
  } catch {
    return false;
  } finally {
    audio.setMuted(wasMuted);
    ui.setMuteIcon(audio.isMuted());
    platform.gameplayStart();
    adInFlight = false;
  }
}

// Level-up "Continue" is the natural interstitial slot.
async function handleLevelNext() {
  ui.hideLevelUp();
  await withAdBreak(() => platform.commercialBreak());
  nextRound();
}

// Rewarded ad: watch a video, get hints back.
async function handleRewardHints() {
  if (!platform.supportsRewarded) return;
  const earned = await withAdBreak(() => platform.rewardedBreak());
  if (earned) {
    state.addHints(REWARD_HINTS);
    audio.playCorrect();
  }
  refreshHUD();
}

// ---------- Round lifecycle ----------
function refreshHUD() {
  const snap = state.snapshot();
  ui.updateHUD(snap);
  // Offer the rewarded ad only when hints have run out and the host supports it.
  ui.setRewardVisible(platform.supportsRewarded && snap.hintsLeft <= 0);
}

function nextRound() {
  locked = false;
  state.startWord();
  current = bank.next(state.raw.cleared);
  ui.renderRound(current);
  refreshHUD();
  // Coach-mark on the very first word only.
  if (state.raw.cleared === 0) ui.showTutorial();
}

function handleTileTap(tileId) {
  if (locked || adInFlight) return;
  if (ui.isTutorialOpen()) ui.hideTutorial();
  const slot = ui.firstEmptySlot();
  if (slot === -1) return; // all slots full
  ui.placeTile(tileId, slot);
  audio.playTap();
  if (ui.isFull()) checkAnswer();
}

function handleSlotTap(index) {
  if (locked || adInFlight) return;
  ui.returnTile(index);
}

function checkAnswer() {
  if (current && ui.currentAnswer() === current.word) onCorrect();
  else onWrong();
}

function onCorrect() {
  locked = true;
  const beforeLevel = levelFromCleared(state.raw.cleared);
  state.correct();
  const afterLevel = levelFromCleared(state.raw.cleared);
  refreshHUD();
  audio.playCorrect();
  ui.celebrate();
  platform.saveProgress(state.snapshot());
  const leveledUp = afterLevel > beforeLevel;
  setTimeout(() => {
    if (leveledUp) ui.showLevelUp(afterLevel);
    else nextRound();
  }, 1100);
}

function onWrong() {
  state.wrong();
  audio.playWrong();
  ui.shake();
  refreshHUD();
  // Forgiving: clear the wrong attempt so the learner retries.
  setTimeout(() => {
    for (let i = current.word.length - 1; i >= 0; i--) ui.returnTile(i);
  }, 450);
}

// Reveal the correct next letter by auto-placing a matching unused tile.
function handleHintLetter() {
  if (locked || adInFlight || !current) return;
  const slot = ui.firstEmptySlot();
  if (slot === -1) return;
  if (!state.useHint()) return;

  const needed = current.word[slot];
  // Find an unused tile in the tray with the needed letter.
  const trayTiles = document.querySelectorAll("#tray .tile:not(.used)");
  let chosen = null;
  for (const el of trayTiles) {
    if (el.textContent === needed) { chosen = el; break; }
  }
  if (chosen) {
    ui.placeTile(chosen.dataset.id, slot);
    audio.playTap();
  }
  refreshHUD();
  if (ui.isFull()) checkAnswer();
}

function toggleMute() {
  audio.setMuted(!audio.isMuted());
  ui.setMuteIcon(audio.isMuted());
  if (!audio.isMuted()) audio.playTap();
}

// Pause/resume: cancel any speech when the host pauses the game.
platform.onPause(() => { try { window.speechSynthesis?.cancel(); } catch {} });

boot();
