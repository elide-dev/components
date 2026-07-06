import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
import { StatusBadge, type ApiStatus } from "../components/status-badge";

const meta = {
  title: "Composites/StatusBadge",
  component: StatusBadge,
  parameters: { layout: "padded" },
} satisfies Meta<typeof StatusBadge>;

export default meta;
type Story = StoryObj<typeof meta>;

const STATUSES: ApiStatus[] = ["implemented", "supported", "partial", "missing", "planned"];

export const AllStatuses: Story = {
  // `status` is required by the component; this story renders the full set itself,
  // so the arg is a placeholder the custom render ignores.
  args: { status: "supported" },
  render: () => (
    <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
      {STATUSES.map((status) => (
        <StatusBadge key={status} status={status} />
      ))}
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Implemented")).toBeInTheDocument();
    await expect(canvas.getByText("Supported")).toBeInTheDocument();
    await expect(canvas.getByText("Partial")).toBeInTheDocument();
    await expect(canvas.getByText("Missing")).toBeInTheDocument();
    await expect(canvas.getByText("Planned")).toBeInTheDocument();
  },
};

export const CustomLabel: Story = {
  args: { status: "supported", label: "31 of 38 methods" },
};
