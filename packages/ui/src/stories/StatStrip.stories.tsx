import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
import { StatStrip } from "../components/stat-strip";

const meta = {
  title: "Composites/StatStrip",
  component: StatStrip,
  parameters: { layout: "padded" },
} satisfies Meta<typeof StatStrip>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ApiCompatibility: Story = {
  args: {
    stats: [
      { value: "24", label: "Node modules" },
      { value: "94%", label: "Test262 pass rate", emphasis: true },
      { value: "89%", label: "WinterTC coverage" },
    ],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("24")).toBeInTheDocument();
    await expect(canvas.getByText("Node modules")).toBeInTheDocument();
    const testPassRate = canvas.getByText("94%");
    await expect(testPassRate).toBeInTheDocument();
    await expect(testPassRate).toHaveClass("text-[var(--primary)]");
  },
};

export const FourColumns: Story = {
  args: {
    stats: [
      { value: "6", label: "API surfaces" },
      { value: "312", label: "Test suites" },
      { value: "1.2M", label: "Downloads/mo" },
      { value: "0", label: "Native bindings" },
    ],
  },
};
