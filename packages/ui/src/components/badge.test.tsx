import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { Badge } from "./badge";

describe("Badge", () => {
  it("renders its children", () => {
    render(<Badge>Beta</Badge>);
    expect(screen.getByText("Beta")).toBeInTheDocument();
  });

  it("renders a status dot when `dot` is set", () => {
    const { container } = render(<Badge dot>Live</Badge>);
    // The dot is a decorative leading span with bg-current.
    expect(container.querySelector("span > span.bg-current")).toBeInTheDocument();
  });

  it("merges a consumer className", () => {
    render(<Badge className="custom-x">Tag</Badge>);
    expect(screen.getByText("Tag")).toHaveClass("custom-x");
  });
});
