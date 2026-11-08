// Publishes the workspace packages with `bun publish`, which rewrites
// `workspace:*` dependencies to real versions. (`changeset publish` shells out
// to `npm publish`, which would ship `workspace:*` and break every install.)
// Dependency order; versions already on the registry are skipped, so a failed
// release can simply be re-run. Usage: bun run release [--dry-run]
import { $ } from "bun";

const order = ["packages/brand", "packages/tokens", "packages/elements", "packages/ui"];
const dryRun = process.argv.includes("--dry-run");

for (const dir of order) {
  const { name, version, private: isPrivate } = await Bun.file(`${dir}/package.json`).json();
  if (isPrivate) continue;
  const published = await $`npm view ${`${name}@${version}`} version`.quiet().nothrow();
  if (published.exitCode === 0 && published.text().trim() === version) {
    console.log(`skip ${name}@${version} (already published)`);
    continue;
  }
  console.log(`${dryRun ? "dry run" : "publish"} ${name}@${version}`);
  await $`bun publish --access restricted ${dryRun ? ["--dry-run"] : []}`.cwd(dir);
}
