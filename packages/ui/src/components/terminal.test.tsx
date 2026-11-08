import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CastRenderer } from "../lib/asciicast";
import { Terminal } from "./terminal";

const ESC = "\x1b";

const cast = [
  JSON.stringify({ version: 2, width: 30, height: 6 }),
  JSON.stringify([0.2, "m", "run"]),
  JSON.stringify([0.2, "o", "$ elide run app.ts\r\n"]),
  JSON.stringify([0.8, "o", `${ESC}[32mHello${ESC}[0m from Elide!\r\n`]),
  JSON.stringify([1.0, "o", "$ "]),
].join("\n");

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Terminal — static transcript", () => {
  it("renders prompts, shell-highlighted commands, ANSI output and comments", () => {
    const { container } = render(
      <Terminal code={`# say hi\n$ elide run app.ts\n${ESC}[1;32m✓${ESC}[0m Hello from Elide!`} />,
    );
    const command = container.querySelector('.eld-line[data-kind="command"]')!;
    // The prompt is drawn by CSS from an empty, hidden element: never selected, copied or read.
    expect(command).toHaveTextContent(/^elide run app\.ts$/);
    expect(command.querySelector(".eld-prompt")).toHaveAttribute("data-prompt", "$");
    expect(command.querySelector(".eld-prompt")).toHaveAttribute("aria-hidden", "true");
    expect(command.querySelector(".sh-command")).toHaveTextContent("elide");
    expect(command.querySelector(".sh-subcommand")).toHaveTextContent("run");
    expect(container.querySelector('.eld-line[data-kind="comment"]')).toHaveTextContent("# say hi");
    const check = screen.getByText("✓");
    expect(check).toHaveStyle({ fontWeight: "700" });
    expect(check.getAttribute("style")).toContain("var(--eld-ansi-green)");
    expect(container).not.toHaveTextContent("[1;32m");
  });

  it("keeps blank output lines", () => {
    const { container } = render(<Terminal code={"$ a\none\n\nthree"} />);
    expect(container.querySelectorAll(".eld-line")).toHaveLength(4);
  });

  it("copies just the commands by default, or the whole transcript", async () => {
    const user = userEvent.setup();
    const { unmount } = render(<Terminal code={"$ elide build\nok\n$ elide run"} />);
    await user.click(screen.getByRole("button", { name: "Copy commands" }));
    expect(await navigator.clipboard.readText()).toBe("elide build\nelide run");
    unmount();
    render(<Terminal copy="transcript" code={`$ elide build\n${ESC}[32mok${ESC}[0m`} />);
    await user.click(screen.getByRole("button", { name: "Copy" }));
    expect(await navigator.clipboard.readText()).toBe("$ elide build\nok");
  });

  it("titles the window from the prompt and shows the cwd before the glyph", () => {
    const { container } = render(
      <Terminal prompt={{ user: "dev", host: "elide", cwd: "~/app", symbol: "❯" }} code={"❯ elide run"} lang="zsh" />,
    );
    expect(screen.getByText("dev@elide: ~/app")).toBeInTheDocument();
    expect(screen.getByText("zsh")).toBeInTheDocument();
    const prompt = container.querySelector(".eld-prompt")!;
    expect(prompt).toHaveAttribute("data-cwd", "~/app");
    expect(prompt).toHaveAttribute("data-prompt", "❯");
  });

  it("falls back to the localized title and hides copy when disabled", () => {
    render(<Terminal code={"ls"} copy={false} windowControls={false} />);
    expect(screen.getByText("Terminal")).toBeInTheDocument();
    expect(screen.queryByRole("button")).toBeNull();
  });
});

describe("Terminal — rows, wrapping, links and chrome", () => {
  it("wraps by default, and scrolls as a named group when wrapping is off", () => {
    const { container, unmount } = render(<Terminal code={"$ ls"} />);
    expect(container.querySelector(".eld-lines")).toHaveAttribute("data-wrap");
    expect(container.querySelector("pre")).not.toHaveAttribute("tabindex");
    unmount();
    const next = render(<Terminal code={"$ ls"} wrap={false} title="build" />).container;
    expect(next.querySelector("pre")).toHaveAttribute("tabindex", "0");
    expect(next.querySelector("pre")).toHaveAccessibleName("build");
  });

  it("offers a copy button per command (with its continuation lines)", async () => {
    const user = userEvent.setup();
    render(<Terminal code={"$ elide install \\\n  --frozen\nok\n$ elide run app.ts"} />);
    const buttons = screen.getAllByRole("button", { name: "Copy command" });
    expect(buttons).toHaveLength(2);
    await user.click(buttons[0]);
    expect(await navigator.clipboard.readText()).toBe("elide install \\\n  --frozen");
  });

  it("shows exit codes, links commands, and links URLs in output", () => {
    const { container } = render(
      <Terminal
        lines={[
          { kind: "command", text: "elide run app.ts", exitCode: 0 },
          { kind: "output", text: "Listening on http://localhost:3000." },
          { kind: "command", text: "elide test", exitCode: 1 },
        ]}
        commandHref={(name) => `/cli/${name}`}
      />,
    );
    const rows = [...container.querySelectorAll<HTMLElement>('.eld-line[data-kind="command"]')];
    expect(rows.map((row) => [row.dataset.exit, row.dataset.sr])).toEqual([["ok", "Exit code 0"], ["fail", "Exit code 1"]]);
    expect(screen.getAllByRole("link", { name: "elide" })[0]).toHaveAttribute("href", "/cli/elide");
    expect(screen.getByRole("link", { name: "http://localhost:3000" })).toHaveAttribute("href", "http://localhost:3000");
  });

  it("maps the deprecated windowControls={false} to chrome none", () => {
    const { container } = render(<Terminal code={"ls"} windowControls={false} />);
    expect(container.querySelector('[data-chrome="none"]')).not.toBeNull();
    expect(container.querySelector(".eld-chrome-mac")).toBeNull();
  });
});

describe("Terminal — recordings", () => {
  it("parks playback started while offscreen and resumes when the viewport reports it visible", async () => {
    const observers: { callback: IntersectionObserverCallback; options?: IntersectionObserverInit }[] = [];
    vi.stubGlobal("IntersectionObserver", class {
      constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) { observers.push({ callback, options }); }
      observe() {} disconnect() {}
    });
    const user = userEvent.setup();
    render(<Terminal code="$ x" recording={{ cast, poster: "first" }} />);
    const observer = observers.find(entry => !entry.options?.rootMargin)!;
    const report = (visible: boolean) => act(() => observer.callback([{ isIntersecting: !visible, intersectionRatio: visible ? 0 : 1 }, { isIntersecting: visible, intersectionRatio: visible ? 1 : 0 }] as IntersectionObserverEntry[], {} as IntersectionObserver));
    report(false);
    await user.click(screen.getByRole("button", { name: "Play", exact: true }));
    expect(screen.getByRole("button", { name: "Play", exact: true })).toBeInTheDocument();
    report(true);
    expect(screen.getByRole("button", { name: "Pause", exact: true })).toBeInTheDocument();
  });

  it("skips height-probing screens with explicit rows while preserving the transcript", () => {
    const probe = vi.spyOn(CastRenderer.prototype, "screen");
    try {
      const { container } = render(<Terminal code="$ elide run app.ts" recording={{ cast, rows: 6 }} />);
      // Only the displayed poster is requested; no height-sampling timeline.
      expect(probe).toHaveBeenCalled();
      expect(probe.mock.calls.every(([time]) => time === 1)).toBe(true);
      expect(container.querySelector("pre.sr-only")).toHaveTextContent("Hello from Elide!");
    } finally { probe.mockRestore(); }
  });

  it("renders the final frame as a poster, with a transcript for assistive tech", () => {
    const { container } = render(<Terminal code={"$ elide run app.ts"} recording={{ cast }} />);
    const screenPre = container.querySelector('[data-slot="terminal-recording"] pre[aria-hidden="true"]')!;
    expect(screenPre).toHaveTextContent("Hello from Elide!");
    // The transcript keeps its line breaks for screen readers.
    expect(container.querySelector("pre.sr-only")!.textContent).toBe("$ elide run app.ts\nHello from Elide!\n$");
    expect(container.querySelector("pre.sr-only")).toHaveClass("whitespace-pre");
    expect(screen.getByRole("group", { name: "Terminal recording" })).toBeInTheDocument();
    expect(screen.getByRole("slider", { name: "Playback position" })).toHaveAttribute("aria-valuetext", "0:01 of 0:01");
  });

  it("plays, pauses, seeks and changes speed", async () => {
    const user = userEvent.setup();
    render(<Terminal code={"$ elide run app.ts"} recording={{ cast, poster: "first" }} />);
    const slider = screen.getByRole("slider", { name: "Playback position" });
    expect(slider).toHaveValue("0");
    await user.click(screen.getByRole("button", { name: "Play" }));
    expect(screen.getByRole("button", { name: "Pause" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Pause" }));
    await user.click(screen.getByRole("button", { name: "Playback speed: 1×" }));
    expect(screen.getByRole("button", { name: "Playback speed: 1.5×" })).toBeInTheDocument();
  });

  it("maps keyboard shortcuts on the focused screen", async () => {
    const user = userEvent.setup();
    const { container } = render(<Terminal code={"$ x"} recording={{ cast, poster: "first" }} />);
    const group = screen.getByRole("group", { name: "Terminal recording" });
    group.focus();
    await user.keyboard("{End}");
    expect(container.querySelector('pre[aria-hidden="true"]')).toHaveTextContent("Hello from Elide!");
    await user.keyboard("{Home}");
    expect(container.querySelector('pre[aria-hidden="true"]')).not.toHaveTextContent("Hello");
    await user.keyboard("m");
    expect(screen.getByRole("slider")).toHaveValue("0.2");
  });

  it("jumps to the next marker, hiding a control with no target", async () => {
    const user = userEvent.setup();
    render(<Terminal code={"$ x"} recording={{ cast, poster: "first" }} />);
    // jsdom has no stylesheet: the target-less "previous" control carries `invisible`.
    const [previous, next] = screen.getAllByRole("button", { name: "Jump to run" });
    expect(previous).toHaveClass("invisible");
    expect(next).not.toHaveClass("invisible");
    await user.click(next);
    expect(screen.getByRole("slider")).toHaveValue("0.2");
  });

  it("synthesizes a typed session from the transcript", () => {
    const { container } = render(
      <Terminal code={"$ elide run app.ts\nHello from Elide!"} recording={{ synthesize: { seed: 3 } }} />,
    );
    expect(container.querySelector("pre.sr-only")).toHaveTextContent("$ elide run app.ts Hello from Elide!");
  });

  it("shows the static transcript until a remote recording loads", async () => {
    let resolve!: (value: Response) => void;
    const fetch = vi.fn(() => new Promise<Response>((r) => (resolve = r)));
    vi.stubGlobal("fetch", fetch);
    const { container } = render(<Terminal code={"$ elide run app.ts"} recording="/demo.cast" />);
    expect(container.querySelector('.eld-line[data-kind="command"]')).toHaveTextContent("elide run app.ts");
    await waitFor(() => expect(fetch).toHaveBeenCalledWith("/demo.cast", expect.anything()));
    expect(screen.getByRole("status")).toHaveTextContent("Loading recording…");
    await act(async () => resolve(new Response(cast)));
    await waitFor(() =>
      expect(container.querySelector('pre[aria-hidden="true"]')).toHaveTextContent("Hello from Elide!"),
    );
  });

  it("ignores a stale response after switching recording URLs", async () => {
    const responses = new Map<string, (response: Response) => void>();
    vi.stubGlobal("fetch", vi.fn((url: string) => new Promise<Response>(resolve => responses.set(url, resolve))));
    const view = render(<Terminal code="$ fallback" recording="/old.cast" />);
    await waitFor(() => expect(responses.has("/old.cast")).toBe(true));
    view.rerender(<Terminal code="$ fallback" recording="/new.cast" />);
    await waitFor(() => expect(responses.has("/new.cast")).toBe(true));
    await act(async () => responses.get("/new.cast")!(new Response(cast.replace("Hello", "Latest"))));
    expect(view.container.querySelector('pre[aria-hidden="true"]')).toHaveTextContent("Latest");
    await act(async () => responses.get("/old.cast")!(new Response(cast)));
    expect(view.container.querySelector('pre[aria-hidden="true"]')).toHaveTextContent("Latest");
    expect(view.container.querySelector('pre[aria-hidden="true"]')).not.toHaveTextContent("Hello");
  });

  it("preserves browser shortcuts and dismisses the poster after keyboard seeking", async () => {
    const user = userEvent.setup();
    const view = render(<Terminal code="$ x" recording={{ cast, poster: "first" }} />);
    screen.getByRole("group", { name: "Terminal recording" }).focus();
    await user.keyboard("{Control>}k{/Control}");
    expect(screen.getByRole("button", { name: "Play" })).toBeInTheDocument();
    await user.keyboard("{End}{Home}");
    expect(view.container.querySelector('button[aria-hidden="true"]')).toBeNull();
  });

  it("reports a recording that fails to load and keeps the transcript", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(new Response("nope", { status: 404 }))));
    const { container } = render(<Terminal code={"$ elide run"} recording={{ src: "/missing.cast" }} />);
    expect(await screen.findByText("Recording unavailable")).toBeInTheDocument();
    expect(container.querySelector('.eld-line[data-kind="command"]')).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Play" })).toBeDisabled();
  });

  it("autoplays, except under reduced motion", () => {
    const { unmount } = render(<Terminal code={"$ x"} recording={{ cast, autoplay: true }} />);
    expect(screen.getByRole("button", { name: "Pause" })).toBeInTheDocument();
    unmount();
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: query.includes("reduce"),
      addEventListener: () => {},
      removeEventListener: () => {},
    }));
    render(<Terminal code={"$ x"} recording={{ cast, autoplay: true }} />);
    expect(screen.getByRole("button", { name: "Play" })).toBeInTheDocument();
  });
});
