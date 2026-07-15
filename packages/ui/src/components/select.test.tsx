import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeAll } from "vitest";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./select";

// jsdom is missing several browser APIs Base UI's Select relies on.
beforeAll(() => {
  if (typeof window.PointerEvent === "undefined") {
    window.PointerEvent = class PointerEvent extends MouseEvent {} as typeof window.PointerEvent;
  }
  if (typeof window.ResizeObserver === "undefined") {
    window.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof window.ResizeObserver;
  }
  Element.prototype.scrollIntoView = () => {};
  if (!Element.prototype.hasPointerCapture) {
    Element.prototype.hasPointerCapture = () => false;
  }
  if (!Element.prototype.releasePointerCapture) {
    Element.prototype.releasePointerCapture = () => {};
  }
});

function renderSelect(props?: React.ComponentProps<typeof Select>) {
  return render(
    <Select {...props}>
      <SelectTrigger>
        <SelectValue placeholder="Pick a fruit" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="apple">Apple</SelectItem>
        <SelectItem value="banana">Banana</SelectItem>
      </SelectContent>
    </Select>
  );
}

describe("Select", () => {
  it("renders a trigger showing the placeholder", () => {
    renderSelect();
    const trigger = screen.getByRole("combobox");
    expect(trigger).toBeInTheDocument();
    expect(trigger).toHaveTextContent("Pick a fruit");
  });

  it("keeps the popup out of the DOM until opened", () => {
    renderSelect();
    expect(screen.queryByRole("option", { name: "Apple" })).not.toBeInTheDocument();
  });

  it("opens the popup and reveals the items on trigger click", async () => {
    const user = userEvent.setup();
    renderSelect();

    await user.click(screen.getByRole("combobox"));

    expect(await screen.findByRole("option", { name: "Apple" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Banana" })).toBeInTheDocument();
  });

  it("selects an item, firing onValueChange and updating the trigger", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    renderSelect({ onValueChange });

    await user.click(screen.getByRole("combobox"));
    await user.click(await screen.findByRole("option", { name: "Banana" }));

    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange).toHaveBeenLastCalledWith("banana", expect.anything());
    // SelectValue renders the raw value (no `items` label map is supplied).
    expect(screen.getByRole("combobox")).toHaveTextContent("banana");
  });

  it("renders the selected value from defaultValue", () => {
    renderSelect({ defaultValue: "apple" });
    expect(screen.getByRole("combobox")).toHaveTextContent("apple");
  });

  it("carries the trigger data-slot and default size", () => {
    renderSelect();
    const trigger = screen.getByRole("combobox");
    expect(trigger).toHaveAttribute("data-slot", "select-trigger");
    expect(trigger).toHaveAttribute("data-size", "default");
  });

  it("merges a consumer className on the trigger", () => {
    render(
      <Select>
        <SelectTrigger className="my-trigger">
          <SelectValue placeholder="Pick" />
        </SelectTrigger>
      </Select>
    );
    expect(screen.getByRole("combobox")).toHaveClass("my-trigger");
  });
});
