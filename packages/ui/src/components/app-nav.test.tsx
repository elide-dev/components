import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { AppNav } from "./app-nav";

const links = [
  { label: "Docs", href: "#docs", active: true },
  { label: "Enterprise", href: "#enterprise" },
  { label: "Blog", href: "#blog" },
  { label: "Pricing", href: "#pricing" },
];

describe("AppNav", () => {
  it("renders every link", () => {
    render(<AppNav links={links} />);
    expect(screen.getByRole("link", { name: "Docs" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Enterprise" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Blog" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Pricing" })).toBeInTheDocument();
  });

  it("marks the active link with aria-current, and only that link", () => {
    render(<AppNav links={links} />);
    expect(screen.getByRole("link", { name: "Docs" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Enterprise" })).not.toHaveAttribute("aria-current");
  });

  it("renders the install button", () => {
    render(<AppNav links={links} />);
    expect(screen.getByRole("link", { name: "Install" })).toBeInTheDocument();
  });

  it("calls onSearchClick when the search trigger is clicked", async () => {
    const user = userEvent.setup();
    const onSearchClick = vi.fn();
    render(<AppNav links={links} onSearchClick={onSearchClick} />);

    await user.click(screen.getByRole("button", { name: "Search" }));
    expect(onSearchClick).toHaveBeenCalledTimes(1);
  });
});
