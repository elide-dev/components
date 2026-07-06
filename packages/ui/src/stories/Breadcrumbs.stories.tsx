import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
import { Breadcrumbs } from "../components/breadcrumbs";

const meta = {
  title: "Composites/Breadcrumbs",
  component: Breadcrumbs,
  parameters: { layout: "centered" },
} satisfies Meta<typeof Breadcrumbs>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    segments: [
      { label: "Runtime", href: "#runtime" },
      { label: "Guides", href: "#guides" },
      { label: "Debugging" },
    ],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // All segments render; getByText/getByRole throw if absent (implicit assertion).
    const current = canvas.getByText("Debugging");
    await expect(current.getAttribute("aria-current")).toBe("page");
    const runtime = canvas.getByRole("link", { name: "Runtime" });
    await expect(runtime.getAttribute("href")).toBe("#runtime");
  },
};
