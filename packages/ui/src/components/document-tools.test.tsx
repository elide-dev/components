import * as React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DeferredContent } from "./deferred-content";
import { ReadingProgress } from "./reading-progress";

describe("DeferredContent", () => {
  it("keeps content and native controls accessible without JavaScript visibility state", () => {
    render(
      <section aria-labelledby="configuration">
        <h2 id="configuration">Configuration</h2>
        <DeferredContent intrinsicBlockSize={640}>
          <label htmlFor="project-name">Project name</label>
          <input id="project-name" defaultValue="Elide" />
        </DeferredContent>
      </section>,
    );

    const input = screen.getByRole("textbox", { name: "Project name" });
    fireEvent.change(input, { target: { value: "Docs" } });
    expect(input).toHaveValue("Docs");
    const body = input.closest("[data-slot='deferred-content']")!;
    expect(body).not.toHaveAttribute("hidden");
    expect(body).not.toHaveAttribute("aria-hidden");
    expect(body).not.toContainElement(screen.getByRole("heading", { name: "Configuration" }));
  });

  it("forwards the element ref and consumer styles alongside a CSS size estimate", () => {
    const ref = React.createRef<HTMLDivElement>();
    const { rerender } = render(
      <DeferredContent ref={ref} intrinsicBlockSize={640} style={{ padding: 8 }}>Body</DeferredContent>,
    );
    expect(ref.current?.style.getPropertyValue("--eld-deferred-content-size")).toBe("640px");
    expect(ref.current?.style.padding).toBe("8px");
    rerender(<DeferredContent ref={ref} intrinsicBlockSize="48rem">Body</DeferredContent>);
    expect(ref.current?.style.getPropertyValue("--eld-deferred-content-size")).toBe("48rem");
  });
});

describe("ReadingProgress", () => {
  it("provides a decorative cue without an incorrect numeric progress announcement", () => {
    const ref = React.createRef<HTMLDivElement>();
    render(<ReadingProgress ref={ref} />);
    expect(ref.current).toHaveAttribute("aria-hidden", "true");
    expect(ref.current).not.toHaveAttribute("role");
    expect(ref.current).not.toHaveAttribute("aria-valuenow");
    expect(ref.current).not.toHaveAttribute("tabindex");
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  });
});
