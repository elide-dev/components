import { render, screen } from "@testing-library/react";
import { describe, it, expect, beforeAll } from "vitest";
import { ScrollArea, ScrollBar } from "./scroll-area";

// Base UI's scroll area observes element size; jsdom lacks ResizeObserver.
// Without real layout it never measures an overflow, so the scrollbar/thumb
// stay unmounted — the assertions below only cover what renders in jsdom.
beforeAll(() => {
  if (typeof window.ResizeObserver === "undefined") {
    window.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof window.ResizeObserver;
  }
});

describe("ScrollArea", () => {
  it("renders its children inside the viewport", () => {
    render(
      <ScrollArea>
        <p>Scrollable content</p>
      </ScrollArea>
    );
    const content = screen.getByText("Scrollable content");
    expect(content).toBeInTheDocument();
    expect(content.closest('[data-slot="scroll-area-viewport"]')).not.toBeNull();
  });

  it("renders the root and viewport slots", () => {
    const { container } = render(
      <ScrollArea>
        <p>Body</p>
      </ScrollArea>
    );
    expect(container.querySelector('[data-slot="scroll-area"]')).toBeInTheDocument();
    expect(
      container.querySelector('[data-slot="scroll-area-viewport"]')
    ).toBeInTheDocument();
  });

  it("merges a consumer className on the root", () => {
    const { container } = render(
      <ScrollArea className="my-scroll">
        <p>Body</p>
      </ScrollArea>
    );
    expect(container.querySelector('[data-slot="scroll-area"]')).toHaveClass(
      "my-scroll"
    );
  });

  it("renders a horizontal ScrollBar within the root without error", () => {
    // Exercises the ScrollBar branch; Base UI keeps the scrollbar unmounted
    // until it measures an overflow, which jsdom cannot provide.
    const { container } = render(
      <ScrollArea>
        <ScrollBar orientation="horizontal" />
        <p>Body</p>
      </ScrollArea>
    );
    expect(container.querySelector('[data-slot="scroll-area"]')).toBeInTheDocument();
    expect(screen.getByText("Body")).toBeInTheDocument();
  });
});
