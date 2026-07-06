import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { AiActions } from "./ai-actions";

describe("AiActions", () => {
  it("renders the panel with its title", () => {
    render(<AiActions />);
    expect(screen.getByText("Use with AI")).toBeInTheDocument();
  });

  it("supports a custom title", () => {
    render(<AiActions title="Ask an assistant" />);
    expect(screen.getByText("Ask an assistant")).toBeInTheDocument();
  });

  it("omits the Copy as Markdown button when no markdown is given", () => {
    render(<AiActions />);
    expect(screen.queryByRole("button", { name: /Copy as Markdown/ })).not.toBeInTheDocument();
  });

  it("copies the markdown to the clipboard when Copy as Markdown is clicked", async () => {
    // `userEvent.setup()` installs its own clipboard stub as a getter-only
    // property, so it must be overridden *after* setup (and via
    // `defineProperty`, since plain assignment fails against the getter).
    const user = userEvent.setup();
    const writeText = vi.fn();
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });

    render(<AiActions markdown="# Elide Overview" />);
    await user.click(screen.getByRole("button", { name: /Copy as Markdown/ }));

    expect(writeText).toHaveBeenCalledWith("# Elide Overview");
  });

  it("renders an external action as a new-tab anchor with an external-link icon", () => {
    render(<AiActions actions={[{ label: "Open in Claude", href: "https://claude.ai", external: true }]} />);

    const link = screen.getByRole("link", { name: "Open in Claude" });
    expect(link).toHaveAttribute("target", "_blank");
    expect(link.getAttribute("rel")).toContain("noopener");
    expect(link.querySelector("svg")).toBeInTheDocument();
  });

  it("renders a non-external action as a plain anchor with no target", () => {
    render(<AiActions actions={[{ label: "View as text", href: "#raw" }]} />);
    expect(screen.getByRole("link", { name: "View as text" })).not.toHaveAttribute("target");
  });

  it("renders a callback action as a button and fires onClick", async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    render(<AiActions actions={[{ label: "Regenerate", onClick }]} />);

    await user.click(screen.getByRole("button", { name: "Regenerate" }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
