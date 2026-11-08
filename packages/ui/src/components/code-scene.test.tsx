import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CodeScene } from "./code-scene";
import { CodeBlock } from "./code-block";
import { Terminal } from "./terminal";
import type { CodeScene as Scene } from "../lib/scene";
import { coverageScene, hotspotScene, insightHooksScene, polyglotDebugScene } from "../stories/fixtures/scenes";

vi.mock("./code-block", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./code-block")>();
  return { ...actual, CodeBlock: vi.fn(actual.CodeBlock) };
});
vi.mock("./terminal", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./terminal")>();
  return { ...actual, Terminal: vi.fn(actual.Terminal) };
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function animationClock() {
  let now = 0;
  let id = 0;
  const callbacks = new Map<number, FrameRequestCallback>();
  vi.spyOn(performance, "now").mockImplementation(() => now);
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    callbacks.set(++id, callback);
    return id;
  });
  vi.stubGlobal("cancelAnimationFrame", (handle: number) => callbacks.delete(handle));
  return (milliseconds: number) => act(() => {
    now += milliseconds;
    const frame = [...callbacks.values()];
    callbacks.clear();
    for (const callback of frame) callback(now);
  });
}

const playbackScene: Scene = {
  files: [{ name: "demo.sh", lang: "sh", code: "echo one\necho two" }],
  steps: [
    { label: "One", duration: 1, actions: [{ type: "terminal", write: "one\n" }] },
    { label: "Two", duration: 1, actions: [{ type: "focus", line: 2 }, { type: "terminal", write: "two\n" }] },
    { label: "Done", duration: 1, actions: [] },
  ],
};

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


describe("CodeScene playback work", () => {
  it("leaves code and terminal surfaces untouched between cues", () => {
    const advance = animationClock();
    const { container } = render(<CodeScene scene={playbackScene} />);
    const line = container.querySelector(".eld-content");
    fireEvent.click(screen.getByRole("button", { name: "Play walkthrough" }));
    const codeRenders = vi.mocked(CodeBlock).mock.calls.length;
    const terminalRenders = vi.mocked(Terminal).mock.calls.length;
    for (let i = 0; i < 30; i++) advance(16);
    expect(vi.mocked(CodeBlock).mock.calls).toHaveLength(codeRenders);
    expect(vi.mocked(Terminal).mock.calls).toHaveLength(terminalRenders);
    expect(container.querySelector(".eld-content")).toBe(line);
    advance(600);
    expect(screen.getByText("Step 2 of 3")).toBeInTheDocument();
    expect(vi.mocked(CodeBlock).mock.calls.length).toBeGreaterThan(codeRenders);
    expect(vi.mocked(Terminal).mock.calls.length).toBeGreaterThan(terminalRenders);
    expect(container.querySelector('[data-slot="terminal"]')).toHaveTextContent("two");
  });

  it.each([2200, 5000])("stops at a crossed breakpoint after a delayed %i ms frame", (delay) => {
    const advance = animationClock();
    const scene: Scene = { ...playbackScene, steps: playbackScene.steps.map((step, index) => index === 1
      ? { ...step, actions: [...step.actions, { type: "breakpoint", state: "hit", line: 2 }] }
      : step) };
    const { container } = render(<CodeScene scene={scene} />);
    fireEvent.click(screen.getByRole("button", { name: "Play walkthrough" }));
    advance(delay);
    expect(screen.getByText("Step 2 of 3")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Play walkthrough" })).toBeInTheDocument();
    expect(container.querySelector('[data-decor="breakpoint-hit"]')).not.toBeNull();
    // Resuming advances beyond this breakpoint instead of stopping on it again.
    fireEvent.click(screen.getByRole("button", { name: "Play walkthrough" }));
    advance(1100);
    expect(screen.getByText("Step 3 of 3")).toBeInTheDocument();
  });

  it("does not offer playback for a scene with no steps", () => {
    render(<CodeScene scene={{ ...playbackScene, steps: [] }} />);
    expect(screen.getByText("Step 0 of 0")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Play walkthrough" })).toBeDisabled();
  });
});

describe("CodeScene viewport and keyboard", () => {
  it("suspends offscreen playback, resumes on return, and honors explicit navigation", () => {
    const advance = animationClock();
    let notify!: IntersectionObserverCallback;
    const disconnect = vi.fn();
    vi.stubGlobal("IntersectionObserver", class {
      constructor(callback: IntersectionObserverCallback) { notify = callback; }
      observe = vi.fn();
      disconnect = disconnect;
    });
    const visible = (isIntersecting: boolean) => act(() => {
      notify([{ isIntersecting } as IntersectionObserverEntry], {} as IntersectionObserver);
    });
    const view = render(<CodeScene scene={playbackScene} />);
    fireEvent.click(screen.getByRole("button", { name: "Play walkthrough" }));
    visible(false);
    expect(screen.getByRole("button", { name: "Play walkthrough" })).toBeInTheDocument();
    advance(4000);
    expect(screen.getByText("Step 1 of 3")).toBeInTheDocument();
    visible(true);
    expect(screen.getByRole("button", { name: "Pause walkthrough" })).toBeInTheDocument();
    advance(1100);
    expect(screen.getByText("Step 2 of 3")).toBeInTheDocument();
    visible(false);
    fireEvent.keyDown(screen.getByRole("group", { name: "Code walkthrough" }), { key: "Home" });
    visible(true);
    expect(screen.getByRole("button", { name: "Play walkthrough" })).toBeInTheDocument();
    expect(screen.getByText("Step 1 of 3")).toBeInTheDocument();
    view.unmount();
    expect(disconnect).toHaveBeenCalledOnce();
  });

  it("leaves modified and composing shortcuts to the browser", () => {
    render(<CodeScene scene={playbackScene} />);
    const root = screen.getByRole("group", { name: "Code walkthrough" });
    fireEvent.keyDown(root, { key: "End", ctrlKey: true });
    fireEvent.keyDown(root, { key: "End", metaKey: true });
    fireEvent.keyDown(root, { key: "ArrowRight", isComposing: true });
    expect(screen.getByText("Step 1 of 3")).toBeInTheDocument();
    fireEvent.keyDown(root, { key: "End" });
    expect(screen.getByText("Step 3 of 3")).toBeInTheDocument();
  });
});
