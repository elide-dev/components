import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { Callout } from "./callout";

describe("Callout", () => {
  it("renders as a note landmark with its children", () => {
    render(<Callout>Body content here.</Callout>);
    expect(screen.getByRole("note")).toBeInTheDocument();
    expect(screen.getByText("Body content here.")).toBeInTheDocument();
  });

  it("defaults to the Note tone label", () => {
    render(<Callout>x</Callout>);
    expect(screen.getByText("Note")).toBeInTheDocument();
  });

  it("uses the tone's label for other tones", () => {
    render(<Callout tone="warning">x</Callout>);
    expect(screen.getByText("Warning")).toBeInTheDocument();
    expect(screen.queryByText("Note")).not.toBeInTheDocument();
  });

  it("renders a title override in place of the default label", () => {
    render(
      <Callout tone="tip" title="Custom heading">
        x
      </Callout>,
    );
    expect(screen.getByText("Custom heading")).toBeInTheDocument();
    expect(screen.queryByText("Tip")).not.toBeInTheDocument();
  });

  it("merges a consumer className", () => {
    render(<Callout className="custom-x">x</Callout>);
    expect(screen.getByRole("note")).toHaveClass("custom-x");
  });
});
