import type { Meta, StoryObj } from "@storybook/react-vite";
import * as React from "react";
import { expect, userEvent, within } from "storybook/test";
import { ArrowDownToLine, ArrowRight, ChevronRight, History, Plus, SlidersHorizontal } from "lucide-react";
import { Button } from "../components/button";

const meta = {
  title: "Primitives/Button",
  component: Button,
  parameters: { layout: "centered" },
  argTypes: {
    variant: {
      control: "inline-radio",
      options: ["primary", "gradient", "outline", "ghost", "changelog"],
    },
    size: { control: "inline-radio", options: ["sm", "md", "lg", "icon", "icon-sm"] },
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Primary: Story = { args: { children: "Get started" } };
export const Install: Story = { args: { variant: "gradient", children: "Install" } };
export const Changelog: Story = { args: { variant: "changelog", children: "Changelog" } };

/** A product context for reviewing the refreshed hierarchy in both themes. */
export const DesignRefresh: Story = {
  render: () => (
    <div className="mx-auto w-full max-w-5xl py-8 sm:py-16">
      <div className="mb-10 font-mono text-sm text-muted-foreground">
        Elide components
      </div>
      <div className="grid gap-10 md:grid-cols-[1.2fr_1fr] md:items-center">
        <div>
          <h1 className="max-w-lg font-display text-4xl leading-[1.08] font-semibold tracking-tight sm:text-5xl">
            Build with Elide.
          </h1>
          <p className="mt-5 max-w-sm text-sm leading-7 text-muted-foreground">
            Install the runtime, read the docs, or start a project.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Button variant="gradient" size="lg">
              <ArrowDownToLine aria-hidden /> Install Elide
            </Button>
            <Button variant="outline" size="lg">
              Explore the docs <ArrowRight aria-hidden />
            </Button>
          </div>
        </div>
        <div className="rounded-lg border border-border bg-card p-6 shadow-xs sm:p-7">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-mono text-xs text-muted-foreground">Workspace</p>
              <h2 className="mt-2 font-display text-xl font-semibold tracking-tight">Start a project</h2>
            </div>
            <Button variant="ghost" size="icon-sm" aria-label="Workspace settings">
              <SlidersHorizontal aria-hidden />
            </Button>
          </div>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">Create a project or pick up where you left off.</p>
          <div className="my-6 h-px bg-border" />
          <div className="flex flex-wrap items-center gap-2">
            <Button><Plus aria-hidden /> New project</Button>
            <Button variant="changelog"><History aria-hidden /> What’s new</Button>
          </div>
          <div className="mt-5 flex items-center justify-between gap-2">
            <span className="font-mono text-xs text-subtle-foreground">No recent projects</span>
            <Button variant="ghost" size="sm">All projects <ChevronRight aria-hidden /></Button>
          </div>
        </div>
      </div>
      <div className="mt-14 border-t border-border pt-7">
        <h2 className="mb-5 font-mono text-sm text-muted-foreground">Button variants</h2>
        <div className="flex flex-wrap gap-3">
          <Button>Primary</Button>
          <Button variant="gradient">Install</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="changelog">Changelog</Button>
        </div>
      </div>
    </div>
  ),
};

export const AllVariants: Story = {
  render: () => (
    <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
      <Button variant="primary">Primary</Button>
      <Button variant="gradient">Install</Button>
      <Button variant="outline">Outline</Button>
      <Button variant="ghost">Ghost</Button>
      <Button variant="changelog">Changelog</Button>
    </div>
  ),
};

export const Sizes: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-3">
      <Button size="sm">Small</Button>
      <Button size="md">Default</Button>
      <Button size="lg">Get started <ArrowRight aria-hidden /></Button>
      <Button size="icon" aria-label="Add project"><Plus aria-hidden /></Button>
      <Button size="icon-sm" aria-label="Add item"><Plus aria-hidden /></Button>
    </div>
  ),
};

export const Disabled: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-3">
      {(["primary", "gradient", "outline", "ghost", "changelog"] as const).map((variant) => (
        <Button key={variant} variant={variant} disabled>Unavailable</Button>
      ))}
    </div>
  ),
};

export const AsLink: Story = {
  render: () => (
    <Button variant="outline" render={<a href="#installation" />}>
      Installation guide <ArrowRight aria-hidden />
    </Button>
  ),
};

export const Interaction: Story = {
  render: () => {
    const [runs, setRuns] = React.useState(0);
    return (
      <div className="flex max-w-lg flex-col gap-5">
        <h2 className="font-mono text-sm text-muted-foreground">Interaction</h2>
        <p className="text-sm text-muted-foreground">
          Hover, press, and release. Use Tab and Space to try the keyboard controls.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={() => setRuns((count) => count + 1)}>
            Run task <ArrowRight aria-hidden />
          </Button>
          <Button variant="outline" disabled={runs === 0} onClick={() => setRuns(0)}>
            Reset
          </Button>
          <output className="min-w-20 font-mono text-sm tabular-nums text-muted-foreground">
            Runs: {runs}
          </output>
        </div>
      </div>
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const run = canvas.getByRole("button", { name: "Run task" });
    const reset = canvas.getByRole("button", { name: "Reset" });
    await expect(reset).toBeDisabled();
    await userEvent.click(run);
    await expect(canvas.getByRole("status")).toHaveTextContent("Runs: 1");
    await userEvent.keyboard(" ");
    await expect(canvas.getByRole("status")).toHaveTextContent("Runs: 2");
    await userEvent.click(reset);
    await expect(canvas.getByRole("status")).toHaveTextContent("Runs: 0");
    await expect(reset).toBeDisabled();
  },
};
