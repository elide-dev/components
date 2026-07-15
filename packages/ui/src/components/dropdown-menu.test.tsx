import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { useState } from "react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from "./dropdown-menu";

describe("DropdownMenu", () => {
  it("does not render its content until the trigger is activated", () => {
    render(
      <DropdownMenu>
        <DropdownMenuTrigger>Actions</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem>Edit</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Actions" })).toBeInTheDocument();
  });

  it("opens the menu on trigger click and shows its items", async () => {
    const user = userEvent.setup();
    render(
      <DropdownMenu>
        <DropdownMenuTrigger>Actions</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem>Edit</DropdownMenuItem>
          <DropdownMenuItem>Duplicate</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );

    await user.click(screen.getByRole("button", { name: "Actions" }));

    expect(await screen.findByRole("menu")).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Edit" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Duplicate" })).toBeInTheDocument();
  });

  it("fires an item's onClick and closes the menu on selection", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(
      <DropdownMenu>
        <DropdownMenuTrigger>Actions</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem onClick={onSelect}>Edit</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );

    await user.click(screen.getByRole("button", { name: "Actions" }));
    await user.click(await screen.findByRole("menuitem", { name: "Edit" }));

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("closes on Escape", async () => {
    const user = userEvent.setup();
    render(
      <DropdownMenu>
        <DropdownMenuTrigger>Actions</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem>Edit</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
    await user.click(screen.getByRole("button", { name: "Actions" }));
    expect(await screen.findByRole("menu")).toBeInTheDocument();

    await user.keyboard("{Escape}");

    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("renders a group with a label and a separator", async () => {
    const user = userEvent.setup();
    render(
      <DropdownMenu>
        <DropdownMenuTrigger>Actions</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuGroup>
            <DropdownMenuLabel>Account</DropdownMenuLabel>
            <DropdownMenuItem>Profile</DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem>Sign out</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );

    await user.click(screen.getByRole("button", { name: "Actions" }));

    expect(await screen.findByText("Account")).toHaveAttribute("data-slot", "dropdown-menu-label");
    expect(document.querySelector("[data-slot=dropdown-menu-group]")).toBeInTheDocument();
    expect(document.querySelector("[data-slot=dropdown-menu-separator]")).toBeInTheDocument();
  });

  it("marks a label as inset via data-inset", async () => {
    const user = userEvent.setup();
    render(
      <DropdownMenu>
        <DropdownMenuTrigger>Actions</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuGroup>
            <DropdownMenuLabel inset>Section</DropdownMenuLabel>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    );

    await user.click(screen.getByRole("button", { name: "Actions" }));

    expect(await screen.findByText("Section")).toHaveAttribute("data-inset", "true");
  });

  it("applies the destructive variant to an item via data-variant", async () => {
    const user = userEvent.setup();
    render(
      <DropdownMenu>
        <DropdownMenuTrigger>Actions</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem variant="destructive">Delete</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );

    await user.click(screen.getByRole("button", { name: "Actions" }));

    expect(await screen.findByRole("menuitem", { name: "Delete" })).toHaveAttribute(
      "data-variant",
      "destructive"
    );
  });

  it("renders a shortcut hint inside an item", async () => {
    const user = userEvent.setup();
    render(
      <DropdownMenu>
        <DropdownMenuTrigger>Actions</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem>
            Save
            <DropdownMenuShortcut>⌘S</DropdownMenuShortcut>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );

    await user.click(screen.getByRole("button", { name: "Actions" }));

    expect(await screen.findByText("⌘S")).toHaveAttribute("data-slot", "dropdown-menu-shortcut");
  });

  it("toggles a checkbox item and fires onCheckedChange", async () => {
    const user = userEvent.setup();
    const onCheckedChange = vi.fn();

    function Harness() {
      const [checked, setChecked] = useState(false);
      return (
        <DropdownMenu>
          <DropdownMenuTrigger>Actions</DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuCheckboxItem
              checked={checked}
              onCheckedChange={(value) => {
                onCheckedChange(value);
                setChecked(value);
              }}
              closeOnClick={false}
            >
              Show grid
            </DropdownMenuCheckboxItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );
    }

    render(<Harness />);
    await user.click(screen.getByRole("button", { name: "Actions" }));

    const item = await screen.findByRole("menuitemcheckbox", { name: "Show grid" });
    expect(item).toHaveAttribute("aria-checked", "false");

    await user.click(item);

    expect(onCheckedChange).toHaveBeenLastCalledWith(true);
    expect(
      screen.getByRole("menuitemcheckbox", { name: "Show grid" })
    ).toHaveAttribute("aria-checked", "true");
  });

  it("selects a radio item within a radio group", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();

    function Harness() {
      const [value, setValue] = useState("list");
      return (
        <DropdownMenu>
          <DropdownMenuTrigger>View</DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuRadioGroup
              value={value}
              onValueChange={(next) => {
                onValueChange(next);
                setValue(next);
              }}
            >
              <DropdownMenuRadioItem value="list" closeOnClick={false}>
                List
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="grid" closeOnClick={false}>
                Grid
              </DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      );
    }

    render(<Harness />);
    await user.click(screen.getByRole("button", { name: "View" }));

    expect(await screen.findByRole("menuitemradio", { name: "List" })).toHaveAttribute(
      "aria-checked",
      "true"
    );

    await user.click(screen.getByRole("menuitemradio", { name: "Grid" }));

    expect(onValueChange).toHaveBeenLastCalledWith("grid");
    expect(screen.getByRole("menuitemradio", { name: "Grid" })).toHaveAttribute(
      "aria-checked",
      "true"
    );
  });

  it("opens a submenu and reveals its content", async () => {
    const user = userEvent.setup();
    render(
      <DropdownMenu>
        <DropdownMenuTrigger>Actions</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>More</DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuItem>Archive</DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        </DropdownMenuContent>
      </DropdownMenu>
    );

    await user.click(screen.getByRole("button", { name: "Actions" }));

    const subTrigger = await screen.findByRole("menuitem", { name: "More" });
    expect(subTrigger).toHaveAttribute("data-slot", "dropdown-menu-sub-trigger");
    expect(screen.queryByRole("menuitem", { name: "Archive" })).not.toBeInTheDocument();

    await user.click(subTrigger);

    expect(await screen.findByRole("menuitem", { name: "Archive" })).toBeInTheDocument();
  });

  it("merges a consumer className onto the content popup", async () => {
    const user = userEvent.setup();
    render(
      <DropdownMenu>
        <DropdownMenuTrigger>Actions</DropdownMenuTrigger>
        <DropdownMenuContent className="custom-menu">
          <DropdownMenuItem>Edit</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );

    await user.click(screen.getByRole("button", { name: "Actions" }));

    expect(await screen.findByRole("menu")).toHaveClass("custom-menu");
  });

  it("exposes data-slot attributes on the trigger, content, and items", async () => {
    const user = userEvent.setup();
    render(
      <DropdownMenu>
        <DropdownMenuTrigger>Actions</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem>Edit</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
    const trigger = screen.getByRole("button", { name: "Actions" });
    expect(trigger).toHaveAttribute("data-slot", "dropdown-menu-trigger");

    await user.click(trigger);

    expect(await screen.findByRole("menu")).toHaveAttribute("data-slot", "dropdown-menu-content");
    expect(screen.getByRole("menuitem", { name: "Edit" })).toHaveAttribute(
      "data-slot",
      "dropdown-menu-item"
    );
  });
});
