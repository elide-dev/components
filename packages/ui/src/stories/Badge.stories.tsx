import type { Meta, StoryObj } from "@storybook/react-vite";
import { Badge } from "../components/badge";

const meta = {
  title: "Primitives/Badge",
  component: Badge,
  parameters: { layout: "centered" },
} satisfies Meta<typeof Badge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ApiStatus: Story = {
  render: () => (
    <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
      <Badge variant="supported" dot>Implemented</Badge>
      <Badge variant="partial" dot>Partial</Badge>
      <Badge variant="missing">Not implemented</Badge>
      <Badge variant="primary">24</Badge>
      <Badge variant="neutral">v1.0.0-beta5</Badge>
    </div>
  ),
};
