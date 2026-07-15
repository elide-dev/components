import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverDescription,
} from "./popover";

function renderPopover(props?: {
  onOpenChange?: (open: boolean) => void;
  contentClassName?: string;
}) {
  return render(
    <Popover onOpenChange={props?.onOpenChange}>
      <PopoverTrigger>Open popover</PopoverTrigger>
      <PopoverContent className={props?.contentClassName}>
        <PopoverHeader>
          <PopoverTitle>Notifications</PopoverTitle>
          <PopoverDescription>You have no new alerts.</PopoverDescription>
        </PopoverHeader>
      </PopoverContent>
    </Popover>
  );
}

describe("Popover", () => {
  it("does not render its content until opened", () => {
    renderPopover();
    expect(screen.queryByText("You have no new alerts.")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open popover" })).toBeInTheDocument();
  });

  it("opens the content on trigger click", async () => {
    const user = userEvent.setup();
    renderPopover();

    await user.click(screen.getByRole("button", { name: "Open popover" }));

    expect(screen.getByText("Notifications")).toBeInTheDocument();
    expect(screen.getByText("You have no new alerts.")).toBeInTheDocument();
  });

  it("closes when Escape is pressed", async () => {
    const user = userEvent.setup();
    renderPopover();
    await user.click(screen.getByRole("button", { name: "Open popover" }));
    expect(screen.getByText("Notifications")).toBeInTheDocument();

    await user.keyboard("{Escape}");

    expect(screen.queryByText("Notifications")).not.toBeInTheDocument();
  });

  it("fires onOpenChange when opening and closing", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    renderPopover({ onOpenChange });

    await user.click(screen.getByRole("button", { name: "Open popover" }));
    expect(onOpenChange.mock.lastCall?.[0]).toBe(true);

    await user.keyboard("{Escape}");
    expect(onOpenChange.mock.lastCall?.[0]).toBe(false);
  });

  it("merges a consumer className onto the popup content", async () => {
    const user = userEvent.setup();
    renderPopover({ contentClassName: "custom-popover" });
    await user.click(screen.getByRole("button", { name: "Open popover" }));

    expect(screen.getByText("Notifications").closest("[data-slot=popover-content]")).toHaveClass(
      "custom-popover"
    );
  });

  it("exposes data-slot attributes on rendered parts", async () => {
    const user = userEvent.setup();
    renderPopover();
    await user.click(screen.getByRole("button", { name: "Open popover" }));

    expect(screen.getByText("Notifications")).toHaveAttribute("data-slot", "popover-title");
    expect(screen.getByText("You have no new alerts.")).toHaveAttribute(
      "data-slot",
      "popover-description"
    );
  });

  it("marks the trigger with data-slot and toggles its expanded state", async () => {
    const user = userEvent.setup();
    renderPopover();
    const trigger = screen.getByRole("button", { name: "Open popover" });
    expect(trigger).toHaveAttribute("data-slot", "popover-trigger");

    await user.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
  });
});
