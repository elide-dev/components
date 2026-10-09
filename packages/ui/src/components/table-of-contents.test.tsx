import { render, screen, act, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { TableOfContents } from "./table-of-contents";

const items = [
  { id: "overview", label: "Overview" },
  { id: "installation", label: "Installation" },
  { id: "advanced", label: "Advanced usage", depth: 1 },
];

describe("TableOfContents", () => {
  it("renders all items", () => {
    render(<TableOfContents items={items} activeId="overview" />);
    expect(screen.getByText("Overview")).toBeInTheDocument();
    expect(screen.getByText("Installation")).toBeInTheDocument();
    expect(screen.getByText("Advanced usage")).toBeInTheDocument();
  });

  it("marks the controlled activeId as current with primary styling", () => {
    render(<TableOfContents items={items} activeId="installation" />);
    const active = screen.getByRole("link", { name: "Installation" });
    expect(active).toHaveAttribute("aria-current", "location");
    expect(active).toHaveClass("text-[var(--primary-emphasis)]");

    const inactive = screen.getByRole("link", { name: "Overview" });
    expect(inactive).not.toHaveAttribute("aria-current");
  });

  it("indents nested items further than top-level ones", () => {
    render(<TableOfContents items={items} activeId="overview" />);
    const nested = screen.getByRole("link", { name: "Advanced usage" });
    const top = screen.getByRole("link", { name: "Overview" });
    expect(parseFloat(nested.style.paddingLeft)).toBeGreaterThan(
      parseFloat(top.style.paddingLeft),
    );
  });

  it("calls onSelect with the item id when clicked", async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();
    render(<TableOfContents items={items} activeId="overview" onSelect={onSelect} />);
    await user.click(screen.getByRole("link", { name: "Installation" }));
    expect(onSelect).toHaveBeenCalledWith("installation");
  });

  it("renders no active item when no headings are on the page", () => {
    expect(() => render(<TableOfContents items={items} />)).not.toThrow();
    const links = screen.getAllByRole("link");
    expect(links.every((link) => !link.hasAttribute("aria-current"))).toBe(true);
  });
});

describe("TableOfContents — scroll-spy", () => {
  // jsdom has no layout: give each section a settable viewport top.
  const tops: Record<string, number> = {};
  let frames: FrameRequestCallback[] = [];

  beforeEach(() => {
    frames = [];
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => frames.push(cb));
    vi.stubGlobal("cancelAnimationFrame", () => {});
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (
      this: HTMLElement,
    ) {
      return { top: tops[this.id] ?? 0 } as DOMRect;
    });
    Object.defineProperty(document.documentElement, "scrollHeight", {
      configurable: true,
      value: 10_000,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  function scrollTo(next: Record<string, number>) {
    Object.assign(tops, next);
    act(() => {
      // Two scroll events in one frame schedule a single update.
      fireEvent.scroll(window);
      fireEvent.scroll(window);
      expect(frames).toHaveLength(1);
      frames.splice(0).forEach((cb) => cb(0));
    });
  }

  function current() {
    return screen
      .getAllByRole("link")
      .filter((link) => link.getAttribute("aria-current") === "location")
      .map((link) => link.textContent);
  }

  function renderWithSections() {
    return render(
      <>
        <div id="overview">Overview section</div>
        <div id="installation">Installation section</div>
        <div id="advanced">Advanced section</div>
        <TableOfContents items={items} />
      </>,
    );
  }

  it("highlights the first entry above the first heading", () => {
    Object.assign(tops, { overview: 300, installation: 900, advanced: 1500 });
    renderWithSections();
    expect(current()).toEqual(["Overview"]);
  });

  it("highlights the last heading above the activation line", () => {
    Object.assign(tops, { overview: 300, installation: 900, advanced: 1500 });
    renderWithSections();

    scrollTo({ overview: -500, installation: 50, advanced: 650 });
    expect(current()).toEqual(["Installation"]);

    // Long section: its heading is far above, but it stays current.
    scrollTo({ overview: -3000, installation: -2400, advanced: 4000 });
    expect(current()).toEqual(["Installation"]);

    scrollTo({ overview: -3600, installation: -3000, advanced: 90 });
    expect(current()).toEqual(["Advanced usage"]);
  });

  it("highlights the lowest visible heading at the bottom of the page", () => {
    Object.assign(tops, { overview: 300, installation: 900, advanced: 1500 });
    renderWithSections();
    Object.defineProperty(document.documentElement, "scrollHeight", {
      configurable: true,
      value: window.innerHeight,
    });
    scrollTo({ overview: -200, installation: 40, advanced: 400 });
    expect(current()).toEqual(["Advanced usage"]);
  });

  it("does not scroll-spy when activeId is controlled", () => {
    Object.assign(tops, { overview: -100 });
    render(
      <>
        <div id="overview">Overview section</div>
        <div id="installation">Installation section</div>
        <TableOfContents items={items} activeId="overview" />
      </>,
    );
    Object.assign(tops, { overview: -500, installation: -100 });
    fireEvent.scroll(window);
    expect(frames).toHaveLength(0);
    expect(current()).toEqual(["Overview"]);
  });
});
