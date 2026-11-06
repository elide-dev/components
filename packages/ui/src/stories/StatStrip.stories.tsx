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
    await expect(testPassRate).toHaveClass("text-[var(--primary-emphasis)]");
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

/** Column counts are caps: cells wrap inside a narrow host without overflow. */
export const ContainerWidths: Story = {
  args: {
    stats: [
      { value: "24", label: "Node modules" },
      { value: "94%", label: "Test262 pass rate", emphasis: true },
      { value: "89%", label: "WinterTC coverage" },
    ],
  },
  render: (args) => (
    <div style={{ display: "grid", gap: 24 }}>
      <StatStrip {...args} aria-label="Narrow statistics" style={{ width: "100%", maxWidth: 300 }} />
      <StatStrip {...args} aria-label="Wide statistics" style={{ width: "100%", maxWidth: 900 }} />
      <StatStrip {...args} columns={2} aria-label="Two column statistics" style={{ width: "100%", maxWidth: 900 }} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const narrow = canvas.getByLabelText("Narrow statistics");
    const wide = canvas.getByLabelText("Wide statistics");
    const capped = canvas.getByLabelText("Two column statistics");
    const narrowCells = [...narrow.children].map((node) => node.getBoundingClientRect());
    await expect(narrowCells[1].top).toBeGreaterThan(narrowCells[0].bottom);
    await expect(narrow.scrollWidth).toBeLessThanOrEqual(narrow.clientWidth);
    await expect(getComputedStyle(narrow.firstElementChild!).paddingTop).toBe("16px");
    if (wide.clientWidth >= 530) {
      const wideCells = [...wide.children].map((node) => node.getBoundingClientRect());
      await expect(wideCells[2].top).toBe(wideCells[0].top);
      const cappedCells = [...capped.children].map((node) => node.getBoundingClientRect());
      await expect(cappedCells[1].top).toBe(cappedCells[0].top);
      await expect(cappedCells[2].top).toBeGreaterThan(cappedCells[0].bottom);
    }
  },
};
