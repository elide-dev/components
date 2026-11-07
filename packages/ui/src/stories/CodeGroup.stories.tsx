import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";
import { releaseFocus } from "./fixtures/focus";
import { CodeBlock } from "../components/code-block";
import { CodeGroup } from "../components/code-group";
import { Terminal } from "../components/terminal";

const meta = {
  title: "Docs/CodeGroup",
  component: CodeGroup,
  parameters: { layout: "padded" },
} satisfies Meta<typeof CodeGroup>;

export default meta;
type Story = StoryObj<typeof meta>;

const install = (key: string) => (
  <CodeGroup syncKey={key}>
    <Terminal title="bun" code="bun add @elide/ui @elide/tokens" />
    <Terminal title="npm" code="npm install @elide/ui @elide/tokens" />
    <Terminal title="pnpm" code="pnpm add @elide/ui @elide/tokens" />
  </CodeGroup>
);

/** Groups sharing a `syncKey` switch together and remember the reader's choice. */
export const SyncedPackageManagers: Story = {
  args: { children: null },
  render: () => (
    <div style={{ maxWidth: 640, display: "grid", gap: 24 }}>
      {install("story-pm")}
      {install("story-pm")}
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getAllByRole("tab", { name: "pnpm" })[0]);
    for (const tab of canvas.getAllByRole("tab", { name: "pnpm" })) await expect(tab).toHaveAttribute("aria-selected", "true");
    // Leave the default selected so the snapshot is stable.
    await userEvent.click(canvas.getAllByRole("tab", { name: "bun" })[0]);
    // Snapshot the resting state, not a focused control.
    releaseFocus();
  },
};

/** The same program in several languages. */
export const Languages: Story = {
  args: { children: null },
  render: () => (
    <div style={{ maxWidth: 640 }}>
      <CodeGroup>
        <CodeBlock filename="hello.ts" lang="ts" statusBar={false} code={'console.log("Hello from Elide!");'} />
        <CodeBlock filename="hello.py" lang="py" statusBar={false} code={'print("Hello from Elide!")'} />
        <CodeBlock filename="Hello.kt" lang="kt" statusBar={false} code={'fun main() = println("Hello from Elide!")'} />
      </CodeGroup>
    </div>
  ),
};
