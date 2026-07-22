// record.mjs — capture a real gameplay reel as an MP4.
//
// Drives headless Chrome over the DevTools Protocol (no dependencies — Node 22
// ships fetch and WebSocket), scripts an actual playthrough of the real build,
// screenshots continuously, then assembles the frames with ffmpeg using the
// measured per-frame timings so playback speed matches reality.
//
//   node marketing/record.mjs landscape
//   node marketing/record.mjs portrait
//
// The director reads the on-screen emoji and looks the answer up in words.js,
// so it plays the game exactly the way a person would: only public DOM, only
// clicks. Math.random is seeded first so the word sequence is reproducible.

import { spawn } from "node:child_process";
import { mkdir, rm, writeFile, readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { WORDS } from "../src/words.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const GAME = join(HERE, "../dist/standalone-single/index.html");
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PORT = 9333;

// CSS viewport is deliberately small so the game's 560px-wide stage fills the
// frame instead of floating in margins; deviceScaleFactor doubles it back up to
// a crisp 1280x720 / 720x1280 capture.
const FORMATS = {
  landscape: { w: 640, h: 360, scale: 2 },
  portrait: { w: 360, h: 640, scale: 2 },
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- injected into the page, before any game code runs ----------
function pageBootstrap(emojiToWord) {
  // Deterministic RNG so the reel shows the same words every render.
  let seed = 0x2f6e2b1;
  Math.random = () => {
    seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5;
    return ((seed >>> 0) % 1e6) / 1e6;
  };

  const nap = (ms) => new Promise((r) => setTimeout(r, ms));
  const $ = (s) => document.querySelector(s);

  window.__director = async () => {
    await nap(900);
    $("#play-btn")?.click();                       // start
    await nap(700);
    $("#tutorial-ok")?.click();                    // dismiss coach-mark
    await nap(500);

    for (let round = 0; round < 4; round++) {
      const emoji = $("#picture")?.textContent?.trim();
      const word = emojiToWord[emoji];
      if (!word) break;

      for (const ch of word) {
        const tile = [...document.querySelectorAll("#tray .tile:not(.used)")]
          .find((t) => t.textContent === ch);
        if (!tile) break;
        tile.click();
        await nap(300);                            // human-paced tapping
      }

      await nap(1300);                             // celebrate + next round
      const next = $("#levelup-next");
      if (next && next.offsetParent !== null) {    // level-up card is showing
        await nap(900);
        next.click();
        await nap(700);
      }
    }
    await nap(600);
    window.__done = true;
  };
}

// ---------- minimal CDP client ----------
async function connect() {
  for (let i = 0; i < 60; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
      const page = list.find((t) => t.type === "page");
      if (page?.webSocketDebuggerUrl) return page.webSocketDebuggerUrl;
    } catch { /* chrome still starting */ }
    await sleep(250);
  }
  throw new Error("could not reach Chrome devtools");
}

function cdp(ws) {
  let id = 0;
  const pending = new Map();
  ws.addEventListener("message", (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result);
    }
  });
  return (method, params = {}) =>
    new Promise((resolve, reject) => {
      const n = ++id;
      pending.set(n, { resolve, reject });
      ws.send(JSON.stringify({ id: n, method, params }));
    });
}

// ---------- main ----------
const format = process.argv[2] || "landscape";
const { w, h, scale } = FORMATS[format] || FORMATS.landscape;
const frameDir = join(HERE, "frames", format);
const outFile = join(HERE, "out", `wordpop-${format}.mp4`);

await rm(frameDir, { recursive: true, force: true });
await mkdir(frameDir, { recursive: true });
await mkdir(join(HERE, "out"), { recursive: true });

const profile = join(HERE, ".chrome-profile", format);
await rm(profile, { recursive: true, force: true });

const chrome = spawn(CHROME, [
  "--headless=new",
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${profile}`,
  `--window-size=${w},${h}`,
  "--hide-scrollbars",
  "--force-device-scale-factor=1",
  "--mute-audio",
  "--no-first-run",
  "about:blank",
], { stdio: "ignore" });

try {
  const wsUrl = await connect();
  const ws = new WebSocket(wsUrl);
  await new Promise((r) => ws.addEventListener("open", r, { once: true }));
  const send = cdp(ws);

  await send("Page.enable");
  await send("Runtime.enable");
  await send("Emulation.setDeviceMetricsOverride", {
    width: w, height: h, deviceScaleFactor: scale, mobile: false,
  });

  const emojiToWord = Object.fromEntries(WORDS.map((x) => [x.emoji, x.word]));
  await send("Page.addScriptToEvaluateOnNewDocument", {
    source: `(${pageBootstrap.toString()})(${JSON.stringify(emojiToWord)})`,
  });

  await send("Page.navigate", { url: `file://${GAME}` });
  await sleep(1200);
  await send("Runtime.evaluate", { expression: "window.__director && window.__director()" });

  // Capture as fast as Chrome allows, recording real timestamps so the
  // assembled video plays back at true speed.
  const stamps = [];
  const start = Date.now();
  let n = 0;
  while (Date.now() - start < 19000) {
    const { data } = await send("Page.captureScreenshot", { format: "png" });
    await writeFile(join(frameDir, `f${String(n).padStart(4, "0")}.png`), Buffer.from(data, "base64"));
    stamps.push(Date.now() - start);
    n++;
    const done = await send("Runtime.evaluate", { expression: "!!window.__done", returnByValue: true });
    if (done.result?.value) break;
  }
  ws.close();
  console.log(`captured ${n} frames over ${((Date.now() - start) / 1000).toFixed(1)}s`);

  // Per-frame durations from the real clock -> true-speed playback.
  const files = (await readdir(frameDir)).filter((f) => f.endsWith(".png")).sort();
  const lines = files.map((f, i) => {
    const dur = ((stamps[i + 1] ?? stamps[i] + 60) - stamps[i]) / 1000;
    return `file '${join(frameDir, f)}'\nduration ${Math.max(dur, 0.016).toFixed(3)}`;
  });
  lines.push(`file '${join(frameDir, files[files.length - 1])}'`);
  const listFile = join(frameDir, "frames.txt");
  await writeFile(listFile, lines.join("\n"));

  await new Promise((resolve, reject) => {
    const ff = spawn("ffmpeg", [
      "-y", "-f", "concat", "-safe", "0", "-i", listFile,
      "-vf", "fps=30,format=yuv420p",
      "-c:v", "libx264", "-preset", "slow", "-crf", "20",
      "-movflags", "+faststart",
      outFile,
    ], { stdio: "ignore" });
    ff.on("exit", (c) => (c === 0 ? resolve() : reject(new Error("ffmpeg failed"))));
  });
  console.log(`wrote ${outFile}`);
} finally {
  chrome.kill();
}
