import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { AppNav } from "../components/app-nav";

const meta = {
  title: "Composites/AppNav",
  component: AppNav,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof AppNav>;

export default meta;
type Story = StoryObj<typeof meta>;

const links = [
  { label: "Docs", href: "#docs", active: true },
  { label: "Enterprise", href: "#enterprise" },
  { label: "Blog", href: "#blog" },
  { label: "Pricing", href: "#pricing" },
];

export const Default: Story = {
  args: {
    links,
    onSearchClick: fn(),
    onThemeToggle: fn(),
    onLocaleClick: fn(),
  },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByRole("link", { name: "Docs" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await expect(canvas.getByRole("link", { name: "Enterprise" })).not.toHaveAttribute(
      "aria-current",
    );

    await userEvent.click(canvas.getByRole("button", { name: "Search" }));
    await expect(args.onSearchClick).toHaveBeenCalledTimes(1);
  },
};

export const CustomLocale: Story = {
  args: {
    links,
    locale: "FR",
    searchPlaceholder: "Rechercher ou demander à l'IA…",
  },
};
