import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";
import { CodeBlock } from "../components/code-block";

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

// Code is syntax-highlighted by the component from `lang` (Prism, themed via the
// --eld-syntax-* tokens) — stories just pass raw source.
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
