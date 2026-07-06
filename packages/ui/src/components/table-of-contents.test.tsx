import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
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
