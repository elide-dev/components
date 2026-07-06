import type { Meta, StoryObj } from "@storybook/react-vite";
import { ScrollArea } from "../components/scroll-area";

const meta = { title: "Primitives/ScrollArea", parameters: { layout: "centered" } } satisfies Meta;
export default meta;

export const Default: StoryObj = {
  render: () => (
    <ScrollArea className="h-48 w-64 rounded-lg border p-3">
      <div className="flex flex-col gap-2 text-sm text-muted-foreground">
        {Array.from({ length: 30 }, (_, i) => (
          <div key={i}>Sidebar item {i + 1}</div>
        ))}
      </div>
    </ScrollArea>
  ),
};
