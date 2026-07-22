# WordPop! — portal submission guide

Everything needed to submit WordPop! to the HTML5 game portals that actually pay
revenue share. Build artifacts are produced by `build.mjs`; the copy below is
ready to paste into the submission forms.

> **You have to create the developer accounts yourself.** I can't sign up on your
> behalf. Both portals below require an account before you can upload anything.

---

## 1. Build the bundles

```bash
cd playables/word-pop
node build.mjs
```

This writes `dist/poki/`, `dist/crazygames/`, `dist/youtube/`, and
`dist/standalone/`. The only difference between them is which host SDK
`index.html` loads — `src/platform/` detects the resulting global at runtime.

Zip the folder **contents** (`index.html` must sit at the archive root):

```bash
cd dist/poki && zip -r ../word-pop-poki.zip . && cd -
```

### Single-file build (required by CrazyGames)

**CrazyGames rejects archives** — "Archive files are not supported, please drag and
drop the files directly in the upload zone." Rather than drag a folder tree, build
the single-file variant: CSS and every module are inlined into one ~31 KB
`index.html` with no external references except the host SDK.

```bash
node build.mjs crazygames --single   # -> dist/crazygames-single/index.html
```

Drag that one file into the upload zone. Verified to behave identically to the
multi-file build, including Data Module saves.

---

## 2. Poki

- **Sign up:** https://developers.poki.com
- **SDK:** `https://game-cdn.poki.com/scripts/v2/poki-sdk.js` (already wired in
  `dist/poki/`). Poki requires the SDK be loaded from their CDN, never bundled —
  we comply.
- **Integrated calls:** `init()`, `gameLoadingFinished()`, `gameplayStart()`,
  `gameplayStop()`, `commercialBreak()` on level-up, `rewardedBreak()` for the
  "🎁 Free hints" button.
- **Test before submitting:** use Poki's own Playground / Inspector tool. Ad
  container teardown can only be verified inside Poki's environment — on
  localhost the Google IMA iframe is left on top of the page after a rewarded ad
  (Poki cleans this up on their own domain). Confirm this behaves in Playground.

## 3. CrazyGames

- **Sign up:** https://developer.crazygames.com
- **SDK:** `https://sdk.crazygames.com/crazygames-sdk-v3.js` (already wired in
  `dist/crazygames/`).
- **Integrated calls:** `SDK.init()`, `game.loadingStart()/loadingStop()`,
  `game.gameplayStart()/gameplayStop()`, `game.happytime()` on level-up,
  `data.getItem/setItem` for progress, `game.settings.muteAudio` +
  `addSettingsChangeListener`, `ad.requestAd("midgame")` on level-up, and
  `ad.requestAd("rewarded")` for hints. Audio is muted for the duration of every
  break and restored afterwards, as their docs require.
- **Ads do not serve during basic launch** — the QA tool states this outright.
  The rewarded "🎁 Free hints" button therefore grants its hints whether or not
  an ad plays, so it is never a dead button during the soft-launch period. It
  still functions as a real rewarded ad once the game reaches Full Launch.
- **Launch tier:** Basic is the only selectable option for a new game. CrazyGames
  soft-launches to a subset of users and promotes to Full Launch automatically if
  the KPIs are met — it is not a choice you make at submission time.

## 4. Also worth submitting to

Same `dist/standalone/` build works as-is, no SDK needed:

- **itch.io** — instant, no review, good for a public devlog link.
- **GameDistribution** — ad revenue share, wide reach.
- **Yandex Games** — has its own SDK; would need a fourth adapter.

---

## Submission copy (paste-ready)

**Title:** WordPop!

**Short description (~1 line):**
> See the picture, tap the letters, spell the English word — a bright and friendly vocabulary game for new English learners.

**Long description:**
> WordPop! turns learning English into a puzzle. A picture appears — a cat, a rocket, a rainbow — and you tap the scrambled letter tiles to spell its English name.
>
> With 142 words across 10 themes and difficulty that grows with you, it starts with simple three-letter words and works up from there. Stuck? Use a hint to reveal a letter, or tap "Say it" to hear the word pronounced. Get it wrong and nothing bad happens — the tiles come back and you try again.
>
> Designed for beginner English learners and young players, but relaxing for anyone who likes word games.
>
> • 142 words across 10 themes
> • Difficulty that ramps as you improve
> • Hear every word pronounced
> • Hints when you need them
> • No timers, no fail state, no pressure

**Genre / category:** Puzzle · Word · Educational

**Tags:** word game, spelling, vocabulary, english, educational, puzzle, learning, kids, casual, letters

**Controls:** Mouse or touch — tap the letter tiles to spell, tap a filled slot to take a letter back.

**Age rating:** Everyone. No violence, no chat, no user-generated content, no data collection, no external links.

**Languages:** English (interface and content).

---

## Assets you still need

I can generate these from the running game, but the portals set the exact pixel
specs and they change — **check the current requirements on each portal's upload
page** before producing final files.

| Asset | Notes |
|---|---|
| Thumbnail / cover | Usually a landscape key art tile. The 🎈 logo + a letter-tile motif works well. |
| Screenshots | Grab the game screen (emoji + slots + tiles), the level-up card, and the start screen. |
| Gameplay video | Some portals ask for a short clip. Optional at first. |

Ask me and I'll capture screenshots straight from the live build.

---

## Technical facts (for the forms)

- **Engine:** none — hand-written vanilla JavaScript (ES modules), no framework, no build step.
- **Bundle size:** tiny; emoji are used as the artwork so there are zero image assets.
- **Network:** no runtime network calls other than the host's own SDK.
- **Storage:** progress saved via the host's save API where one exists, otherwise `localStorage`; no accounts, no personal data.
- **Orientation:** responsive, supports portrait and landscape.
- **Mobile:** touch-first; works on phones, tablets, and desktop.
