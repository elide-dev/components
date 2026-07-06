import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { SectionTabs } from "./section-tabs";

const items = [
  { label: "Start", href: "#start" },
  { label: "Runtime", href: "#runtime", active: true },
  { label: "Toolchain", href: "#toolchain" },
];

describe("SectionTabs", () => {
  it("renders every item as a link", () => {
    render(<SectionTabs items={items} />);
    expect(screen.getByRole("link", { name: "Start" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Runtime" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Toolchain" })).toBeInTheDocument();
  });

  it("marks the active item with aria-current, and only that item", () => {
    render(<SectionTabs items={items} />);
    expect(screen.getByRole("link", { name: "Runtime" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "Start" })).not.toHaveAttribute("aria-current");
  });

  it("renders the version label", () => {
    render(<SectionTabs items={items} version={{ label: "v1.0.0-beta5", status: "ok" }} />);
    expect(screen.getByText("v1.0.0-beta5")).toBeInTheDocument();
  });

  it("calls onSelect with the item's href when clicked", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<SectionTabs items={items} onSelect={onSelect} />);

    await user.click(screen.getByRole("link", { name: "Toolchain" }));
    expect(onSelect).toHaveBeenCalledWith("#toolchain");
  });
});
