import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { CodeBlock } from "./code-block";
import { CodeSample } from "./code-sample";
import { Terminal } from "./terminal";

const sample = (layout?: "below" | "beside" | "tabs", labels?: string[]) => (
  <CodeSample layout={layout} labels={labels}>
    <CodeBlock filename="app.ts" lang="ts" code={'console.log("Hello from Elide!")'} />
    <Terminal code={"$ elide run app.ts\nHello from Elide!"} />
  </CodeSample>
);

describe("CodeSample", () => {
  it("stacks its surfaces by default", () => {
    const { container } = render(sample());
    const root = container.querySelector('[data-slot="code-sample"]')!;
    expect(root).toHaveAttribute("data-layout", "below");
    expect(root.querySelector('[data-slot="code-block"]')).not.toBeNull();
    expect(root.querySelector('[data-slot="terminal"]')).not.toBeNull();
  });

  it("marks the beside layout for the container query", () => {
    const { container } = render(sample("beside"));
    expect(container.querySelector('[data-slot="code-sample"]')).toHaveAttribute("data-layout", "beside");
  });

  it("labels tabs from each child, falling back to Output", async () => {
    const user = userEvent.setup();
    render(sample("tabs"));
    expect(screen.getByRole("tab", { name: "app.ts" })).toHaveAttribute("aria-selected", "true");
    await user.click(screen.getByRole("tab", { name: "Output" }));
    expect(screen.getByRole("tab", { name: "Output" })).toHaveAttribute("aria-selected", "true");
  });

  it("numbers panels after the first two", () => {
    render(
      <CodeSample layout="tabs">
        <CodeBlock code={"a"} />
        <Terminal code={"$ a"} />
        <Terminal code={"$ b"} />
      </CodeSample>,
    );
    expect(screen.getByRole("tab", { name: "Panel 3" })).toBeInTheDocument();
  });

  it("accepts explicit tab labels", () => {
    render(sample("tabs", ["Source", "Run"]));
    expect(screen.getByRole("tab", { name: "Run" })).toBeInTheDocument();
  });
});
