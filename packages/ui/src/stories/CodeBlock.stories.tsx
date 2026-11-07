import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";
import { releaseFocus } from "./fixtures/focus";
import { CodeBlock } from "../components/code-block";
import { twoslashSample } from "./fixtures/twoslash";

const meta = {
  title: "Docs/CodeBlock",
  component: CodeBlock,
  parameters: { layout: "padded" },
} satisfies Meta<typeof CodeBlock>;

export default meta;
type Story = StoryObj<typeof meta>;

const tsSource = `import { Database } from "elide:sqlite";

const db = new Database(":memory:");
db.exec("CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT)");

const user = db.prepare<{ id: number; name: string }>(
  "SELECT * FROM users WHERE id = ?",
).get(1);
console.log(\`Hello from \${user.name}!\`);`;

// Code is highlighted from `lang` by a lazily loaded Shiki chunk (preloaded by
// the Storybook loader, as a docs site would), themed via --eld-syntax-*.
export const Editor: Story = {
  args: {
    variant: "editor",
    filename: "app.ts",
    lang: "ts",
    code: tsSource,
  },
  render: (args) => (
    <div style={{ maxWidth: 640 }}>
      <CodeBlock {...args} />
    </div>
  ),
  // The icon-only copy button must have an accessible name (regression guard for
  // the empty aria-label a11y violation).
  play: async ({ canvasElement }) => {
    const copy = within(canvasElement).getByRole("button", { name: "Copy" });
    await expect(copy.getAttribute("aria-label")).toBe("Copy");
  },
};

/** Decorations live in the gutter grid: highlight, diff, breakpoints and the current line. */
export const Decorations: Story = {
  args: {
    filename: "app.ts",
    lang: "ts",
    code: tsSource,
    decorations: [
      { line: 1, kind: "highlight" },
      { line: 3, kind: "breakpoint" },
      { line: 4, kind: "remove" },
      { line: 5, kind: "add" },
      { line: 6, kind: "cursor" },
      { line: 9, kind: "warning", label: "Unchecked result" },
    ],
  },
  render: (args) => (
    <div style={{ maxWidth: 640 }}>
      <CodeBlock {...args} />
    </div>
  ),
};

const longSource = `const greeting = await fetch("https://api.example.com/v1/users/1?include=profile,settings,permissions&format=json").then((response) => response.json());
console.log(greeting);`;

/** Long lines scroll by default (the gutter stays put); the toggle soft-wraps with a hanging indent. */
export const LongLines: Story = {
  args: { filename: "fetch.ts", lang: "ts", code: longSource, wrap: "toggle", statusBar: false },
  render: (args) => (
    <div style={{ maxWidth: 480 }}>
      <CodeBlock {...args} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const toggle = canvas.getByRole("button", { name: "Wrap lines" });
    await userEvent.click(toggle);
    await expect(toggle).toHaveAttribute("aria-pressed", "true");
    // Snapshot the resting state, not a focused control.
    releaseFocus();
  },
};

/** An excerpt numbered from its place in the file, without the status bar. */
export const Excerpt: Story = {
  args: { filename: "app.ts", lang: "ts", code: tsSource.split("\n").slice(5).join("\n"), startLine: 6, statusBar: false },
  render: (args) => (
    <div style={{ maxWidth: 640 }}>
      <CodeBlock {...args} />
    </div>
  ),
};

/** Without line numbers. */
export const Plain: Story = {
  args: { lang: "ts", code: tsSource, lineNumbers: false, statusBar: false, filename: "app.ts" },
  render: (args) => (
    <div style={{ maxWidth: 640 }}>
      <CodeBlock {...args} />
    </div>
  ),
};

/** Window chrome per platform. `chrome="auto"` follows the viewer's OS when the page runs `codeChromeScript`. */
export const Chrome: Story = {
  args: { lang: "ts", code: "console.log(1);", filename: "app.ts", statusBar: false },
  render: (args) => (
    <div style={{ maxWidth: 640, display: "grid", gap: 16 }}>
      <CodeBlock {...args} chrome="mac" />
      <CodeBlock {...args} chrome="windows" />
      <CodeBlock {...args} chrome="linux" />
      <CodeBlock {...args} chrome="none" />
    </div>
  ),
};

/** Build-time Shiki + Twoslash output: hover or focus an identifier to see its real type. */
export const TypeHovers: Story = {
  args: { ...twoslashSample, filename: "app.ts", statusBar: false },
  render: (args) => (
    <div style={{ maxWidth: 680 }}>
      <CodeBlock {...args} />
    </div>
  ),
};

/** `[!code …]` notation comments: diff, highlight, focus and word marks, stripped from the text and from copy. */
export const Notations: Story = {
  args: {
    filename: "server.ts",
    lang: "ts",
    statusBar: false,
    code: `import { serve } from "elide:http";
// [!code word:handler]
const handler = (request: Request) => {
  return new Response("Hello"); // [!code --]
  return Response.json({ hello: "elide" }); // [!code ++]
};

serve({ port: 3000, handler }); // [!code focus]`,
  },
  render: (args) => (
    <div style={{ maxWidth: 640 }}>
      <CodeBlock {...args} />
    </div>
  ),
};

/** Several files behind tabs in the title bar (arrow keys move between them). */
export const Files: Story = {
  args: {
    statusBar: true,
    files: [
      { name: "app.ts", lang: "ts", code: `import { greet } from "./greet.py";\n\nconsole.log(greet("Elide"));` },
      { name: "greet.py", lang: "py", code: `def greet(name: str) -> str:\n    return f"Hello, {name}!"` },
      { name: "elide.pkl", lang: "pkl", code: `amends "elide:project.pkl"\n\nname = "polyglot-demo"` },
    ],
  },
  render: (args) => (
    <div style={{ maxWidth: 640 }}>
      <CodeBlock {...args} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("tab", { name: "greet.py" }));
    await expect(canvas.getByRole("tab", { name: "greet.py" })).toHaveAttribute("aria-selected", "true");
    // Snapshot the resting state, not a focused control.
    releaseFocus();
  },
};

/** A code tour: numbered badges link lines to notes; line numbers are permalinks. */
export const Annotated: Story = {
  args: {
    filename: "app.ts",
    lang: "ts",
    code: tsSource,
    statusBar: false,
    lineLinks: true,
    annotations: [
      { line: 1, content: "Elide ships SQLite as a built-in module; no native addon to install." },
      { line: 3, content: "An in-memory database: perfect for tests and samples." },
      { line: 6, content: "Statements are typed through the generic parameter." },
    ],
  },
  render: (args) => (
    <div style={{ maxWidth: 640 }}>
      <CodeBlock {...args} />
    </div>
  ),
};

/** Long samples collapse to `maxLines`; `fold` ranges hide boilerplate behind a button. */
export const Collapsed: Story = {
  args: {
    filename: "app.ts",
    lang: "ts",
    statusBar: false,
    maxLines: 6,
    decorations: [{ line: { start: 2, end: 5 }, kind: "fold" }],
    code: `${tsSource}\n\nfor (const row of db.prepare("SELECT * FROM users").all()) {\n  console.log(row);\n}\n\ndb.close();`,
  },
  render: (args) => (
    <div style={{ maxWidth: 640 }}>
      <CodeBlock {...args} />
    </div>
  ),
};

/** A captioned figure with an extra title-bar action. */
export const Captioned: Story = {
  args: {
    filename: "app.ts",
    lang: "ts",
    code: 'console.log("Hello from Elide!");',
    statusBar: false,
    highlight: "1",
    caption: "Run it with elide run app.ts — no build step.",
  },
  render: (args) => (
    <div style={{ maxWidth: 640 }}>
      <CodeBlock {...args} />
    </div>
  ),
};
