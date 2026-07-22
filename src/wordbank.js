// wordbank.js — word sequencing + letter scrambling.
// Pure logic, no DOM. RNG is injectable so tests can be deterministic.

const DEFAULT_RNG = Math.random;

// Fisher-Yates shuffle on a copy, using an injectable rng.
export function shuffle(arr, rng = DEFAULT_RNG) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Return the word's letters shuffled, guaranteed not equal to the original
// order (unless the word is a single letter or all letters are identical).
export function scramble(word, rng = DEFAULT_RNG) {
  const letters = word.split("");
  if (letters.length < 2) return letters;
  const allSame = letters.every((c) => c === letters[0]);
  if (allSame) return letters;
  let out = shuffle(letters, rng);
  let guard = 0;
  while (out.join("") === word && guard < 20) {
    out = shuffle(letters, rng);
    guard++;
  }
  return out;
}

// Map a cleared-word count to a max word length "difficulty band".
// Starts at 3-letter words, widens the pool every few clears.
export function bandForLevel(cleared) {
  return 3 + Math.floor(cleared / 4); // 0-3 clears => <=3, 4-7 => <=4, ...
}

// createWordBank(words) -> sequencing engine.
// - next(cleared): returns the next {word, emoji, theme}, preferring words
//   within the current difficulty band and avoiding recent repeats.
export function createWordBank(words, { rng = DEFAULT_RNG, recentMemory = 12 } = {}) {
  const valid = words.filter(
    (w) => w && typeof w.word === "string" && /^[a-z]+$/.test(w.word) && w.emoji
  );
  if (valid.length === 0) throw new Error("wordbank: no valid words");

  const recent = []; // recently served words (by word string)

  function eligible(cleared) {
    const maxLen = bandForLevel(cleared);
    // Prefer words within the band and not recently seen.
    let pool = valid.filter(
      (w) => w.word.length <= maxLen && !recent.includes(w.word)
    );
    // If the band is exhausted after removing recents, ignore recents.
    if (pool.length === 0) pool = valid.filter((w) => w.word.length <= maxLen);
    // If the band itself is empty (very short data), fall back to everything
    // not recently seen, then to everything.
    if (pool.length === 0) pool = valid.filter((w) => !recent.includes(w.word));
    if (pool.length === 0) pool = valid;
    return pool;
  }

  function remember(word) {
    recent.push(word);
    while (recent.length > recentMemory) recent.shift();
  }

  function next(cleared = 0) {
    const pool = eligible(cleared);
    const pick = pool[Math.floor(rng() * pool.length)];
    remember(pick.word);
    return { ...pick, tiles: scramble(pick.word, rng) };
  }

  return { next, _recent: recent };
}
