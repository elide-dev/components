import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { CodeScene } from "./code-scene";
import { coverageScene, hotspotScene, insightHooksScene, polyglotDebugScene } from "../stories/fixtures/scenes";

describe("CodeScene", () => {
  it("steps a debugger across languages, following the active file", async () => {
    const user = userEvent.setup();
    const { container } = render(<CodeScene scene={polyglotDebugScene} />);
    const root = container.querySelector('[data-slot="code-scene"]')!;
    expect(screen.getByText("Step 1 of 6")).toBeInTheDocument();
    expect(container.querySelector('[data-decor="breakpoint"]')).toHaveAttribute("data-n", "5");
    expect(screen.getByRole("button", { name: "Previous step" })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Next step" }));
    expect(container.querySelector('[data-decor="breakpoint-hit"]')).not.toBeNull();
    expect(screen.getByRole("region", { name: "Locals" })).toHaveTextContent('name"Ada"');

    await user.click(screen.getByRole("button", { name: "Next step" }));
    expect(screen.getByRole("tab", { name: "Greeter.kt" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("region", { name: "Call stack" }).querySelectorAll("li")).toHaveLength(2);

    // Keyboard: the walkthrough itself takes arrow keys (and F10, as in DevTools).
    (root as HTMLElement).focus();
    await user.keyboard("{F10}");
    expect(screen.getByRole("tab", { name: "format.py" })).toHaveAttribute("aria-selected", "true");
    await user.keyboard("{ArrowLeft}");
    expect(screen.getByRole("tab", { name: "Greeter.kt" })).toHaveAttribute("aria-selected", "true");
    await user.keyboard("{End}");
    expect(screen.getByText("Step 6 of 6")).toBeInTheDocument();
    expect(container).toHaveTextContent("Hello, ✨ ADA ✨!");
  });

  it("flashes lines only on their own step and announces each step", async () => {
    const user = userEvent.setup();
    const { container } = render(<CodeScene scene={insightHooksScene} initialStep={1} />);
    const flash = container.querySelector('[data-decor~="flash"]')!;
    expect(flash).toHaveAttribute("data-tone", "insight");
    expect(flash).toHaveAttribute("data-sr", "request hook");
    expect(container.querySelector('[aria-live="polite"]')).toHaveTextContent("the request hook fires");
    await user.click(screen.getByRole("button", { name: "Next step" }));
    expect(container.querySelector('[data-decor~="flash"]')).toHaveAttribute("data-tone", "info");
  });

  it("renders coverage on the gutter edge with accessible names", () => {
    const { container } = render(<CodeScene scene={coverageScene} initialStep={1} />);
    expect(container.querySelector('[data-n="8"]')).toHaveAttribute("data-coverage", "miss");
    expect(container.querySelector('[data-n="8"]')).toHaveAttribute("data-sr", "Not covered");
    expect(container.querySelector('[data-n="2"]')).toHaveAttribute("data-coverage", "partial");
    expect(container.querySelector('[data-n="4"]')).toHaveAttribute("data-coverage", "hit");
    expect(container).toHaveTextContent("Line coverage 60%");
  });

  it("heats the hottest lines and shows their share of samples", () => {
    const { container } = render(<CodeScene scene={hotspotScene} initialStep={2} />);
    const hot = container.querySelector('[data-n="11"]')!;
    expect(hot).toHaveAttribute("data-heat", "4");
    expect(hot.querySelector(".eld-heat")).toHaveAttribute("data-share", "83%");
    expect(hot).toHaveAttribute("data-sr", expect.stringContaining("83% of samples"));
    // The share is drawn by CSS: never part of the copied code.
    expect(hot.querySelector(".eld-content")!.textContent).not.toContain("%");
  });
});
