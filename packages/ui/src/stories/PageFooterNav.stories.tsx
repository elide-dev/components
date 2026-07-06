import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
import { PageFooterNav } from "../components/page-footer-nav";

const meta = {
  title: "Composites/PageFooterNav",
  component: PageFooterNav,
  parameters: { layout: "padded" },
} satisfies Meta<typeof PageFooterNav>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Both: Story = {
  args: {
    prev: { label: "Getting Started", href: "#prev" },
    next: { label: "Connect an IDE", href: "#next" },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByRole("link", { name: /Getting Started/ }).getAttribute("href"),
    ).toBe("#prev");
    await expect(
      canvas.getByRole("link", { name: /Connect an IDE/ }).getAttribute("href"),
    ).toBe("#next");
  },
};

export const NextOnly: Story = {
  args: {
    next: { label: "Connect an IDE", href: "#next" },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.queryByText("Previous")).toBe(null);
    await expect(
      canvas.getByRole("link", { name: /Connect an IDE/ }).getAttribute("href"),
    ).toBe("#next");
  },
};
