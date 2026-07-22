// Unit tests for pure logic. Run: node test/wordbank.test.mjs
import assert from "node:assert";
import { WORDS } from "../src/words.js";
import { shuffle, scramble, bandForLevel, createWordBank } from "../src/wordbank.js";

let passed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log(`  ok  ${name}`); }
  catch (e) { console.error(`FAIL  ${name}\n      ${e.message}`); process.exitCode = 1; }
}

// Deterministic RNG (mulberry32) for reproducible tests.
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

test("shuffle is a permutation (same multiset)", () => {
  const r = rng(1);
  const input = ["a", "b", "c", "d", "e"];
  const out = shuffle(input, r);
  assert.strictEqual(out.length, input.length);
  assert.deepStrictEqual([...out].sort(), [...input].sort());
  assert.deepStrictEqual(input, ["a", "b", "c", "d", "e"], "input not mutated");
});

test("scramble never returns the original order", () => {
  const r = rng(7);
  for (const w of ["cat", "apple", "rocket", "banana", "book"]) {
    const out = scramble(w, r).join("");
    assert.notStrictEqual(out, w, `scramble(${w}) returned original`);
    assert.deepStrictEqual(out.split("").sort(), w.split("").sort());
  }
});

test("scramble handles duplicate letters (egg) as a valid permutation", () => {
  const r = rng(3);
  const out = scramble("egg", r);
  assert.deepStrictEqual(out.slice().sort(), ["e", "g", "g"]);
});

test("scramble of all-identical letters returns as-is without hanging", () => {
  assert.deepStrictEqual(scramble("aaa", rng(1)), ["a", "a", "a"]);
});

test("single-letter word is returned unchanged", () => {
  assert.deepStrictEqual(scramble("a", rng(1)), ["a"]);
});

test("bandForLevel starts at 3 and widens every 4 clears", () => {
  assert.strictEqual(bandForLevel(0), 3);
  assert.strictEqual(bandForLevel(3), 3);
  assert.strictEqual(bandForLevel(4), 4);
  assert.strictEqual(bandForLevel(8), 5);
});

test("wordbank.next respects the difficulty band at level 0 (<=3 letters)", () => {
  const bank = createWordBank(WORDS, { rng: rng(42) });
  for (let i = 0; i < 15; i++) {
    const w = bank.next(0);
    assert.ok(w.word.length <= 3, `got ${w.word} (len ${w.word.length}) at band 3`);
  }
});

test("wordbank.next avoids recent repeats within memory window", () => {
  const bank = createWordBank(WORDS, { rng: rng(99), recentMemory: 12 });
  const seen = [];
  for (let i = 0; i < 12; i++) seen.push(bank.next(50).word); // high band = full pool
  const uniq = new Set(seen);
  assert.strictEqual(uniq.size, seen.length, `repeats within window: ${seen.join(",")}`);
});

test("wordbank.next returns scrambled tiles matching the word letters", () => {
  const bank = createWordBank(WORDS, { rng: rng(5) });
  const w = bank.next(100);
  assert.deepStrictEqual(w.tiles.slice().sort(), w.word.split("").sort());
});

test("all words are lowercase a-z and have an emoji", () => {
  for (const w of WORDS) {
    assert.ok(/^[a-z]+$/.test(w.word), `bad word: ${w.word}`);
    assert.ok(w.emoji && w.emoji.length > 0, `missing emoji: ${w.word}`);
    assert.ok(w.theme, `missing theme: ${w.word}`);
  }
});

test("no duplicate words in the vocabulary", () => {
  const words = WORDS.map((w) => w.word);
  assert.strictEqual(new Set(words).size, words.length, "duplicate word entries exist");
});

console.log(`\n${passed} tests passed`);
