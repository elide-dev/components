import type { Meta, StoryObj } from "@storybook/react-vite";
import { Popover, PopoverTrigger, PopoverContent } from "../components/popover";
import { Button } from "../components/button";

const meta = { title: "Primitives/Popover", parameters: { layout: "centered" } } satisfies Meta;
export default meta;

export const Default: StoryObj = {
  render: () => (
    <Popover defaultOpen>
      <PopoverTrigger render={<Button variant="outline">EN</Button>} />
      <PopoverContent aria-label="Language" className="w-48">
        <div className="text-sm text-foreground">English</div>
        <div className="text-sm text-muted-foreground">Español</div>
        <div className="text-sm text-muted-foreground">日本語</div>
      </PopoverContent>
    </Popover>
  ),
};
