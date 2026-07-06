import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  NavigationMenu,
  NavigationMenuList,
  NavigationMenuItem,
  NavigationMenuTrigger,
  NavigationMenuContent,
  NavigationMenuLink,
} from "../components/navigation-menu";

const meta = { title: "Primitives/NavigationMenu", parameters: { layout: "centered" } } satisfies Meta;
export default meta;

export const Default: StoryObj = {
  render: () => (
    <NavigationMenu>
      <NavigationMenuList>
        <NavigationMenuItem>
          <NavigationMenuLink href="#">Docs</NavigationMenuLink>
        </NavigationMenuItem>
        <NavigationMenuItem>
          <NavigationMenuTrigger>Product</NavigationMenuTrigger>
          <NavigationMenuContent>
            <NavigationMenuLink href="#">Runtime</NavigationMenuLink>
            <NavigationMenuLink href="#">Toolchain</NavigationMenuLink>
          </NavigationMenuContent>
        </NavigationMenuItem>
        <NavigationMenuItem>
          <NavigationMenuLink href="#">Pricing</NavigationMenuLink>
        </NavigationMenuItem>
      </NavigationMenuList>
    </NavigationMenu>
  ),
};
