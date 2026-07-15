import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { CommandPalette, type CommandGroup } from "./command-palette";

function makeGroups(overrides?: {
  home?: () => void;
  docs?: () => void;
  python?: () => void;
}): CommandGroup[] {
  return [
    {
      heading: "Pages",
      items: [
        { id: "home", title: "Home", onSelect: overrides?.home },
        { id: "docs", title: "Docs", subtitle: "Read the docs", onSelect: overrides?.docs },
      ],
    },
    {
      heading: "Languages",
      items: [{ id: "py", title: "Python", keywords: "python snake", onSelect: overrides?.python }],
    },
  ];
}

describe("CommandPalette", () => {
  it("renders nothing while closed", () => {
    render(<CommandPalette open={false} groups={makeGroups()} />);
    expect(screen.queryByRole("button", { name: /Home/ })).not.toBeInTheDocument();
  });

  it("renders the search input, group headings, and items when open", () => {
    render(<CommandPalette open groups={makeGroups()} placeholder="Find anything" />);
    expect(screen.getByRole("textbox", { name: "Find anything" })).toBeInTheDocument();
    expect(screen.getByText("Pages")).toBeInTheDocument();
    expect(screen.getByText("Languages")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Home/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Python/ })).toBeInTheDocument();
  });

  it("filters items as the user types", async () => {
    const user = userEvent.setup();
    render(<CommandPalette open groups={makeGroups()} />);

    await user.type(screen.getByRole("textbox"), "python");

    expect(screen.getByRole("button", { name: /Python/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Home/ })).not.toBeInTheDocument();
    // The empty "Pages" group is dropped entirely.
    expect(screen.queryByText("Pages")).not.toBeInTheDocument();
  });

  it("shows the empty message when nothing matches", async () => {
    const user = userEvent.setup();
    render(<CommandPalette open groups={makeGroups()} emptyMessage="Nothing here" />);

    await user.type(screen.getByRole("textbox"), "zzzzz");

    expect(screen.getByText("Nothing here")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("fires the item's onSelect and requests close when clicked", async () => {
    const user = userEvent.setup();
    const home = vi.fn();
    const onOpenChange = vi.fn();
    render(<CommandPalette open onOpenChange={onOpenChange} groups={makeGroups({ home })} />);

    await user.click(screen.getByRole("button", { name: /Home/ }));

    expect(home).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("selects the item under the keyboard cursor on Enter", async () => {
    const user = userEvent.setup();
    const home = vi.fn();
    const docs = vi.fn();
    render(<CommandPalette open groups={makeGroups({ home, docs })} />);

    // Cursor starts on the first item (Home); ArrowDown moves to Docs.
    await user.keyboard("{ArrowDown}{Enter}");

    expect(docs).toHaveBeenCalledTimes(1);
    expect(home).not.toHaveBeenCalled();
  });

  it("wraps to the last item on ArrowUp from the top", async () => {
    const user = userEvent.setup();
    const python = vi.fn();
    render(<CommandPalette open groups={makeGroups({ python })} />);

    await user.keyboard("{ArrowUp}{Enter}");

    expect(python).toHaveBeenCalledTimes(1);
  });
});
