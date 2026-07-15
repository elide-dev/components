import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { Breadcrumbs } from "./breadcrumbs";

const segments = [
  { label: "Runtime", href: "#runtime" },
  { label: "Guides" }, // no href → plain text
  { label: "Debugging" }, // last → current page
];

describe("Breadcrumbs", () => {
  it("renders the segments as an ordered list", () => {
    render(<Breadcrumbs segments={segments} />);
    const list = screen.getByRole("list");
    expect(list.tagName).toBe("OL");
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
  });

  it("marks the last segment as the current page and does not link it", () => {
    render(<Breadcrumbs segments={segments} />);
    const current = screen.getByText("Debugging");
    expect(current).toHaveAttribute("aria-current", "page");
    expect(current.tagName).toBe("SPAN");
    expect(screen.queryByRole("link", { name: "Debugging" })).not.toBeInTheDocument();
  });

  it("renders segments with an href as links", () => {
    render(<Breadcrumbs segments={segments} />);
    const link = screen.getByRole("link", { name: "Runtime" });
    expect(link).toHaveAttribute("href", "#runtime");
  });

  it("renders segments without an href as plain text", () => {
    render(<Breadcrumbs segments={segments} />);
    const guides = screen.getByText("Guides");
    expect(guides.tagName).toBe("SPAN");
    expect(guides).not.toHaveAttribute("aria-current");
    expect(screen.queryByRole("link", { name: "Guides" })).not.toBeInTheDocument();
  });

  it("renders a separator between segments, hidden from assistive tech", () => {
    const { container } = render(<Breadcrumbs segments={segments} />);
    const separators = container.querySelectorAll("svg[aria-hidden]");
    // One separator after every segment except the last.
    expect(separators).toHaveLength(segments.length - 1);
  });

  it("merges a consumer className onto the nav", () => {
    render(<Breadcrumbs segments={segments} className="custom-x" />);
    const nav = screen.getByRole("navigation", { name: "Breadcrumb" });
    expect(nav).toHaveClass("custom-x");
    expect(nav).toHaveClass("text-sm");
  });
});
