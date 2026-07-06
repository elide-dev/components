import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { MobileNav } from "./mobile-nav";

const groups = [
  {
    label: "Introduction",
    items: [
      { label: "Overview", href: "#overview", active: true },
      { label: "Install Elide", href: "#install" },
    ],
  },
  {
    label: "By language",
    items: [{ label: "Python", href: "#python" }],
  },
];

describe("MobileNav", () => {
  it("renders the top app bar's hamburger and search buttons", () => {
    render(<MobileNav groups={groups} />);
    expect(screen.getByRole("button", { name: "Open navigation" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Search" })).toBeInTheDocument();
  });

  it("opens the drawer on hamburger click, revealing the grouped links", async () => {
    const user = userEvent.setup();
    render(<MobileNav groups={groups} />);

    // Sheet portals its content to document.body — not present until opened.
    expect(screen.queryByRole("link", { name: "Overview" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Open navigation" }));

    expect(screen.getByRole("navigation", { name: "Mobile navigation" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Overview" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Install Elide" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Python" })).toBeInTheDocument();
  });

  it("marks the active drawer item with aria-current", async () => {
    const user = userEvent.setup();
    render(<MobileNav groups={groups} />);
    await user.click(screen.getByRole("button", { name: "Open navigation" }));

    expect(screen.getByRole("link", { name: "Overview" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Install Elide" })).not.toHaveAttribute("aria-current");
  });

  it("fires onSearch when the bottom search bar is clicked", async () => {
    const user = userEvent.setup();
    const onSearch = vi.fn();
    render(<MobileNav groups={groups} onSearch={onSearch} />);

    await user.click(screen.getByRole("button", { name: /search or ask/i }));
    expect(onSearch).toHaveBeenCalledTimes(1);
  });
});
