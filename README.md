# WordPop! 🎈

A bright, playful **picture-to-word** spelling game for beginner English learners
(CEFR A1–A2), built as a self-contained HTML5 bundle for **YouTube Playables**.

See an emoji → tap the scrambled letter tiles in order to spell the English word.
Correct answers get confetti + a happy chime; wrong answers gently shake and let
you try again (no punishment). Difficulty ramps from 3-letter words upward, with a
first-round onboarding coach-mark and a celebratory level-up screen each time the
word length increases.

**Content:** 142 words across 10 themes — animals, food, home, nature, things,
body, colors, clothes, sports, school.

## Run locally

No build step — it's vanilla ES modules. Serve the folder over HTTP (ES modules
don't load from `file://`):

```bash
cd playables/word-pop
python3 -m http.server 8231
# open http://localhost:8231/index.html
```

## Test

Pure game logic has unit tests (no browser needed):

```bash
node test/wordbank.test.mjs
```

## Project layout

```
index.html      Loads the ytgame SDK + the game module; three screens (loading/start/game)
styles.css      Bright/playful theme, responsive portrait + landscape
src/
  words.js      142 themed beginner words, each with a single emoji (the "art")
  wordbank.js   Word sequencing + letter scrambling (pure, unit-tested)
  state.js      Score, streak, hints, difficulty progression
  ui.js         All DOM rendering + animations (emoji, slots, tiles, HUD, confetti,
                onboarding coach-mark, level-up interstitial)
  audio.js      WebAudio-generated SFX + offline speech; respects mute
  sdk.js        YouTube Playables (ytgame) wrapper with no-op fallback
  main.js       Round lifecycle + wiring
test/
  wordbank.test.mjs
```

## YouTube Playables notes

- **Self-contained:** all logic/art in the bundle; no network calls after load
  (emoji are the art, so there are zero image assets).
- **SDK:** `index.html` loads `https://www.youtube.com/game_api/v1` before the game.
  `src/sdk.js` wraps `window.ytgame` and calls `firstFrameReady()` / `gameReady()`,
  saves/loads progress via `saveData`/`loadData`, and syncs mute with
  `isAudioEnabled()` / `onAudioEnabledChange`. Every call degrades to a safe no-op
  (progress falls back to `localStorage`) when the SDK is absent, so the game runs
  identically as a plain webpage during development.
- **Audio:** respects the platform audio state; the game starts muted if the
  platform reports audio disabled (correct Playables behavior). Players toggle it
  with the in-game 🔊 button.
- **Orientation:** responsive for both portrait and landscape.

## Packaging for submission

Zip the contents of this folder (with `index.html` at the archive root):

```bash
cd playables/word-pop
zip -r ../word-pop.zip . -x '*.DS_Store' 'test/*'
```

Then upload `word-pop.zip` via the YouTube Playables developer portal.

## Adding vocabulary

Append entries to `src/words.js`. Each is `{ word, emoji, theme }` where `word` is
lowercase a–z (no spaces/hyphens) and `emoji` is a single glyph that pictures it.
Difficulty is derived automatically from word length.
```
