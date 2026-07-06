import type { Meta, StoryObj } from "@storybook/react-vite";
import { Separator } from "../components/separator";

const meta = { title: "Primitives/Separator", parameters: { layout: "centered" } } satisfies Meta;
export default meta;

export const Horizontal: StoryObj = {
  render: () => (
    <div className="w-64 text-sm text-foreground">
      Docs
      <Separator className="my-3" />
      Enterprise
    </div>
  ),
};

export const Vertical: StoryObj = {
  render: () => (
    <div className="flex h-6 items-center gap-3 text-sm text-foreground">
      Docs
      <Separator orientation="vertical" />
      Blog
      <Separator orientation="vertical" />
      Pricing
    </div>
  ),
};
