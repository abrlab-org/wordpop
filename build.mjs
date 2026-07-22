// build.mjs — emit a per-portal bundle into dist/<target>/.
//
// The only thing that differs between portals is which host SDK script
// index.html loads; src/platform/ detects the resulting global at runtime.
//
//   node build.mjs             # build every target
//   node build.mjs poki        # build one target
//
// Then zip the folder's CONTENTS (index.html must sit at the archive root):
//   cd dist/poki && zip -r ../word-pop-poki.zip .

import { readFile, writeFile, mkdir, rm, cp } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(fileURLToPath(import.meta.url));

const SDK_TAGS = {
  youtube: '<script src="https://www.youtube.com/game_api/v1"></script>',
  poki: '<script src="https://game-cdn.poki.com/scripts/v2/poki-sdk.js"></script>',
  crazygames: '<script src="https://sdk.crazygames.com/crazygames-sdk-v3.js"></script>',
  standalone: "<!-- no host SDK: runs in standalone mode -->",
};

const SDK_BLOCK = /<!-- SDK:START[\s\S]*?<!-- SDK:END -->/;

async function build(target) {
  const tag = SDK_TAGS[target];
  if (!tag) throw new Error(`unknown target "${target}" (expected: ${Object.keys(SDK_TAGS).join(", ")})`);

  const outDir = join(ROOT, "dist", target);
  await rm(outDir, { recursive: true, force: true });
  await mkdir(outDir, { recursive: true });

  const html = await readFile(join(ROOT, "index.html"), "utf8");
  if (!SDK_BLOCK.test(html)) throw new Error("index.html is missing the SDK:START/SDK:END block");
  await writeFile(
    join(outDir, "index.html"),
    html.replace(SDK_BLOCK, `<!-- host SDK: ${target} -->\n  ${tag}`)
  );

  await cp(join(ROOT, "styles.css"), join(outDir, "styles.css"));
  await cp(join(ROOT, "src"), join(outDir, "src"), { recursive: true });

  console.log(`built dist/${target}/`);
}

const targets = process.argv.slice(2);
const list = targets.length ? targets : Object.keys(SDK_TAGS);
for (const t of list) await build(t);
