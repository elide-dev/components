import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button } from "../components/button";

const meta = {
  title: "Primitives/Button",
  component: Button,
  parameters: { layout: "centered" },
  argTypes: {
    variant: {
      control: "inline-radio",
      options: ["primary", "gradient", "outline", "ghost", "changelog"],
    },
    size: { control: "inline-radio", options: ["sm", "md", "icon"] },
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Primary: Story = { args: { children: "Get started" } };
export const Install: Story = { args: { variant: "gradient", children: "Install" } };
export const Changelog: Story = { args: { variant: "changelog", children: "Changelog" } };

export const AllVariants: Story = {
  render: () => (
    <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
      <Button variant="primary">Primary</Button>
      <Button variant="gradient">Install</Button>
      <Button variant="outline">Outline</Button>
      <Button variant="ghost">Ghost</Button>
      <Button variant="changelog">Changelog</Button>
    </div>
  ),
};
