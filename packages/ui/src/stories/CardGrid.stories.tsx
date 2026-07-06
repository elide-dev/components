import type { Meta, StoryObj } from "@storybook/react-vite";
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
