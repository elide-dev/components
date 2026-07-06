import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
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

export const Terminal: Story = {
  args: {
    variant: "terminal",
    lang: "bash",
    code: "$ elide run app.ts\nHello from Elide!\n$ elide install",
  },
  render: (args) => (
    <div style={{ maxWidth: 640 }}>
      <CodeBlock {...args} />
    </div>
  ),
};
