import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from "./dialog";

function renderDialog(props?: {
  onOpenChange?: (open: boolean) => void;
  footerCloseButton?: boolean;
  showCloseButton?: boolean;
}) {
  return render(
    <Dialog onOpenChange={props?.onOpenChange}>
      <DialogTrigger>Open dialog</DialogTrigger>
      <DialogContent showCloseButton={props?.showCloseButton}>
        <DialogHeader>
          <DialogTitle>Delete project</DialogTitle>
          <DialogDescription>This action cannot be undone.</DialogDescription>
        </DialogHeader>
        <DialogFooter showCloseButton={props?.footerCloseButton}>
          <DialogClose>Cancel</DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

describe("Dialog", () => {
  it("does not render content until the trigger is activated", () => {
    renderDialog();
    // Base UI portals the popup to document.body; closed = not in the DOM.
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open dialog" })).toBeInTheDocument();
  });

  it("opens the dialog on trigger click", async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.click(screen.getByRole("button", { name: "Open dialog" }));

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("This action cannot be undone.")).toBeInTheDocument();
  });

  it("labels the dialog by its title and describes it by its description", async () => {
    const user = userEvent.setup();
    renderDialog();
    await user.click(screen.getByRole("button", { name: "Open dialog" }));

    // aria-labelledby wiring means the accessible name is the title text.
    expect(screen.getByRole("dialog", { name: "Delete project" })).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toHaveAccessibleDescription(
      "This action cannot be undone."
    );
  });

  it("closes when the built-in close button is clicked", async () => {
    const user = userEvent.setup();
    renderDialog();
    await user.click(screen.getByRole("button", { name: "Open dialog" }));

    await user.click(screen.getByRole("button", { name: "Close" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("closes when Escape is pressed", async () => {
    const user = userEvent.setup();
    renderDialog();
    await user.click(screen.getByRole("button", { name: "Open dialog" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    await user.keyboard("{Escape}");

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("fires onOpenChange when opening and closing", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    renderDialog({ onOpenChange });

    await user.click(screen.getByRole("button", { name: "Open dialog" }));
    expect(onOpenChange.mock.lastCall?.[0]).toBe(true);

    await user.keyboard("{Escape}");
    expect(onOpenChange.mock.lastCall?.[0]).toBe(false);
  });

  it("hides the built-in close button when showCloseButton is false", async () => {
    const user = userEvent.setup();
    render(
      <Dialog>
        <DialogTrigger>Open dialog</DialogTrigger>
        <DialogContent showCloseButton={false}>
          <DialogTitle>No close button</DialogTitle>
        </DialogContent>
      </Dialog>
    );
    await user.click(screen.getByRole("button", { name: "Open dialog" }));

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Close" })).not.toBeInTheDocument();
  });

  it("renders the footer close button when DialogFooter showCloseButton is set", async () => {
    const user = userEvent.setup();
    // Disable the built-in close so only the footer's Close button exists.
    renderDialog({ footerCloseButton: true, showCloseButton: false });
    await user.click(screen.getByRole("button", { name: "Open dialog" }));

    // The footer's own Close button carries the label "Close".
    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("merges a consumer className onto the content popup", async () => {
    const user = userEvent.setup();
    render(
      <Dialog>
        <DialogTrigger>Open dialog</DialogTrigger>
        <DialogContent className="custom-content">
          <DialogTitle>Styled</DialogTitle>
        </DialogContent>
      </Dialog>
    );
    await user.click(screen.getByRole("button", { name: "Open dialog" }));

    expect(screen.getByRole("dialog")).toHaveClass("custom-content");
  });

  it("exposes data-slot attributes on rendered parts", async () => {
    const user = userEvent.setup();
    renderDialog();
    await user.click(screen.getByRole("button", { name: "Open dialog" }));

    expect(screen.getByRole("dialog")).toHaveAttribute("data-slot", "dialog-content");
    expect(screen.getByText("Delete project")).toHaveAttribute("data-slot", "dialog-title");
    expect(screen.getByText("This action cannot be undone.")).toHaveAttribute(
      "data-slot",
      "dialog-description"
    );
  });
});
