import type { Meta, StoryObj } from "@storybook/react-vite";
import { CodeBlock } from "../components/code-block";
import { CodeSample } from "../components/code-sample";
import { Terminal } from "../components/terminal";
import { elideRunCast, elideRunSource } from "./fixtures/casts";

const meta = {
  title: "Docs/CodeSample",
  component: CodeSample,
  parameters: { layout: "padded" },
} satisfies Meta<typeof CodeSample>;

export default meta;
type Story = StoryObj<typeof meta>;

const surfaces = [
  <CodeBlock key="code" filename="app.ts" lang="ts" code={elideRunSource} statusBar={false} />,
  <Terminal key="run" code={"$ elide run app.ts"} recording={{ cast: elideRunCast }} />,
];

/** Source above, the recorded run below. */
export const Below: Story = {
  args: { layout: "below", children: surfaces },
  render: (args) => (
    <div style={{ maxWidth: 680 }}>
      <CodeSample {...args} />
    </div>
  ),
};

/** Side by side once the sample's own container is 48rem wide; stacked when narrower. */
export const Beside: Story = {
  args: { layout: "beside", children: surfaces },
  render: (args) => (
    <div style={{ maxWidth: 1240 }}>
      <CodeSample {...args} />
    </div>
  ),
};

/** One tab per surface, labeled from each child's filename or title. */
export const Tabs: Story = {
  args: { layout: "tabs", children: surfaces },
  render: (args) => (
    <div style={{ maxWidth: 680 }}>
      <CodeSample {...args} />
    </div>
  ),
};
