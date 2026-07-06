import type { Meta, StoryObj } from "@storybook/react-vite";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "../components/tooltip";
import { Button } from "../components/button";

const meta = {
  title: "Primitives/Tooltip",
  parameters: { layout: "centered" },
} satisfies Meta;

export default meta;

/** Open by default so the surface is visible in a static snapshot. */
export const Default: StoryObj = {
  render: () => (
    <TooltipProvider>
      <Tooltip defaultOpen>
        <TooltipTrigger render={<Button variant="ghost" size="icon">?</Button>} />
        <TooltipContent sideOffset={8}>Search — ⌘K</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  ),
};
