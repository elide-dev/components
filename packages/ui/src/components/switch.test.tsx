import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { Switch } from "./switch";

// jsdom does not implement PointerEvent, which Base UI dispatches on click.
if (typeof window.PointerEvent === "undefined") {
  window.PointerEvent = class PointerEvent extends MouseEvent {} as typeof window.PointerEvent;
}

describe("Switch", () => {
  it("renders with the switch role", () => {
    render(<Switch />);
    expect(screen.getByRole("switch")).toBeInTheDocument();
  });

  it("is unchecked by default", () => {
    render(<Switch />);
    expect(screen.getByRole("switch")).not.toBeChecked();
  });

  it("honors defaultChecked", () => {
    render(<Switch defaultChecked />);
    expect(screen.getByRole("switch")).toBeChecked();
  });

  it("toggles checked state and fires onCheckedChange on click", async () => {
    const user = userEvent.setup();
    const onCheckedChange = vi.fn();
    render(<Switch onCheckedChange={onCheckedChange} />);

    const toggle = screen.getByRole("switch");
    await user.click(toggle);

    expect(toggle).toBeChecked();
    expect(onCheckedChange).toHaveBeenCalledTimes(1);
    expect(onCheckedChange).toHaveBeenLastCalledWith(true, expect.anything());

    await user.click(toggle);
    expect(toggle).not.toBeChecked();
    expect(onCheckedChange).toHaveBeenLastCalledWith(false, expect.anything());
  });

  it("does not toggle when disabled", async () => {
    const user = userEvent.setup();
    const onCheckedChange = vi.fn();
    render(<Switch disabled onCheckedChange={onCheckedChange} />);

    await user.click(screen.getByRole("switch"));

    expect(onCheckedChange).not.toHaveBeenCalled();
    expect(screen.getByRole("switch")).not.toBeChecked();
  });

  it("carries the switch data-slot and reflects the size", () => {
    render(<Switch size="sm" />);
    const toggle = screen.getByRole("switch");
    expect(toggle).toHaveAttribute("data-slot", "switch");
    expect(toggle).toHaveAttribute("data-size", "sm");
  });

  it("merges a consumer className", () => {
    render(<Switch className="my-switch" />);
    expect(screen.getByRole("switch")).toHaveClass("my-switch");
  });
});
