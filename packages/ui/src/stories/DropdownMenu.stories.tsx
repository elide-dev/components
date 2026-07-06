import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "../components/dropdown-menu";
import { Button } from "../components/button";

const meta = { title: "Primitives/DropdownMenu", parameters: { layout: "centered" } } satisfies Meta;
export default meta;

export const Default: StoryObj = {
  render: () => (
    <DropdownMenu defaultOpen>
      <DropdownMenuTrigger render={<Button variant="outline">Ask AI</Button>} />
      <DropdownMenuContent className="w-56">
        <DropdownMenuItem>Copy as Markdown</DropdownMenuItem>
        <DropdownMenuItem>View as plain text</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem>Open in ChatGPT</DropdownMenuItem>
        <DropdownMenuItem>Open in Claude</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  ),
};
