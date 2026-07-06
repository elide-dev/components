import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { SectionTabs } from "../components/section-tabs";

const meta = {
  title: "Composites/SectionTabs",
  component: SectionTabs,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof SectionTabs>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Runtime: Story = {
  args: {
    items: [
      { label: "Start", href: "#start" },
      { label: "Runtime", href: "#runtime", active: true },
      { label: "Toolchain", href: "#toolchain" },
      { label: "API Reference", href: "#api" },
      { label: "Resources", href: "#resources" },
    ],
    version: { label: "v1.0.0-beta5", status: "ok" },
    onSelect: fn(),
  },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByRole("link", { name: "Runtime" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await expect(canvas.getByRole("link", { name: "Start" })).not.toHaveAttribute(
      "aria-current",
    );

    await userEvent.click(canvas.getByRole("link", { name: "Toolchain" }));
    await expect(args.onSelect).toHaveBeenCalledWith("#toolchain");
  },
};

export const ApiReference: Story = {
  args: {
    items: [
      { label: "Start", href: "#start" },
      { label: "Runtime", href: "#runtime" },
      { label: "Toolchain", href: "#toolchain" },
      { label: "API Reference", href: "#api", active: true },
      { label: "Resources", href: "#resources" },
    ],
    version: { label: "v1.0.0-beta5", status: "ok" },
  },
};
