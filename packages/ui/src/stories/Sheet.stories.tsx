import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "../components/sheet";
import { Button } from "../components/button";

const meta = { title: "Primitives/Sheet", parameters: { layout: "centered" } } satisfies Meta;
export default meta;

export const Left: StoryObj = {
  render: () => (
    <Sheet defaultOpen>
      <SheetTrigger render={<Button variant="outline">Menu</Button>} />
      <SheetContent side="left" className="w-72">
        <SheetHeader>
          <SheetTitle>Navigation</SheetTitle>
          <SheetDescription>Docs sections and guides.</SheetDescription>
        </SheetHeader>
      </SheetContent>
    </Sheet>
  ),
};
