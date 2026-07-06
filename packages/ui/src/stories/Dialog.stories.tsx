import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from "../components/dialog";
import { Button } from "../components/button";

const meta = { title: "Primitives/Dialog", parameters: { layout: "centered" } } satisfies Meta;
export default meta;

export const Default: StoryObj = {
  render: () => (
    <Dialog defaultOpen>
      <DialogTrigger render={<Button>Open</Button>} />
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Delete project</DialogTitle>
          <DialogDescription>
            This permanently removes the project and its deployments. This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose render={<Button variant="outline">Cancel</Button>} />
          <Button variant="gradient">Delete</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  ),
};
