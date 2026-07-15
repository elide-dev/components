import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, beforeAll } from "vitest";
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from "./navigation-menu";

// jsdom is missing several browser APIs Base UI's NavigationMenu relies on.
beforeAll(() => {
  if (typeof window.PointerEvent === "undefined") {
    window.PointerEvent = class PointerEvent extends MouseEvent {} as typeof window.PointerEvent;
  }
  if (typeof window.ResizeObserver === "undefined") {
    window.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof window.ResizeObserver;
  }
});

function renderMenu() {
  return render(
    <NavigationMenu>
      <NavigationMenuList>
        <NavigationMenuItem>
          <NavigationMenuTrigger>Products</NavigationMenuTrigger>
          <NavigationMenuContent>
            <NavigationMenuLink href="#runtime">Runtime</NavigationMenuLink>
          </NavigationMenuContent>
        </NavigationMenuItem>
        <NavigationMenuItem>
          <NavigationMenuLink href="#docs">Docs</NavigationMenuLink>
        </NavigationMenuItem>
      </NavigationMenuList>
    </NavigationMenu>
  );
}

describe("NavigationMenu", () => {
  it("renders the top-level trigger and links", () => {
    renderMenu();
    expect(screen.getByRole("button", { name: /Products/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Docs" })).toBeInTheDocument();
  });

  it("applies the shared trigger style and data-slot to the trigger", () => {
    renderMenu();
    const trigger = screen.getByRole("button", { name: /Products/ });
    expect(trigger).toHaveAttribute("data-slot", "navigation-menu-trigger");
    // From navigationMenuTriggerStyle (navigation-menu-variants.ts).
    expect(trigger).toHaveClass("inline-flex");
  });

  it("keeps the popup content out of the DOM until opened", () => {
    renderMenu();
    expect(screen.queryByRole("link", { name: "Runtime" })).not.toBeInTheDocument();
  });

  it("reveals the content links when the trigger is opened", async () => {
    const user = userEvent.setup();
    renderMenu();

    await user.click(screen.getByRole("button", { name: /Products/ }));

    expect(await screen.findByRole("link", { name: "Runtime" })).toBeInTheDocument();
  });

  it("carries data-slot attributes on the menu structure", () => {
    const { container } = renderMenu();
    expect(
      container.querySelector('[data-slot="navigation-menu"]')
    ).toBeInTheDocument();
    expect(
      container.querySelector('[data-slot="navigation-menu-list"]')
    ).toBeInTheDocument();
    expect(
      container.querySelector('[data-slot="navigation-menu-item"]')
    ).toBeInTheDocument();
  });

  it("merges a consumer className on the root", () => {
    const { container } = render(
      <NavigationMenu className="my-nav">
        <NavigationMenuList>
          <NavigationMenuItem>
            <NavigationMenuLink href="#home">Home</NavigationMenuLink>
          </NavigationMenuItem>
        </NavigationMenuList>
      </NavigationMenu>
    );
    expect(container.querySelector('[data-slot="navigation-menu"]')).toHaveClass(
      "my-nav"
    );
  });
});
