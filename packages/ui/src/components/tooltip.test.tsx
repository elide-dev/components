import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect } from "vitest";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "./tooltip";

function renderTooltip(contentClassName?: string) {
  return render(
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger>Hover me</TooltipTrigger>
        <TooltipContent className={contentClassName}>Helpful hint</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

describe("Tooltip", () => {
  it("does not render its content until the trigger is hovered", () => {
    renderTooltip();
    expect(screen.queryByText("Helpful hint")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Hover me" })).toBeInTheDocument();
  });

  it("shows the tooltip content on hover", async () => {
    const user = userEvent.setup();
    renderTooltip();

    await user.hover(screen.getByRole("button", { name: "Hover me" }));

    expect(await screen.findByText("Helpful hint")).toBeInTheDocument();
  });

  it("hides the tooltip content when the pointer leaves", async () => {
    const user = userEvent.setup();
    renderTooltip();
    const trigger = screen.getByRole("button", { name: "Hover me" });

    await user.hover(trigger);
    expect(await screen.findByText("Helpful hint")).toBeInTheDocument();

    await user.unhover(trigger);
    // Content leaves the DOM once the close animation/state settles.
    expect(screen.queryByText("Helpful hint")).not.toBeInTheDocument();
  });

  it("reveals the tooltip on keyboard focus of the trigger", async () => {
    const user = userEvent.setup();
    renderTooltip();

    await user.tab();
    expect(screen.getByRole("button", { name: "Hover me" })).toHaveFocus();
    expect(await screen.findByText("Helpful hint")).toBeInTheDocument();
  });

  it("merges a consumer className onto the popup content", async () => {
    const user = userEvent.setup();
    renderTooltip("custom-tooltip");

    await user.hover(screen.getByRole("button", { name: "Hover me" }));

    const content = await screen.findByText("Helpful hint");
    expect(content.closest("[data-slot=tooltip-content]")).toHaveClass("custom-tooltip");
  });

  it("exposes data-slot attributes on the trigger and content", async () => {
    const user = userEvent.setup();
    renderTooltip();
    const trigger = screen.getByRole("button", { name: "Hover me" });
    expect(trigger).toHaveAttribute("data-slot", "tooltip-trigger");

    await user.hover(trigger);
    const content = await screen.findByText("Helpful hint");
    expect(content).toHaveAttribute("data-slot", "tooltip-content");
  });
});
