import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";
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
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole("button", { name: "Copy" });
    const clipboardOwner = canvasElement.ownerDocument.defaultView!.navigator;
    const descriptor = Object.getOwnPropertyDescriptor(clipboardOwner, "clipboard");
    // setup() supplies a clipboard stub. Synthetic clicks cannot grant Safari's
    // native clipboard permission, so test the copy contract independently.
    const user = userEvent.setup({ document: canvasElement.ownerDocument });

    try {
      await user.click(button);
      await expect(await clipboardOwner.clipboard.readText()).toBe(args.command);
      await expect(await canvas.findByRole("button", { name: "Copied" })).toBeInTheDocument();
    } finally {
      if (descriptor) Object.defineProperty(clipboardOwner, "clipboard", descriptor);
      else Reflect.deleteProperty(clipboardOwner, "clipboard");
    }
  },
};
