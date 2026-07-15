import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "./tabs";

// jsdom does not implement PointerEvent, which Base UI dispatches on click.
if (typeof window.PointerEvent === "undefined") {
  window.PointerEvent = class PointerEvent extends MouseEvent {} as typeof window.PointerEvent;
}

function renderTabs(
  props?: React.ComponentProps<typeof Tabs>,
  listProps?: React.ComponentProps<typeof TabsList>
) {
  return render(
    <Tabs defaultValue="overview" {...props}>
      <TabsList {...listProps}>
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="pricing">Pricing</TabsTrigger>
      </TabsList>
      <TabsContent value="overview">Overview panel</TabsContent>
      <TabsContent value="pricing">Pricing panel</TabsContent>
    </Tabs>
  );
}

describe("Tabs", () => {
  it("renders a tablist with a tab per trigger", () => {
    renderTabs();
    expect(screen.getByRole("tablist")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Overview" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Pricing" })).toBeInTheDocument();
  });

  it("shows the default tab's panel and marks it selected", () => {
    renderTabs();
    expect(screen.getByRole("tab", { name: "Overview" })).toHaveAttribute(
      "aria-selected",
      "true"
    );
    expect(screen.getByRole("tabpanel")).toHaveTextContent("Overview panel");
  });

  it("switches to another tab's panel on click", async () => {
    const user = userEvent.setup();
    renderTabs();

    await user.click(screen.getByRole("tab", { name: "Pricing" }));

    expect(screen.getByRole("tab", { name: "Pricing" })).toHaveAttribute(
      "aria-selected",
      "true"
    );
    expect(screen.getByRole("tabpanel")).toHaveTextContent("Pricing panel");
  });

  it("fires onValueChange with the newly selected value", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    renderTabs({ onValueChange });

    await user.click(screen.getByRole("tab", { name: "Pricing" }));

    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange).toHaveBeenLastCalledWith("pricing", expect.anything());
  });

  it("applies the default TabsList variant", () => {
    renderTabs();
    const list = screen.getByRole("tablist");
    expect(list).toHaveAttribute("data-variant", "default");
    expect(list).toHaveClass("bg-muted");
  });

  it("applies the line TabsList variant", () => {
    renderTabs(undefined, { variant: "line" });
    const list = screen.getByRole("tablist");
    expect(list).toHaveAttribute("data-variant", "line");
    expect(list).toHaveClass("bg-transparent");
  });

  it("carries the tabs data-slot", () => {
    const { container } = renderTabs();
    expect(container.querySelector('[data-slot="tabs"]')).toBeInTheDocument();
    expect(container.querySelector('[data-slot="tabs-trigger"]')).toBeInTheDocument();
  });
});
