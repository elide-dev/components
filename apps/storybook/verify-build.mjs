import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { posix } from "node:path";

const output = new URL("./storybook-static/", import.meta.url);
const json = async file => JSON.parse(await readFile(new URL(file, output), "utf8"));
const [stats, index] = await Promise.all([json("preview-stats.json"), json("index.json")]);
assert.ok(Array.isArray(stats.modules) && stats.modules.length > 0, "TurboSnap needs a nonempty module graph");
const modules = new Set(stats.modules.map(module => posix.normalize(module.name)));
const stories = Object.values(index.entries).filter(entry => entry.type === "story");
assert.ok(stories.length > 0, "The built catalog must contain stories");
for (const story of stories) {
  assert.ok(modules.has(posix.normalize(story.importPath)), `Missing dependency stats for ${story.id}`);
}
console.log(`Verified TurboSnap module coverage for all ${stories.length} stories.`);
