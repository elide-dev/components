import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { CopyCommand } from "../components/copy-command";

const meta = {
  title: "Composites/CopyCommand",
  component: CopyCommand,
  parameters: { layout: "padded" },
} satisfies Meta<typeof CopyCommand>;

export default meta;
type Story = StoryObj<typeof meta>;

export const InstallOneLiner: Story = {
  args: {
    command: "curl elide.sh | bash",
  },
  render: (args) => (
    <div style={{ maxWidth: 420 }}>
      <CopyCommand {...args} />
    </div>
  ),
};

// Labeled variant makes the copied/uncopied state visible as text, so the
// interaction test below can assert on it directly.
export const WithLabel: Story = {
  args: {
    command: "curl elide.sh | bash",
    label: "Copy",
  },
  render: (args) => (
    <div style={{ maxWidth: 420 }}>
      <CopyCommand {...args} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole("button", { name: "Copy" });

    await userEvent.click(button);

    await waitFor(() => expect(canvas.getByRole("button", { name: "Copied" })).toBeInTheDocument());
  },
};
