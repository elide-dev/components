import type { Meta, StoryObj } from "@storybook/react-vite";
import type { CSSProperties } from "react";
import { expect, within } from "storybook/test";
import { BookOpen, Boxes, Database, Globe, Layers, Server } from "lucide-react";
import { CardGrid, FeatureCard } from "../components/card-grid";
import { Badge } from "../components/badge";

const meta = {
  title: "Composites/CardGrid",
  component: CardGrid,
  parameters: { layout: "padded" },
} satisfies Meta<typeof CardGrid>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The "Browse by category" grid from the API Reference landing page. */
export const ApiCategories: Story = {
  render: () => (
    <CardGrid columns={3}>
      <FeatureCard
        href="#api-overview"
        icon={<BookOpen />}
        title="API Overview"
        description="How guest code sees the runtime, globals, and modules."
      />
      <FeatureCard
        href="#node-compatibility"
        icon={<Boxes />}
        title="Node Compatibility"
        description="assert, buffer, crypto, fs, stream, test, and more."
        badge={
          <Badge variant="primary" size="sm">
            24
          </Badge>
        }
      />
      <FeatureCard
        href="#web-standards"
        icon={<Globe />}
        title="Web Standards"
        description="Fetch, Streams, URL, Encoding, Web Crypto, DOM events."
      />
      <FeatureCard
        href="#wintercg"
        icon={<Layers />}
        title="WinterCG"
        description="DOMException, Messaging, Navigator, Performance."
      />
      <FeatureCard
        href="#host-apis"
        icon={<Server />}
        title="Host APIs"
        description="elide:crypto, host filesystem, process, network transport."
      />
      <FeatureCard
        href="https://github.com/elide-dev/elide"
        icon={<Database />}
        title="Database Modules"
        description="Embedded elide:sqlite and friends — no bindings to install."
        external
      />
    </CardGrid>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const nodeCompat = canvas.getByRole("link", { name: /Node Compatibility/ });
    await expect(nodeCompat).toBeInTheDocument();
    await expect(canvas.getByText("24")).toBeInTheDocument();

    const database = canvas.getByRole("link", { name: /Database Modules/ });
    await expect(database).toHaveAttribute("target", "_blank");
    await expect(database.getAttribute("rel")).toContain("noopener");
  },
};

/** The mobile "Start here" list — one column, no icon chip badges. */
export const StartHere: Story = {
  render: () => (
    <CardGrid columns={1} style={{ maxWidth: 360 }}>
      <FeatureCard
        href="#install"
        icon={<BookOpen />}
        title="Install Elide"
        description="Five ways to install"
      />
      <FeatureCard
        href="#run-code"
        icon={<Boxes />}
        title="Run Code"
        description="JS, TS, and Python"
      />
    </CardGrid>
  ),
};

/** The same grid responds to the panel's width, even on a wide viewport. */
export const ContainerWidths: Story = {
  render: () => (
    <div style={{ display: "grid", gap: 24 }}>
      <CardGrid aria-label="Narrow feature panel" style={{ width: "100%", maxWidth: 320 }}>
        <FeatureCard title="Runtime" description="A narrow panel keeps the cards readable." />
        <FeatureCard title="Modules" description="Its host controls the available width." />
        <FeatureCard title="Standards" description="No viewport breakpoint is required." />
      </CardGrid>
      <CardGrid aria-label="Wide feature panel" style={{ width: "100%", maxWidth: 960 }}>
        <FeatureCard title="Runtime" description="The same cards use the available space." />
        <FeatureCard title="Modules" description="Three columns are the upper limit." />
        <FeatureCard title="Standards" description="Card padding follows its container." />
      </CardGrid>
      <CardGrid
        columns={2}
        aria-label="Compact feature panel"
        style={{ width: "100%", maxWidth: 960, "--eld-density": "compact" } as CSSProperties}
      >
        <FeatureCard title="Runtime" description="Compact density is an optional style query." />
        <FeatureCard title="Modules" description="The column limit still applies." />
        <FeatureCard title="Standards" description="Default spacing is the fallback." />
      </CardGrid>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const narrow = canvas.getByLabelText("Narrow feature panel");
    const wide = canvas.getByLabelText("Wide feature panel");
    const compact = canvas.getByLabelText("Compact feature panel");
    const narrowCells = [...narrow.children].map((node) => node.getBoundingClientRect());
    await expect(narrowCells[1].top).toBeGreaterThan(narrowCells[0].bottom);
    await expect(narrow.scrollWidth).toBeLessThanOrEqual(narrow.clientWidth);
    await expect(getComputedStyle(narrow.firstElementChild!).paddingTop).toBe("14px");
    await expect(getComputedStyle(compact.firstElementChild!).paddingTop).toBe("12px");
    if (wide.clientWidth >= 796) {
      const wideCells = [...wide.children].map((node) => node.getBoundingClientRect());
      await expect(wideCells[2].top).toBe(wideCells[0].top);
      const compactCells = [...compact.children].map((node) => node.getBoundingClientRect());
      await expect(compactCells[1].top).toBe(compactCells[0].top);
      await expect(compactCells[2].top).toBeGreaterThan(compactCells[0].bottom);
    }
  },
};
