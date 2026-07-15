import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
  SheetClose,
} from "./sheet";

function renderSheet(props?: {
  side?: "top" | "right" | "bottom" | "left";
  showCloseButton?: boolean;
  onOpenChange?: (open: boolean) => void;
  contentClassName?: string;
}) {
  return render(
    <Sheet onOpenChange={props?.onOpenChange}>
      <SheetTrigger>Open sheet</SheetTrigger>
      <SheetContent
        side={props?.side}
        showCloseButton={props?.showCloseButton}
        className={props?.contentClassName}
      >
        <SheetHeader>
          <SheetTitle>Settings</SheetTitle>
          <SheetDescription>Manage your workspace preferences.</SheetDescription>
        </SheetHeader>
        <SheetFooter>
          <SheetClose>Done</SheetClose>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

describe("Sheet", () => {
  it("does not render content until the trigger is activated", () => {
    renderSheet();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open sheet" })).toBeInTheDocument();
  });

  it("opens the sheet on trigger click", async () => {
    const user = userEvent.setup();
    renderSheet();

    await user.click(screen.getByRole("button", { name: "Open sheet" }));

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Manage your workspace preferences.")).toBeInTheDocument();
  });

  it("labels the sheet by its title and describes it by its description", async () => {
    const user = userEvent.setup();
    renderSheet();
    await user.click(screen.getByRole("button", { name: "Open sheet" }));

    expect(screen.getByRole("dialog", { name: "Settings" })).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toHaveAccessibleDescription(
      "Manage your workspace preferences."
    );
  });

  it("closes when the built-in close button is clicked", async () => {
    const user = userEvent.setup();
    renderSheet();
    await user.click(screen.getByRole("button", { name: "Open sheet" }));

    await user.click(screen.getByRole("button", { name: "Close" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("closes when Escape is pressed", async () => {
    const user = userEvent.setup();
    renderSheet();
    await user.click(screen.getByRole("button", { name: "Open sheet" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    await user.keyboard("{Escape}");

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("fires onOpenChange when opening and closing", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    renderSheet({ onOpenChange });

    await user.click(screen.getByRole("button", { name: "Open sheet" }));
    expect(onOpenChange.mock.lastCall?.[0]).toBe(true);

    await user.keyboard("{Escape}");
    expect(onOpenChange.mock.lastCall?.[0]).toBe(false);
  });

  it("hides the built-in close button when showCloseButton is false", async () => {
    const user = userEvent.setup();
    renderSheet({ showCloseButton: false });
    await user.click(screen.getByRole("button", { name: "Open sheet" }));

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Close" })).not.toBeInTheDocument();
  });

  it("defaults the content to the right side", async () => {
    const user = userEvent.setup();
    renderSheet();
    await user.click(screen.getByRole("button", { name: "Open sheet" }));

    expect(screen.getByRole("dialog")).toHaveAttribute("data-side", "right");
  });

  it.each(["top", "right", "bottom", "left"] as const)(
    "reflects the %s side on the content via data-side",
    async (side) => {
      const user = userEvent.setup();
      renderSheet({ side });
      await user.click(screen.getByRole("button", { name: "Open sheet" }));

      expect(screen.getByRole("dialog")).toHaveAttribute("data-side", side);
    }
  );

  it("merges a consumer className onto the content", async () => {
    const user = userEvent.setup();
    renderSheet({ contentClassName: "custom-sheet" });
    await user.click(screen.getByRole("button", { name: "Open sheet" }));

    expect(screen.getByRole("dialog")).toHaveClass("custom-sheet");
  });

  it("exposes data-slot attributes on the header, footer, title, and description", async () => {
    const user = userEvent.setup();
    renderSheet();
    await user.click(screen.getByRole("button", { name: "Open sheet" }));

    expect(screen.getByRole("dialog")).toHaveAttribute("data-slot", "sheet-content");
    expect(screen.getByText("Settings")).toHaveAttribute("data-slot", "sheet-title");
    expect(screen.getByText("Manage your workspace preferences.")).toHaveAttribute(
      "data-slot",
      "sheet-description"
    );
    // Header and footer are plain divs identified only by data-slot.
    expect(document.querySelector("[data-slot=sheet-header]")).toBeInTheDocument();
    expect(document.querySelector("[data-slot=sheet-footer]")).toBeInTheDocument();
  });

  it("closes via a custom SheetClose child", async () => {
    const user = userEvent.setup();
    // Disable the built-in close so the custom "Done" button is unambiguous.
    renderSheet({ showCloseButton: false });
    await user.click(screen.getByRole("button", { name: "Open sheet" }));

    await user.click(screen.getByRole("button", { name: "Done" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
