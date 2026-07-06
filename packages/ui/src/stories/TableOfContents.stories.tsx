import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
import { TableOfContents } from "../components/table-of-contents";

const meta = {
  title: "Composites/TableOfContents",
  component: TableOfContents,
  parameters: { layout: "padded" },
} satisfies Meta<typeof TableOfContents>;

export default meta;
type Story = StoryObj<typeof meta>;

const items = [
  { id: "overview", label: "Overview" },
  { id: "installation", label: "Installation" },
  { id: "quickstart", label: "Quickstart" },
  { id: "configuration", label: "Configuration" },
  { id: "faq", label: "FAQ" },
];

export const Default: Story = {
  args: {
    items,
    // Controlled here so the story renders deterministically without a real
    // scrollable page for IntersectionObserver to spy on.
    activeId: "installation",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const active = canvas.getByRole("link", { name: "Installation" });
    await expect(active.getAttribute("aria-current")).toBe("location");
    const inactive = canvas.getByRole("link", { name: "Overview" });
    await expect(inactive.getAttribute("aria-current")).toBe(null);
  },
};

const methodItems = [
  { id: "readfile", label: "readFile()" },
  { id: "writefile", label: "writeFile()" },
  { id: "mkdir", label: "mkdir()" },
  { id: "rmdir", label: "rmdir()", depth: 1 },
];

export const Mono: Story = {
  args: {
    items: methodItems,
    activeId: "writefile",
    variant: "mono",
    title: "Methods",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const active = canvas.getByRole("link", { name: "writeFile()" });
    await expect(active.getAttribute("aria-current")).toBe("location");
  },
};
