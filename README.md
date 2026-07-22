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
index.html      Host SDK block (swapped by build.mjs) + the game module
styles.css      Bright/playful theme, responsive portrait + landscape
build.mjs       Emits dist/<portal>/ bundles with the right SDK script tag
src/
  words.js      142 themed beginner words, each with a single emoji (the "art")
  wordbank.js   Word sequencing + letter scrambling (pure, unit-tested)
  state.js      Score, streak, hints, difficulty progression
  ui.js         All DOM rendering + animations (emoji, slots, tiles, HUD, confetti,
                onboarding coach-mark, level-up interstitial)
  audio.js      WebAudio-generated SFX + offline speech; respects mute
  main.js       Round lifecycle + wiring
  platform/     Host abstraction — one interface, four adapters
    index.js      Detection + timeout guards around every async host call
    youtube.js    YouTube Playables (window.ytgame)
    poki.js       Poki (window.PokiSDK)
    crazygames.js CrazyGames v3 (window.CrazyGames.SDK)
    storage.js    localStorage progress store w/ in-memory fallback
test/
  wordbank.test.mjs
```

## Multi-portal builds

The game runs on YouTube Playables, Poki, CrazyGames, or as a plain webpage. Only
the SDK `<script>` in `index.html` differs; `src/platform/` picks the matching
adapter at runtime by detecting which global exists, and falls back to standalone
when none does.

```bash
node build.mjs                    # all targets -> dist/
node build.mjs poki               # just one
node build.mjs crazygames --single  # one self-contained index.html (~31 KB)
```

`--single` inlines the CSS and esbuild-bundles every module into a single
`index.html` with no external references except the host SDK — needed by portals
that reject archives and want files dropped directly.

Every async hand-off to a host SDK is raced against a timeout, so a stalled or
adblocked third-party script can never freeze the game.

Ad breaks are wired to natural moments: an interstitial when the player clears a
level, and an optional rewarded video behind the "🎁 Free hints" button that only
appears when hints run out **and** the host supports rewarded ads. Audio is muted
for the duration of any break and restored afterwards.

See [SUBMISSION.md](SUBMISSION.md) for the portal submission guide and copy.

## YouTube Playables notes

- **Self-contained:** all logic/art in the bundle; no network calls after load
  (emoji are the art, so there are zero image assets).
- **SDK:** `index.html` loads `https://www.youtube.com/game_api/v1` before the game.
  `src/platform/youtube.js` wraps `window.ytgame` and calls `firstFrameReady()` /
  `gameReady()`, saves/loads progress via `saveData`/`loadData`, and syncs mute with
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
