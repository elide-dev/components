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

  it("renders the badge-plus-wordmark brand lockup, not the official full lockup", () => {
    // The nav's lockup is deliberately different artwork from
    // <ElideLogo form="full" />. Guards against it being silently swapped.
    const { container } = render(<AppNav links={links} />);
    const svgs = Array.from(container.querySelectorAll("svg[viewBox]"));
    const viewBoxes = svgs.map((s) => s.getAttribute("viewBox"));
    expect(viewBoxes).toContain("0 0 102.700292 114.027098"); // the filled badge
    expect(viewBoxes).toContain("0 0 179.42 42.36"); // the wide wordmark cut
    expect(viewBoxes).not.toContain("0 0 272.122583 90.385516"); // the full lockup
  });

  it("announces the brand once — the wordmark beside the mark is decorative", () => {
    render(<AppNav links={links} />);
    expect(screen.getAllByRole("img", { name: "Elide" })).toHaveLength(1);
  });

  it("uses a caller-supplied logo instead of the default lockup", () => {
    const { container } = render(
      <AppNav links={links} logo={<span data-testid="custom-logo">Custom</span>} />,
    );
    expect(screen.getByTestId("custom-logo")).toBeInTheDocument();
    expect(
      container.querySelector('svg[viewBox="0 0 102.700292 114.027098"]'),
    ).not.toBeInTheDocument();
  });
});
