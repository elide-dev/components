import type { Meta, StoryObj } from "@storybook/react-vite";
import { Switch } from "../components/switch";

const meta = {
  title: "Primitives/Switch",
  component: Switch,
  args: { "aria-label": "Notifications" },
  parameters: { layout: "centered" },
} satisfies Meta<typeof Switch>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Off: Story = {};
export const On: Story = { args: { defaultChecked: true } };
