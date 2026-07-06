import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
import { CodeBlock } from "../components/code-block";

const S = ({ c, children }: { c: string; children: React.ReactNode }) => (
  <span style={{ color: `var(--eld-syntax-${c})` }}>{children}</span>
);

const meta = {
  title: "Docs/CodeBlock",
  component: CodeBlock,
  parameters: { layout: "padded" },
} satisfies Meta<typeof CodeBlock>;

export default meta;
type Story = StoryObj<typeof meta>;

const sqlite = `const { Database } = require("sqlite");

const db = new Database(":memory:");
db.exec("CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT)");

const user = db.prepare("SELECT * FROM users WHERE id = 1").get();
console.log(\`Hello from \${user.name}!\`);`;

export const Editor: Story = {
  args: {
    variant: "editor",
    filename: "app.js",
    lang: "js",
    code: sqlite,
  },
  render: (args) => (
    <div style={{ maxWidth: 640 }}>
      <CodeBlock {...args}>
        <S c="keyword">const</S> {"{ "}
        <S c="type">Database</S>
        {" } "}
        <S c="keyword">=</S> <S c="function">require</S>(<S c="string">"sqlite"</S>);
        {"\n\n"}
        <S c="keyword">const</S> db <S c="keyword">=</S> <S c="keyword">new</S>{" "}
        <S c="type">Database</S>(<S c="string">":memory:"</S>);{"\n"}
        db.<S c="function">exec</S>(
        <S c="string">"CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT)"</S>);{"\n\n"}
        <S c="keyword">const</S> user <S c="keyword">=</S> db.
        <S c="function">prepare</S>(<S c="string">"SELECT * FROM users WHERE id = 1"</S>).
        <S c="function">get</S>();{"\n"}
        console.<S c="function">log</S>(<S c="string">{"`Hello from ${user.name}!`"}</S>);
      </CodeBlock>
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
    code: "$ elide app.ts\nHello from Elide!",
  },
  render: (args) => (
    <div style={{ maxWidth: 640 }}>
      <CodeBlock {...args}>
        <S c="comment">$</S> elide app.ts{"\n"}
        <span style={{ color: "#3fb950" }}>Hello from Elide!</span>
      </CodeBlock>
    </div>
  ),
};
