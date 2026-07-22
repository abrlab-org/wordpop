// ui.js — all DOM rendering + animations. Holds no game rules; emits user
// intents to `handlers` and exposes methods for main.js to drive.
//
// handlers: { onTileTap(tileId), onSlotTap(slotIndex), onHintLetter, onSay, onMute }

export function createUI(handlers) {
  const $ = (id) => document.getElementById(id);

  const els = {
    screens: {
      loading: $("loading"),
      start: $("start"),
      game: $("game"),
    },
    loadingFill: $("loading-fill"),
    playBtn: $("play-btn"),
    themeLabel: $("theme-label"),
    score: $("score"),
    streak: $("streak"),
    progressFill: $("progress-fill"),
    picture: $("picture"),
    slots: $("slots"),
    tray: $("tray"),
    hintLetter: $("hint-letter"),
    hintsLeft: $("hints-left"),
    hintSay: $("hint-say"),
    hintReward: $("hint-reward"),
    muteBtn: $("mute-btn"),
    celebrate: $("celebrate"),
    tutorial: $("tutorial"),
    tutorialOk: $("tutorial-ok"),
    levelup: $("levelup"),
    levelupNum: $("levelup-num"),
    levelupSub: $("levelup-sub"),
    levelupNext: $("levelup-next"),
  };

  // Tracks the current round's tiles: [{id, letter, used}]
  let tiles = [];
  // slotFills[i] = tileId placed in slot i, or null
  let slotFills = [];

  function showScreen(name) {
    Object.values(els.screens).forEach((s) => s.classList.remove("is-active"));
    els.screens[name].classList.add("is-active");
  }

  function setLoadingProgress(frac) {
    els.loadingFill.style.width = `${Math.round(frac * 100)}%`;
  }

  // Render a fresh round.
  function renderRound({ word, emoji, theme, tiles: tileLetters }) {
    els.picture.textContent = emoji;
    // Re-trigger the pop-in animation.
    els.picture.style.animation = "none";
    void els.picture.offsetWidth;
    els.picture.style.animation = "";
    els.themeLabel.textContent = theme;

    // Build empty slots.
    slotFills = new Array(word.length).fill(null);
    els.slots.innerHTML = "";
    for (let i = 0; i < word.length; i++) {
      const slot = document.createElement("div");
      slot.className = "slot";
      slot.dataset.index = String(i);
      slot.addEventListener("click", () => handlers.onSlotTap(i));
      els.slots.appendChild(slot);
    }

    // Build tiles (unique id per tile instance so duplicate letters work).
    tiles = tileLetters.map((letter, i) => ({ id: `t${i}`, letter, used: false }));
    els.tray.innerHTML = "";
    for (const t of tiles) {
      const btn = document.createElement("button");
      btn.className = "tile";
      btn.type = "button";
      btn.dataset.id = t.id;
      btn.textContent = t.letter;
      btn.addEventListener("click", () => handlers.onTileTap(t.id));
      els.tray.appendChild(btn);
    }
  }

  function tileEl(id) { return els.tray.querySelector(`[data-id="${id}"]`); }
  function slotEl(i) { return els.slots.children[i]; }

  // Place a tile into a slot (visual only; caller tracks logic).
  function placeTile(tileId, slotIndex) {
    const t = tiles.find((x) => x.id === tileId);
    if (!t) return;
    t.used = true;
    slotFills[slotIndex] = tileId;
    tileEl(tileId).classList.add("used");
    const s = slotEl(slotIndex);
    s.textContent = t.letter;
    s.classList.add("filled");
  }

  // Return the tile in a slot back to the tray.
  function returnTile(slotIndex) {
    const tileId = slotFills[slotIndex];
    if (!tileId) return;
    const t = tiles.find((x) => x.id === tileId);
    if (t) t.used = false;
    slotFills[slotIndex] = null;
    tileEl(tileId)?.classList.remove("used");
    const s = slotEl(slotIndex);
    s.textContent = "";
    s.classList.remove("filled");
  }

  // Index of the next empty slot, or -1 if full.
  function firstEmptySlot() { return slotFills.indexOf(null); }
  // Index of the last filled slot, or -1.
  function lastFilledSlot() {
    for (let i = slotFills.length - 1; i >= 0; i--) if (slotFills[i]) return i;
    return -1;
  }
  function currentAnswer() {
    return slotFills
      .map((id) => (id ? tiles.find((t) => t.id === id)?.letter ?? "" : ""))
      .join("");
  }
  function isFull() { return slotFills.every((x) => x !== null); }

  function updateHUD({ score, streak, hintsLeft, cleared }) {
    els.score.textContent = String(score);
    els.streak.textContent = String(streak);
    els.hintsLeft.textContent = String(hintsLeft);
    els.hintLetter.disabled = hintsLeft <= 0;
    // Progress bar shows advancement within the current 4-clear band.
    const within = cleared % 4;
    els.progressFill.style.width = `${(within / 4) * 100}%`;
  }

  function shake() {
    els.slots.classList.remove("shake");
    void els.slots.offsetWidth;
    els.slots.classList.add("shake");
  }

  const CONFETTI_COLORS = ["#ff5ca8", "#ffd23f", "#38d39f", "#4dc9ff", "#7b5cff"];
  function celebrate() {
    const c = els.celebrate;
    c.textContent = ["🎉", "🌟", "🎈", "👏", "✨"][Math.floor(Math.random() * 5)];
    c.classList.remove("show");
    void c.offsetWidth;
    c.classList.add("show");
    // Confetti burst.
    for (let i = 0; i < 24; i++) {
      const piece = document.createElement("span");
      piece.className = "confetti";
      piece.style.left = `${Math.random() * 100}%`;
      piece.style.background = CONFETTI_COLORS[i % CONFETTI_COLORS.length];
      piece.style.animationDuration = `${0.9 + Math.random() * 0.8}s`;
      piece.style.transform = `translateY(0) rotate(${Math.random() * 360}deg)`;
      c.appendChild(piece);
      setTimeout(() => piece.remove(), 1800);
    }
  }

  function setMuteIcon(muted) {
    els.muteBtn.textContent = muted ? "🔇" : "🔊";
  }

  // Show the "watch an ad for hints" button (only when the host offers rewarded ads).
  function setRewardVisible(visible) {
    els.hintReward.hidden = !visible;
  }

  function showTutorial() { els.tutorial.classList.add("show"); }
  function hideTutorial() { els.tutorial.classList.remove("show"); }
  function isTutorialOpen() { return els.tutorial.classList.contains("show"); }

  const LEVEL_SUBS = [
    "Longer words ahead — you've got this!",
    "Nice! The words get a little trickier now.",
    "You're on fire! Keep spelling!",
    "Word wizard! New challenge unlocked.",
  ];
  function showLevelUp(level) {
    els.levelupNum.textContent = String(level);
    els.levelupSub.textContent = LEVEL_SUBS[(level - 2) % LEVEL_SUBS.length] || LEVEL_SUBS[0];
    els.levelup.classList.add("show");
  }
  function hideLevelUp() { els.levelup.classList.remove("show"); }

  // Wire up the persistent controls once.
  els.playBtn.addEventListener("click", () => handlers.onPlay());
  els.hintLetter.addEventListener("click", () => handlers.onHintLetter());
  els.hintSay.addEventListener("click", () => handlers.onSay());
  els.hintReward.addEventListener("click", () => handlers.onRewardHints());
  els.muteBtn.addEventListener("click", () => handlers.onMute());
  els.tutorialOk.addEventListener("click", () => hideTutorial());
  els.levelupNext.addEventListener("click", () => handlers.onLevelNext());

  return {
    showScreen,
    setLoadingProgress,
    renderRound,
    placeTile,
    returnTile,
    firstEmptySlot,
    lastFilledSlot,
    currentAnswer,
    isFull,
    updateHUD,
    shake,
    celebrate,
    setMuteIcon,
    setRewardVisible,
    showTutorial,
    hideTutorial,
    isTutorialOpen,
    showLevelUp,
    hideLevelUp,
  };
}
