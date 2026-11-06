# Visual CI and caching

Build the catalog from the repository root:

```sh
bun install --frozen-lockfile
bun run build-storybook
# Publish the prebuilt catalog, with CHROMATIC_PROJECT_TOKEN in the environment:
bun run chromatic
```

`build-storybook` runs the Storybook build through Turbo, including its brand,
token, and UI dependencies. Storybook emits `preview-stats.json` alongside its
static site. `verify-build.mjs` checks that every indexed story appears in this
dependency graph, including after the CI artifact is downloaded.

## TurboSnap

The root `chromatic.config.json` enables `onlyChanged` and explicitly identifies
the Storybook base, configuration, and output directories. Run Chromatic from
the repository root; the workspace convenience script forwards there too.

Stories import tracked component source, allowing component changes to select
dependent stories. The catalog limits Tailwind scanning to its explicit
component and story sources. Global UI/token CSS, static brand assets, and brand
source trigger a full snapshot run via `externals`: CSS is processed outside
the module graph, assets are copied by `staticDirs`, and brand JavaScript is
consumed from generated `dist` files. `bun.lock` also triggers a full run because
the locked Chromatic 18.14.2 dependency tracer does not recognize Bun lockfiles.
Keep these safeguards when adding new generated or externally loaded inputs.

Inspect affected stories locally without uploading snapshots:

```sh
bun run chromatic trace \
  --stats-file apps/storybook/storybook-static/preview-stats.json \
  --storybook-base-dir apps/storybook \
  --storybook-config-dir apps/storybook/.storybook \
  --mode compact packages/ui/src/components/table-of-contents.tsx
```

This command identifies the two TOC consumers in the current catalog. A change
to the root README identifies no story consumers. The trace command examines
the module graph; the upload command also applies `externals` and baseline
selection. Shared preview/configuration changes can legitimately retest every
story. TurboSnap eligibility and baseline availability are controlled by
Chromatic; the first eligible run may capture the full catalog.

## GitHub Actions

Push and PR workflows build Storybook once, upload `storybook-static`, and pass
that artifact to Chromatic. The publishing job does not rebuild the site.
Standalone Chromatic workflow dispatches still build through Turbo. Both
artifact production and publishing use the same PR head commit; Chromatic gets
full Git history and explicit matching commit/branch metadata. Fork PRs run the
build and test jobs but skip publishing, since the project secret is unavailable.
Main retains automatic baseline acceptance; PR visual changes remain available
for review without making the CLI job fail solely for a visual difference.

The shared setup action caches Bun's package downloads and Turbo's
`.turbo/cache`, not `node_modules`. Keys include OS, architecture, Bun/Node
versions, and the lockfile. Turbo caches are separate per job and commit, with
fallbacks to compatible previous entries; Turbo validates each task's content
hash before restoring outputs. Re-running a commit reuses its exact cache key.
Dependency updates can reuse Bun downloads while installing the frozen lockfile.
No external Turbo cache service or new secret is required.

`CODECOV_TOKEN` and GitHub metadata pass through Turbo's strict environment mode
for bundle analysis. The upload runs when Storybook actually builds; a cached
build reuses the artifact without repeating that upload. Chromatic publishing
always runs so it can associate snapshots and baselines with the current commit.

References: [TurboSnap setup](https://www.chromatic.com/docs/turbosnap/setup/),
[monorepo paths](https://www.chromatic.com/docs/turbosnap/config-paths/),
[PR baseline handling](https://www.chromatic.com/docs/github-actions/#recommended-configuration-for-build-events),
and [Turbo on GitHub Actions](https://turborepo.dev/docs/guides/ci-vendors/github-actions).
