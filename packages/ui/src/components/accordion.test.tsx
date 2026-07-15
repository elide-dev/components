import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "./accordion";

// jsdom does not implement PointerEvent, which Base UI dispatches on click.
if (typeof window.PointerEvent === "undefined") {
  window.PointerEvent = class PointerEvent extends MouseEvent {} as typeof window.PointerEvent;
}

function renderAccordion(props?: React.ComponentProps<typeof Accordion>) {
  return render(
    <Accordion {...props}>
      <AccordionItem value="a">
        <AccordionTrigger>First</AccordionTrigger>
        <AccordionContent>First panel body</AccordionContent>
      </AccordionItem>
      <AccordionItem value="b">
        <AccordionTrigger>Second</AccordionTrigger>
        <AccordionContent>Second panel body</AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}

describe("Accordion", () => {
  it("renders a trigger per item", () => {
    renderAccordion();
    expect(screen.getByRole("button", { name: "First" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Second" })).toBeInTheDocument();
  });

  it("starts collapsed", () => {
    renderAccordion();
    expect(screen.getByRole("button", { name: "First" })).toHaveAttribute(
      "aria-expanded",
      "false"
    );
  });

  it("expands a panel when its trigger is clicked", async () => {
    const user = userEvent.setup();
    renderAccordion();

    const trigger = screen.getByRole("button", { name: "First" });
    await user.click(trigger);

    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("First panel body")).toBeVisible();
  });

  it("collapses an expanded panel when its trigger is clicked again", async () => {
    const user = userEvent.setup();
    renderAccordion({ defaultValue: ["a"] });

    const trigger = screen.getByRole("button", { name: "First" });
    expect(trigger).toHaveAttribute("aria-expanded", "true");

    await user.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  it("fires onValueChange with the opened item's value", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    renderAccordion({ onValueChange });

    await user.click(screen.getByRole("button", { name: "Second" }));

    expect(onValueChange).toHaveBeenCalled();
    expect(onValueChange.mock.calls[0][0]).toContain("b");
  });

  it("carries data-slot attributes", () => {
    const { container } = renderAccordion();
    expect(container.querySelector('[data-slot="accordion"]')).toBeInTheDocument();
    expect(container.querySelector('[data-slot="accordion-item"]')).toBeInTheDocument();
    expect(
      container.querySelector('[data-slot="accordion-trigger"]')
    ).toBeInTheDocument();
  });

  it("merges a consumer className on the root", () => {
    const { container } = renderAccordion({ className: "my-accordion" });
    expect(container.querySelector('[data-slot="accordion"]')).toHaveClass(
      "my-accordion"
    );
  });
});
