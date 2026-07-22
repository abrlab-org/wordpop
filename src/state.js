// state.js — game state + scoring. No DOM.

export const START_HINTS = 3;
export const BASE_POINTS = 10;
export const STREAK_BONUS = 2;

export function createState() {
  const s = {
    score: 0,
    streak: 0,
    best: 0,
    hintsLeft: START_HINTS,
    cleared: 0, // total words solved (drives difficulty)
    usedHintThisWord: false,
  };

  function startWord() {
    s.usedHintThisWord = false;
  }

  // Register a correct answer; returns points awarded.
  function correct() {
    const streakBonus = s.usedHintThisWord ? 0 : s.streak * STREAK_BONUS;
    const gained = BASE_POINTS + streakBonus;
    s.score += gained;
    s.cleared += 1;
    if (s.usedHintThisWord) {
      s.streak = 0;
    } else {
      s.streak += 1;
      s.best = Math.max(s.best, s.streak);
      // Reward a clean streak with an occasional hint refill.
      if (s.streak % 5 === 0 && s.hintsLeft < START_HINTS) s.hintsLeft += 1;
    }
    return gained;
  }

  function wrong() {
    // Forgiving: no score/life penalty, but break the streak.
    s.streak = 0;
  }

  // Grant extra hints (e.g. from a rewarded ad).
  function addHints(n) {
    s.hintsLeft += Math.max(0, n | 0);
  }

  // Consume a hint if available; returns true if one was spent.
  function useHint() {
    if (s.hintsLeft <= 0) return false;
    s.hintsLeft -= 1;
    s.usedHintThisWord = true;
    return true;
  }

  function snapshot() {
    return { score: s.score, streak: s.streak, hintsLeft: s.hintsLeft, cleared: s.cleared, best: s.best };
  }

  function load(data) {
    if (!data || typeof data !== "object") return;
    if (Number.isFinite(data.score)) s.score = data.score;
    if (Number.isFinite(data.cleared)) s.cleared = data.cleared;
    if (Number.isFinite(data.best)) s.best = data.best;
  }

  return { raw: s, startWord, correct, wrong, useHint, addHints, snapshot, load };
}
