import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { Separator } from "./separator";

describe("Separator", () => {
  it("renders with the separator role", () => {
    render(<Separator />);
    expect(screen.getByRole("separator")).toBeInTheDocument();
  });

  it("defaults to a horizontal orientation", () => {
    render(<Separator />);
    expect(screen.getByRole("separator")).toHaveAttribute("aria-orientation", "horizontal");
  });

  it("reflects a vertical orientation", () => {
    render(<Separator orientation="vertical" />);
    expect(screen.getByRole("separator")).toHaveAttribute("aria-orientation", "vertical");
  });

  it("carries the separator data-slot", () => {
    render(<Separator />);
    expect(screen.getByRole("separator")).toHaveAttribute("data-slot", "separator");
  });

  it("merges a consumer className", () => {
    render(<Separator className="my-divider" />);
    expect(screen.getByRole("separator")).toHaveClass("my-divider");
  });
});
