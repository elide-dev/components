# Storybook MCP

The catalog exposes Storybook's official MCP server at
`http://localhost:6006/mcp` while the development server is running. The
repository's [`.mcp.json`](../../.mcp.json) already registers that HTTP endpoint.
Clients that do not read this file can register the same URL in their project
configuration.

From the repository root, with Bun and a supported Node version on `PATH`
(Node 24 was used for the MCP checks):

```sh
bun install --frozen-lockfile
bun run build --filter=@elide/storybook^...
bun run storybook
```

Open `/mcp` in a browser to inspect the enabled toolsets and
`/manifests/components.html` to inspect the generated component documentation.
An HTTP server serving `storybook-static` does not run MCP. If `/mcp` returns
404, check that port 6006 belongs to the Storybook development server. When
using a different port, update the MCP client's URL to match.

## Tools

| Tool | Use |
| --- | --- |
| `docs-list` | Discover component IDs; set `withStoryIds: true` to include variants. |
| `docs-show` | Read a component's extracted props and example stories. |
| `docs-show-story` | Read a specific story's example code. |
| `get-storybook-story-instructions` | Get conventions for writing stories and interaction tests. |
| `stories-find-by-component` | Find consumers through the live module graph. |
| `stories-changed` | Find stories related to working-tree changes. |
| `stories-preview` | Generate preview URLs from discovered story IDs. |
| `test-run` | Run selected stories with interaction and accessibility checks. |

Start with `docs-list`, then use the returned IDs for documentation, previews,
and focused tests. `test-run` accepts, for example:

```json
{
  "stories": [{ "storyId": "primitives-button--interaction" }],
  "a11y": true
}
```

Shared configuration and styles may be outside the live import graph. Check
`stories-changed` warnings and use `stories-find-by-component` with the affected
components when necessary. Chromatic's TurboSnap is a separate CI mechanism;
the MCP tools do not upload or approve visual baselines.

## Component metadata

`componentsManifest` is enabled explicitly. `react-docgen-typescript` resolves
inherited types such as Button's CVA `variant` and `size` unions. The Storybook
TypeScript project includes the UI sources so the manifest extractor can see
components outside this app; unit tests are excluded.

Some Base UI root re-exports currently have example stories but no extracted
prop list. An omitted prop is a metadata limitation, not proof that a component
rejects it. Check the component's exported TypeScript API when the manifest is
incomplete. Avoid relying on the preview manifest's JSON schema as a stable
published API.

Validation on Storybook 10.6.6: all eight tools responded successfully, the
manifest included 33 component entries and 68 stories with no extraction
errors, and the Button interaction story passed through `test-run` with
accessibility enabled. The Storybook TypeScript project also passed `tsc`.

See the official [MCP overview](https://storybook.js.org/docs/ai/mcp/overview),
[toolset API](https://storybook.js.org/docs/ai/mcp/api), and
[manifest documentation](https://storybook.js.org/docs/ai/manifests).
