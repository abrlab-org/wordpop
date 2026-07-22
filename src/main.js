// main.js — wires modules together and owns the round lifecycle.

import { WORDS } from "./words.js";
import { createWordBank, bandForLevel } from "./wordbank.js";
import { createState } from "./state.js";
import { createAudio } from "./audio.js";
import { createSdk } from "./sdk.js";
import { createUI } from "./ui.js";

const sdk = createSdk();
const audio = createAudio();
const state = createState();
const bank = createWordBank(WORDS);

let current = null;      // current round: {word, emoji, theme, tiles}
let locked = false;      // true during the correct-answer transition

const ui = createUI({
  onPlay: startGame,
  onTileTap: handleTileTap,
  onSlotTap: handleSlotTap,
  onHintLetter: handleHintLetter,
  onSay: () => current && audio.speak(current.word),
  onMute: toggleMute,
  onLevelNext: () => { ui.hideLevelUp(); nextRound(); },
});

// Level = difficulty band offset so the first band reads as "Level 1".
const levelFromCleared = (cleared) => bandForLevel(cleared) - 2;

// ---------- Boot ----------
async function boot() {
  sdk.firstFrameReady();

  // Fake-but-quick loading fill so the platform load signal feels intentional.
  let p = 0;
  const iv = setInterval(() => {
    p = Math.min(1, p + 0.2);
    ui.setLoadingProgress(p);
    if (p >= 1) clearInterval(iv);
  }, 80);

  // Restore saved progress (score/cleared/best) if any.
  const saved = await sdk.loadProgress();
  state.load(saved);

  // Sync mute with the platform audio setting + subscribe to changes.
  audio.setMuted(!sdk.isAudioEnabled());
  ui.setMuteIcon(audio.isMuted());
  sdk.onAudioChange((enabled) => {
    audio.setMuted(!enabled);
    ui.setMuteIcon(audio.isMuted());
  });

  setTimeout(() => {
    ui.showScreen("start");
    sdk.ready();
  }, 500);
}

function startGame() {
  audio.unlock(); // unlock WebAudio on the user gesture
  ui.showScreen("game");
  nextRound();
}

// ---------- Round lifecycle ----------
function nextRound() {
  locked = false;
  state.startWord();
  current = bank.next(state.raw.cleared);
  ui.renderRound(current);
  ui.updateHUD(state.snapshot());
  // Coach-mark on the very first word only.
  if (state.raw.cleared === 0) ui.showTutorial();
}

function handleTileTap(tileId) {
  if (locked) return;
  if (ui.isTutorialOpen()) ui.hideTutorial();
  const slot = ui.firstEmptySlot();
  if (slot === -1) return; // all slots full
  ui.placeTile(tileId, slot);
  audio.playTap();
  if (ui.isFull()) checkAnswer();
}

function handleSlotTap(index) {
  if (locked) return;
  ui.returnTile(index);
}

function checkAnswer() {
  if (current && ui.currentAnswer() === current.word) {
    onCorrect();
  } else {
    onWrong();
  }
}

function onCorrect() {
  locked = true;
  const beforeLevel = levelFromCleared(state.raw.cleared);
  state.correct();
  const afterLevel = levelFromCleared(state.raw.cleared);
  ui.updateHUD(state.snapshot());
  audio.playCorrect();
  ui.celebrate();
  sdk.saveProgress(state.snapshot());
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
  ui.updateHUD(state.snapshot());
  // Forgiving: clear the wrong attempt so the learner retries.
  setTimeout(() => {
    for (let i = current.word.length - 1; i >= 0; i--) ui.returnTile(i);
  }, 450);
}

// Reveal the correct next letter by auto-placing a matching unused tile.
function handleHintLetter() {
  if (locked || !current) return;
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
  ui.updateHUD(state.snapshot());
  if (ui.isFull()) checkAnswer();
}

function toggleMute() {
  audio.setMuted(!audio.isMuted());
  ui.setMuteIcon(audio.isMuted());
  if (!audio.isMuted()) audio.playTap();
}

// Pause/resume: cancel any speech when the platform pauses.
sdk.onPause(() => { try { window.speechSynthesis?.cancel(); } catch {} });

boot();
