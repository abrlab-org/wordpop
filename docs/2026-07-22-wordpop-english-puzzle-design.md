# WordPop! — Picture-to-Word English Puzzle (Design Spec)

**Date:** 2026-07-22
**Status:** Approved (design), pending implementation plan
**Target platform:** YouTube Playables (self-contained HTML5 game bundle)

## 1. Summary

WordPop! is a bright, playful picture-to-word spelling game for beginner English
learners (CEFR A1–A2). The learner sees a picture (an emoji), then taps scrambled
letter tiles to spell the English word for it. Correct answers are celebrated;
wrong answers are forgiven and retried. The game is endless and relaxed, ramping
word difficulty gradually.

It ships as a single, fully client-side HTML5 bundle suitable for YouTube
Playables: no network calls after load, no `localStorage`/cookies, touch-first,
works offline, tiny bundle size (emoji as art → zero image assets).

## 2. Goals & Non-Goals

### Goals
- Teach/practice beginner English vocabulary + spelling through active production.
- Delightful, forgiving, kid-friendly feel with strong "correct!" feedback.
- Fully self-contained bundle that satisfies YouTube Playables constraints.
- Also runnable as a plain webpage during development (SDK gracefully absent).
- Clean, isolated codebase separate from the existing repo (Ludo/worker) code.

### Non-Goals
- No accounts, logins, leaderboards, ads, or external links.
- No multiplayer or backend.
- No custom illustrated art in v1 (emoji only).
- No hard "game over" / lives system in v1 (endless, relaxed play).

## 3. Audience & Content

- **Audience:** A1–A2 beginners (kids and early adult learners).
- **Vocabulary:** ~100 concrete, picturable nouns each expressible as a single
  emoji, grouped by theme: Animals, Food, Home, Body, Nature, Colors (extensible).
- **Data shape:** `{ word: "cat", emoji: "🐱", theme: "animals" }`.
  - `word` is lowercase a–z only (no spaces/hyphens in v1).
- **Difficulty ramp:** ordered by word length — 3-letter words first, then 4, 5, …
  Within a length band, words are shuffled. Difficulty advances as the learner
  clears rounds.

## 4. Core Gameplay Loop (one round)

1. Present a large emoji for the target word.
2. Show one empty slot per letter of the word: `_ _ _`.
3. Show the word's letters, **scrambled**, as tappable tiles (guaranteed not to be
   already in solved order).
4. **Input:** tapping a tile moves it into the next empty slot (left→right).
   Tapping a filled slot returns that tile to the tray.
5. **Auto-check** when all slots are filled:
   - **Correct:** confetti burst + happy chime + points + streak increment →
     short delay → next word.
   - **Wrong:** gentle shake, wrong-sound, tiles return to the tray, retry (no
     score penalty, no life lost).
6. **Hints** (limited pool, e.g. 3 to start, small trickle back on streaks):
   - **Reveal first empty letter** — auto-places the correct next tile.
   - **🔊 Hear the word** — offline speech synthesis pronunciation.
7. **HUD:** score, streak flame 🔥 counter, and a level/round progress bar with the
   current theme label.

### Scoring (v1, simple)
- Base points per solved word (e.g. 10).
- Streak bonus (e.g. +2 per consecutive no-hint solve).
- Using a hint on a word disables that word's streak bonus but never penalizes.

## 5. Architecture

Vanilla JS, ES modules, **no build step** — so the folder zips directly for
Playables. Each unit has one responsibility and a clear interface.

```
web-games/word-pop/
  index.html        # layout root, module entrypoint
  styles.css        # responsive portrait/landscape, playful theme
  src/
    words.js        # vocabulary data (pure data export)
    wordbank.js     # sequencing + scrambling logic (pure, testable)
    state.js        # game state: score, streak, hints, current word
    ui.js           # DOM rendering: emoji, slots, tiles, HUD, animations
    audio.js        # WebAudio-generated SFX + optional offline speech
    sdk.js          # YouTube Playables (ytgame) wrapper w/ no-op fallback
    main.js         # wiring: creates modules, runs the loop, binds input
  test/
    wordbank.test.* # unit tests for pure logic
```

### Unit responsibilities & interfaces

- **`words.js`** — exports `WORDS: Array<{word, emoji, theme}>`. Pure data.
- **`wordbank.js`** — `createWordBank(words)` →
  - `next(difficultyLevel)` → next `{word, emoji, theme}`, avoiding recent repeats.
  - `scramble(word)` → shuffled letter array, guaranteed ≠ original order.
  - Deterministic given an injected RNG (for tests).
  - Depends on: `words` data + an RNG function. No DOM.
- **`state.js`** — `createState()` holds `{score, streak, hintsLeft, level,
  currentWord, placedTiles}`; methods to mutate on correct/wrong/hint. No DOM.
- **`ui.js`** — `createUI(rootEl, handlers)`:
  - `renderRound(word, emoji, scrambledTiles)`, `placeTile`, `returnTile`,
    `celebrate()`, `shake()`, `updateHUD(state)`.
  - Emits user intents via `handlers` (tile tapped, slot tapped, hint pressed).
  - Depends on: DOM only. No game rules inside.
- **`audio.js`** — `createAudio()`: `playCorrect()`, `playWrong()`, `playTap()`,
  `speak(word)`, `setMuted(bool)`. Generates tones via WebAudio (no asset files);
  `speak` uses `speechSynthesis` when available, else no-op.
- **`sdk.js`** — `createSdk()` wraps `window.ytgame`:
  - `ready()` (signal load complete), `saveProgress(obj)`, `loadProgress()`,
    `onMuteChange(cb)`. Every method degrades to a safe no-op / in-memory store
    when `ytgame` is absent, so the game runs standalone in a browser.
- **`main.js`** — instantiates the above, subscribes UI intents → updates state →
  drives audio/animation → requests next word. Owns the round lifecycle.

### Data flow
`main` asks `wordbank.next()` → tells `ui.renderRound()` → user taps →
`ui` emits intent → `main` updates `state`, checks answer → on correct: `audio` +
`ui.celebrate()` + `sdk.saveProgress()` → loop; on wrong: `ui.shake()` + retry.

## 6. YouTube Playables compliance

- **Self-contained:** all code/assets in the bundle; **no network after load.**
- **No persistent web storage:** progress saved via the Playables SDK save API;
  falls back to in-memory when running outside the platform.
- **Audio:** respects the platform mute state via `sdk.onMuteChange`.
- **Lifecycle:** calls the SDK "game ready / loading complete" signal on start.
- **Orientation:** responsive layout supports portrait and landscape.
- **Size:** emoji-as-art + vanilla JS keeps the bundle well within limits.
- SDK specifics (exact `ytgame` method names/versions) will be confirmed against
  the official YouTube Playables developer portal during implementation; the
  `sdk.js` wrapper isolates any such detail behind our own stable interface.

## 7. Error handling & edge cases

- **SDK absent** → `sdk.js` no-ops / in-memory (dev + resilience).
- **Speech unavailable** → `speak()` silently skips; the 🔊 hint still costs nothing.
- **WebAudio blocked until gesture** → audio context resumed on first tap.
- **Word with duplicate letters** (e.g. "egg") → tiles tracked by tile-instance id,
  not by letter, so returning the right tile works.
- **Scramble equals original** → re-scramble until different (bounded retries).
- **Empty/short word data** → validated at load; malformed entries skipped.

## 8. Testing strategy

- **Unit tests** (pure logic, no DOM): `scramble` never returns original order and
  is a true permutation; `next()` avoids recent repeats and respects difficulty
  ordering; answer-checking handles duplicate letters.
- **Manual playtest:** run standalone, drive a mobile-sized viewport in a browser;
  verify the loop, hints, animations, mute, and portrait/landscape layouts.

## 9. Open questions / future (post-v1)

- Themed level packs and a themed background per section.
- Optional lives/timed "challenge" mode.
- Custom SVG illustration set to replace/augment emoji.
- More words + audio pronunciation quality tuning.
