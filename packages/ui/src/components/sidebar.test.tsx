import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { Sidebar, SidebarGroup, SidebarItem, SectionSwitcher } from "./sidebar";

const sections = [
  { id: "start", title: "Start", subtitle: "Get running in minutes" },
  { id: "runtime", title: "Runtime", subtitle: "Run, serve, debug, and inspect" },
];

describe("SidebarItem", () => {
  it("renders a link with the given label and href", () => {
    render(<SidebarItem label="Debugging" href="#debugging" />);
    expect(screen.getByRole("link", { name: "Debugging" })).toHaveAttribute("href", "#debugging");
  });

  it("marks the active item with aria-current", () => {
    render(<SidebarItem label="Debugging" href="#debugging" active />);
    expect(screen.getByRole("link", { name: "Debugging" })).toHaveAttribute("aria-current", "page");
  });

  it("does not set aria-current on inactive items", () => {
    render(<SidebarItem label="REPL" href="#repl" />);
    expect(screen.getByRole("link", { name: "REPL" })).not.toHaveAttribute("aria-current");
  });

  it("renders external items with a trailing icon and target/rel", () => {
    render(<SidebarItem label="elide.dev" href="https://elide.dev" external />);
    const link = screen.getByRole("link", { name: "elide.dev" });
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    expect(link.querySelector("svg")).toBeInTheDocument();
  });

  it("fires onSelect when clicked", async () => {
    const onSelect = vi.fn();
    render(<SidebarItem label="Debugging" href="#debugging" onSelect={onSelect} />);
    await userEvent.click(screen.getByRole("link", { name: "Debugging" }));
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it("renders comingSoon items as non-navigating and marked 'Soon'", async () => {
    const onSelect = vi.fn();
    render(<SidebarItem label="Remote Debugging" comingSoon onSelect={onSelect} />);
    expect(screen.queryByRole("link", { name: /Remote Debugging/ })).not.toBeInTheDocument();
    const item = screen.getByText("Remote Debugging");
    expect(item).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByText("Soon")).toBeInTheDocument();
    await userEvent.click(item);
    expect(onSelect).not.toHaveBeenCalled();
  });
});

describe("SidebarGroup", () => {
  it("renders its label and every item", () => {
    render(
      <SidebarGroup
        label="Guides"
        items={[
          { label: "Debugging", href: "#debugging" },
          { label: "REPL", href: "#repl" },
        ]}
      />,
    );
    expect(screen.getByText("Guides")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Debugging" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "REPL" })).toBeInTheDocument();
  });
});

describe("Sidebar", () => {
  it("renders the section switcher and every group's items", () => {
    render(
      <Sidebar
        sections={sections}
        activeSectionId="runtime"
        groups={[{ label: "Guides", items: [{ label: "Debugging", href: "#debugging", active: true }] }]}
      />,
    );
    expect(screen.getByRole("navigation", { name: "Sidebar" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Runtime/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Debugging" })).toHaveAttribute("aria-current", "page");
  });
});

describe("SectionSwitcher", () => {
  it("opens to list every section and fires onSectionChange on select", async () => {
    const onSectionChange = vi.fn();
    render(<SectionSwitcher sections={sections} activeId="runtime" onSectionChange={onSectionChange} />);

    await userEvent.click(screen.getByRole("button", { name: /Runtime/ }));

    // The popup portals to document.body — `screen` already queries there.
    const option = await screen.findByRole("menuitem", { name: /Start/ });
    await userEvent.click(option);

    expect(onSectionChange).toHaveBeenCalledWith("start");
  });
});
