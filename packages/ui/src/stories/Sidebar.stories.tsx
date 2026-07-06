import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { BookOpen, Code2, Rocket, SquareTerminal, Wrench } from "lucide-react";
import { Sidebar, type SidebarSection } from "../components/sidebar";

const sections: SidebarSection[] = [
  { id: "start", title: "Start", subtitle: "Get running in minutes", icon: <Rocket className="h-4 w-4" /> },
  {
    id: "runtime",
    title: "Runtime",
    subtitle: "Run, serve, debug, and inspect",
    icon: <SquareTerminal className="h-4 w-4" />,
  },
  { id: "toolchain", title: "Toolchain", subtitle: "Build, test, and package", icon: <Wrench className="h-4 w-4" /> },
  { id: "api", title: "API Reference", subtitle: "node:fs, node:http, and more", icon: <Code2 className="h-4 w-4" /> },
  { id: "resources", title: "Resources", subtitle: "Guides, FAQs, and support", icon: <BookOpen className="h-4 w-4" /> },
];

const groups = [
  {
    label: "Getting started",
    items: [
      { label: "Getting Started", href: "#getting-started" },
      { label: "CLI Reference", href: "#cli-reference" },
    ],
  },
  {
    label: "Guides",
    items: [
      { label: "Debugging", href: "#debugging", active: true },
      { label: "Connect an IDE", href: "#connect-ide" },
      { label: "Development Server", href: "#dev-server" },
      { label: "MCP Server", href: "#mcp-server" },
      { label: "REPL", href: "#repl" },
      { label: "Filesystem Sandbox", href: "#fs-sandbox" },
      { label: "Polyglot Interop", href: "#polyglot-interop" },
      { label: "elide.dev", href: "https://elide.dev", external: true },
      { label: "Remote Debugging", comingSoon: true },
    ],
  },
];

const meta = {
  title: "Composites/Sidebar",
  component: Sidebar,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof Sidebar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Runtime: Story = {
  args: {
    sections,
    activeSectionId: "runtime",
    groups,
  },
};

export const SwitchSection: Story = {
  args: {
    sections,
    activeSectionId: "runtime",
    groups,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole("button", { name: /Runtime/ });
    await userEvent.click(trigger);

    // The menu popup portals to document.body, not the story canvas.
    const body = within(document.body);
    await waitFor(() => expect(body.getByRole("menuitem", { name: /^Start/ })).toBeInTheDocument());
    await expect(body.getByRole("menuitem", { name: /Toolchain/ })).toBeInTheDocument();
    await expect(body.getByRole("menuitem", { name: /API Reference/ })).toBeInTheDocument();
    await expect(body.getByRole("menuitem", { name: /Resources/ })).toBeInTheDocument();
  },
};
