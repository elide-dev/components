import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, screen, userEvent, within } from "storybook/test";
import { Compass } from "lucide-react";
import { MobileNav } from "../components/mobile-nav";

const meta = {
  title: "Composites/MobileNav",
  component: MobileNav,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof MobileNav>;

export default meta;
type Story = StoryObj<typeof meta>;

const groups = [
  {
    label: "Introduction",
    items: [
      { label: "Overview", href: "#overview", active: true },
      { label: "Install Elide", href: "#install" },
      { label: "Run your first script", href: "#first-script" },
    ],
  },
  {
    label: "By language",
    items: [
      { label: "Java & Kotlin", href: "#jvm" },
      { label: "Python", href: "#python" },
      { label: "JavaScript & TypeScript", href: "#js" },
    ],
  },
];

export const Default: Story = {
  args: {
    groups,
    section: {
      title: "Start",
      subtitle: "Get running in minutes",
      icon: <Compass aria-hidden className="h-4 w-4" />,
    },
    logo: <span className="text-sm font-semibold text-foreground">Elide</span>,
    changelogHref: "#changelog",
    onSearch: fn(),
  },
  render: (args) => (
    <div className="h-[640px]">
      <MobileNav {...args} className="h-full" />
    </div>
  ),
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);

    // Bottom "Search or ask" bar fires onSearch.
    await userEvent.click(canvas.getByRole("button", { name: /search or ask/i }));
    await expect(args.onSearch).toHaveBeenCalledTimes(1);

    // Sheet portals the drawer to document.body, so query there once open.
    await userEvent.click(canvas.getByRole("button", { name: "Open navigation" }));
    const body = within(document.body);
    await expect(body.getByRole("link", { name: "Overview" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await expect(body.getByRole("link", { name: "Java & Kotlin" })).toBeInTheDocument();
    await expect(screen.getByRole("navigation", { name: "Mobile navigation" })).toBeInTheDocument();
  },
};
