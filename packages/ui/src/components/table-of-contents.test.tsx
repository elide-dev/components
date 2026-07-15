import { render, screen, act } from "@testing-library/react";
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

  it("degrades gracefully without IntersectionObserver when uncontrolled", () => {
    // jsdom has no IntersectionObserver; the component must not throw and
    // should render with no active item rather than self-managing state.
    expect(() => render(<TableOfContents items={items} />)).not.toThrow();
    const links = screen.getAllByRole("link");
    expect(links.every((link) => !link.hasAttribute("aria-current"))).toBe(true);
  });
});

describe("TableOfContents — scroll-spy", () => {
  // Minimal IntersectionObserver stub: capture the callback so the test can
  // drive section visibility manually (jsdom ships none).
  class MockIntersectionObserver {
    static instances: MockIntersectionObserver[] = [];
    callback: IntersectionObserverCallback;
    constructor(cb: IntersectionObserverCallback) {
      this.callback = cb;
      MockIntersectionObserver.instances.push(this);
    }
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords(): IntersectionObserverEntry[] {
      return [];
    }
    // Test helper: fire the observer callback with synthetic entries.
    emit(entries: { id: string; isIntersecting: boolean }[]) {
      const records = entries.map((e) => ({
        isIntersecting: e.isIntersecting,
        target: document.getElementById(e.id)!,
      })) as unknown as IntersectionObserverEntry[];
      act(() => this.callback(records, this as unknown as IntersectionObserver));
    }
  }

  beforeEach(() => {
    MockIntersectionObserver.instances = [];
    vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

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

  it("marks the intersecting section as current, then clears it when it leaves", () => {
    renderWithSections();
    const observer = MockIntersectionObserver.instances[0];
    expect(observer).toBeDefined();

    observer.emit([{ id: "installation", isIntersecting: true }]);
    expect(screen.getByRole("link", { name: "Installation" })).toHaveAttribute(
      "aria-current",
      "location",
    );

    observer.emit([{ id: "installation", isIntersecting: false }]);
    expect(screen.getByRole("link", { name: "Installation" })).not.toHaveAttribute("aria-current");
  });

  it("picks the first item in list order when several sections are visible", () => {
    renderWithSections();
    const observer = MockIntersectionObserver.instances[0];

    observer.emit([
      { id: "advanced", isIntersecting: true },
      { id: "installation", isIntersecting: true },
    ]);

    // Both visible, but "installation" precedes "advanced" in `items`.
    expect(screen.getByRole("link", { name: "Installation" })).toHaveAttribute(
      "aria-current",
      "location",
    );
    expect(screen.getByRole("link", { name: "Advanced usage" })).not.toHaveAttribute(
      "aria-current",
    );
  });

  it("does not scroll-spy when activeId is controlled", () => {
    render(
      <>
        <div id="overview">Overview section</div>
        <TableOfContents items={items} activeId="overview" />
      </>,
    );
    // The effect returns early for a controlled activeId — no observer created.
    expect(MockIntersectionObserver.instances).toHaveLength(0);
    expect(screen.getByRole("link", { name: "Overview" })).toHaveAttribute(
      "aria-current",
      "location",
    );
  });
});
