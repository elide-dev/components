import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";
import { releaseFocus } from "./fixtures/focus";
import { CodeScene } from "../components/code-scene";
import { coverageScene, hotspotScene, insightHooksScene, polyglotDebugScene } from "./fixtures/scenes";

const meta = {
  title: "Docs/CodeScene",
  component: CodeScene,
  parameters: { layout: "padded" },
  render: (args) => (
    <div style={{ maxWidth: 720 }}>
      <CodeScene {...args} />
    </div>
  ),
} satisfies Meta<typeof CodeScene>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Step a debugger from TypeScript into Kotlin and Python: the file tab, arrow, locals and call stack follow execution. */
export const PolyglotDebugging: Story = {
  args: { scene: polyglotDebugScene, terminalCommand: "elide run app.ts" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const next = canvas.getByRole("button", { name: "Next step" });
    await userEvent.click(next);
    await userEvent.click(next);
    // Now inside Kotlin: its tab is selected and the stack shows both languages.
    await expect(canvas.getByRole("tab", { name: "Greeter.kt" })).toHaveAttribute("aria-selected", "true");
    await expect(canvas.getByRole("region", { name: "Call stack" })).toHaveTextContent("greet");
    await expect(canvas.getByRole("region", { name: "Call stack" })).toHaveTextContent("TypeScript");
    await userEvent.click(next);
    await expect(canvas.getByRole("tab", { name: "format.py" })).toHaveAttribute("aria-selected", "true");
    // Snapshot the resting state, not a focused control.
    releaseFocus();
  },
};

/** Lines flash as hooks observe a request, with the server log alongside. */
export const InsightHooks: Story = {
  args: { scene: insightHooksScene, terminalCommand: "elide serve server.ts", initialStep: 1 },
};

/** Coverage fills in test by test: covered, partial and uncovered lines on the gutter edge. */
export const CoverageRun: Story = {
  args: { scene: coverageScene, terminalCommand: "elide test --coverage", initialStep: 3 },
  play: async ({ canvasElement }) => {
    await expect(canvasElement).toHaveTextContent("Line coverage 100%");
    await expect(canvasElement.querySelectorAll('[data-coverage="partial"]')).toHaveLength(2);
  },
};

/** Profiler samples heat up the hot line; the share of samples is shown at the line's end. */
export const Hotspots: Story = {
  args: { scene: hotspotScene, terminalCommand: "elide run --profile render.ts", initialStep: 2 },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector('[data-heat="4"]')).toHaveTextContent("toLocaleString");
  },
};
