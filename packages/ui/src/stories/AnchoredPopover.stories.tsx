import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { AnchoredPopover } from "../components/anchored-popover";
import { Button } from "../components/button";

const meta = {
  title: "Primitives/AnchoredPopover",
  component: AnchoredPopover,
  parameters: { layout: "centered" },
  args: {
    trigger: <Button variant="outline">Project settings</Button>,
    title: "Project settings",
    description: "A viewport-anchored panel with native CSS placement when available.",
    children: <p>Escape or the close button returns focus to the trigger.</p>,
  },
} satisfies Meta<typeof AnchoredPopover>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { args: { defaultOpen: true } };
export const FloatingFallback: Story = { args: { defaultOpen: true, positioning: "floating" } };
export const ViewportEdge: Story = {
  args: {
    defaultOpen: true,
    trigger: <Button className="fixed right-2 bottom-2" variant="outline">Project settings</Button>,
  },
};
export const Interaction: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const page = within(canvasElement.ownerDocument.body);
    const trigger = canvas.getByRole("button", { name: "Project settings" });
    await userEvent.click(trigger);
    await waitFor(() => expect(page.getByRole("dialog", { name: "Project settings" })).toBeVisible());
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(trigger).toHaveFocus());
  },
};
