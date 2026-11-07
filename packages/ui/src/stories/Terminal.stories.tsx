import * as React from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { Terminal } from "../components/terminal";
import { I18nProvider } from "../i18n/provider";
import ar from "../i18n/locales/ar";
import { elideBuildCast, elideRunCast } from "./fixtures/casts";

const ESC = "\x1b";

const meta = {
  title: "Docs/Terminal",
  component: Terminal,
  parameters: { layout: "padded" },
  render: (args) => (
    <div style={{ maxWidth: 640 }}>
      <Terminal {...args} />
    </div>
  ),
} satisfies Meta<typeof Terminal>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Prompts mark commands; other lines are output and keep their ANSI colors. Copy yields only the commands. */
export const Session: Story = {
  args: {
    code: [
      "# Run a TypeScript file directly — no build step",
      "$ elide run app.ts",
      `${ESC}[32m✓${ESC}[0m Hello from ${ESC}[1;35mElide${ESC}[0m!`,
      "$ elide install --frozen",
      `${ESC}[2mResolved 42 packages in 118ms${ESC}[0m`,
      `${ESC}[32m+${ESC}[0m react ${ESC}[2m19.3.1${ESC}[0m`,
      `${ESC}[33m!${ESC}[0m 1 optional dependency skipped`,
    ].join("\n"),
  },
  play: async ({ canvasElement }) => {
    const copy = within(canvasElement).getByRole("button", { name: "Copy commands" });
    await expect(copy).toBeInTheDocument();
  },
};

/** Without any prompt, every line is a command (the common docs case). */
export const CommandList: Story = {
  args: { code: "elide install\nelide build \\\n  --release\nelide run app.ts", lang: "bash" },
};

/** A full prompt: user and host title the window; the cwd precedes the glyph. */
export const CustomPrompt: Story = {
  args: {
    prompt: { user: "dev", host: "elide", cwd: "~/app", symbol: "❯" },
    lang: "zsh",
    code: `❯ elide --version\n1.6.2\n❯ elide run server.ts\n${ESC}[36mListening${ESC}[0m on http://localhost:3000`,
  },
};

/** A real asciinema recording of `elide run`. The poster is the final frame; ticks mark each command. */
export const Recording: Story = {
  args: {
    code: "$ elide --version\n$ elide run app.ts",
    recording: { cast: elideRunCast },
  },
};

/** Carriage-return progress bars and erase-line sequences, replayed by the lite VT. */
export const ProgressRecording: Story = {
  args: {
    code: "$ elide run build.ts",
    recording: { cast: elideBuildCast, poster: "last" },
  },
};

/** No recording: the transcript itself is typed out, deterministically for a given seed. */
export const Synthesized: Story = {
  args: {
    code: `$ elide run app.ts\n${ESC}[32m✓${ESC}[0m Hello from ${ESC}[1;35mElide${ESC}[0m!\n$ elide test\n${ESC}[32m12 passed${ESC}[0m ${ESC}[2m(31ms)${ESC}[0m`,
    recording: { synthesize: { seed: 4 } },
  },
};

/** A recording fetched by URL when it nears the viewport; `rows` reserves its height so nothing shifts on load. */
export const RemoteRecording: Story = {
  args: { code: "$ elide run build.ts" },
  // Snapshot after the fetch settles, so Chromatic always captures the poster.
  play: async ({ canvasElement }) => {
    await waitFor(() => expect(canvasElement.querySelector('[data-slot="terminal-recording"] pre[aria-hidden="true"]')).not.toBeNull());
  },
  render: (args) => {
    const src = React.useMemo(() => URL.createObjectURL(new Blob([elideBuildCast], { type: "text/plain" })), []);
    React.useEffect(() => () => URL.revokeObjectURL(src), [src]);
    return (
      <div style={{ maxWidth: 640 }}>
        <Terminal {...args} recording={{ src, rows: 7 }} />
      </div>
    );
  },
};

/** Plays, then seeks to the end and pauses so the snapshot is deterministic. */
export const PlaybackInteraction: Story = {
  args: {
    code: "$ elide --version\n$ elide run app.ts",
    recording: { cast: elideRunCast, poster: "first" },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Play" }));
    await expect(canvas.getByRole("button", { name: "Pause" })).toBeInTheDocument();
    await waitFor(() => expect(Number(canvas.getByRole<HTMLInputElement>("slider").value)).toBeGreaterThan(0));
    await userEvent.click(canvas.getByRole("button", { name: "Pause" }));
    canvas.getByRole("group", { name: "Terminal recording" }).focus();
    await userEvent.keyboard("{End}");
    await expect(canvasElement.querySelector('pre[aria-hidden="true"]')).toHaveTextContent("Hello from Elide!");
  },
};

/** zsh-style highlighting: the command in every pipeline segment stands out from flags, paths, strings and operators. */
export const ShellHighlighting: Story = {
  args: {
    code: [
      'sudo FOO=bar npm install -g --save-dev @elide/ui > install.log 2>&1 && echo "done: $USER"',
      "cat logs/*.txt | grep -v warn | wc -l",
      "elide run --env=production ./scripts/build.ts $(git rev-parse --short HEAD) # tag the build",
    ].join("\n"),
    lang: "zsh",
  },
};

/** Exit status dots, per-command copy (hover or focus a command), linked commands and linked URLs in output. */
export const SessionDetails: Story = {
  args: {
    lines: [
      { kind: "command", text: "elide test", exitCode: 1 },
      { kind: "output", text: `${ESC}[31m✕${ESC}[0m 1 failed, ${ESC}[32m11 passed${ESC}[0m` },
      { kind: "command", text: "elide test --update-snapshots", exitCode: 0 },
      { kind: "output", text: `${ESC}[32m12 passed${ESC}[0m` },
      { kind: "command", text: "elide serve server.ts", exitCode: 0 },
      { kind: "output", text: "Listening on http://localhost:3000" },
    ],
    commandHref: (name: string) => (name === "elide" ? "https://docs.elide.dev/cli" : undefined),
  },
};

/** Long output wraps like a real terminal; the toggle switches to horizontal scrolling. */
export const Wrapping: Story = {
  args: {
    wrap: "toggle",
    code: `$ elide run --allow-net --allow-read=./data --env-file=.env.production ./scripts/import-users-from-legacy-database.ts\n${ESC}[33mwarn${ESC}[0m The legacy table "accounts_v1" has 3 columns without an index; queries over 10,000 rows may be slow (see https://docs.elide.dev/guides/sqlite#indexes).`,
  },
  render: (args) => (
    <div style={{ maxWidth: 420 }}>
      <Terminal {...args} />
    </div>
  ),
};

/** Window chrome per platform. */
export const Chrome: Story = {
  args: { code: "$ elide --version\n1.6.2", prompt: { user: "dev", host: "elide", cwd: "~/app" } },
  render: (args) => (
    <div style={{ maxWidth: 640, display: "grid", gap: 16 }}>
      <Terminal {...args} chrome="mac" />
      <Terminal {...args} chrome="windows" />
      <Terminal {...args} chrome="linux" />
    </div>
  ),
};

/** In an RTL locale the page mirrors, but the terminal stays LTR (chrome, prompt, output). */
export const RightToLeft: Story = {
  args: { code: "$ elide run app.ts\nHello from Elide!", recording: { cast: elideRunCast } },
  render: (args) => (
    <I18nProvider locale="ar" messages={ar} style={{ maxWidth: 640 }}>
      <Terminal {...args} />
    </I18nProvider>
  ),
};

/** Narrow containers scale the recorded terminal grid to fit instead of clipping it. */
export const NarrowRecording: Story = {
  args: { code: "$ elide run build.ts", recording: { cast: elideBuildCast } },
  render: (args) => (
    <div style={{ maxWidth: 320 }}>
      <Terminal {...args} />
    </div>
  ),
};
