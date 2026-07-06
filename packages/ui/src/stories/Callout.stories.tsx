import type { Meta, StoryObj } from "@storybook/react-vite";
import { Callout } from "../components/callout";

const meta = {
  title: "Docs/Callout",
  component: Callout,
  parameters: { layout: "centered" },
  argTypes: {
    tone: {
      control: "inline-radio",
      options: ["note", "tip", "important", "warning", "caution"],
    },
  },
} satisfies Meta<typeof Callout>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Note: Story = {
  args: {
    tone: "note",
    children: "The debugger attaches over a WebSocket on 127.0.0.1:4200 by default.",
  },
};

export const AllTones: Story = {
  render: () => (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, width: 560 }}>
      <Callout tone="note">Informational context the reader may want.</Callout>
      <Callout tone="tip">A best practice or shortcut.</Callout>
      <Callout tone="important">Something not to miss.</Callout>
      <Callout tone="warning">A potential foot-gun.</Callout>
      <Callout tone="caution">A dangerous or irreversible action.</Callout>
    </div>
  ),
};
