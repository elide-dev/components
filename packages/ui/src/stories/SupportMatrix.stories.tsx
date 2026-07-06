import type { Meta, StoryObj } from "@storybook/react-vite";
import { SupportMatrix } from "../components/support-matrix";

const meta = {
  title: "Composites/SupportMatrix",
  component: SupportMatrix,
  parameters: { layout: "padded" },
} satisfies Meta<typeof SupportMatrix>;

export default meta;
type Story = StoryObj<typeof meta>;

export const NodeFs: Story = {
  args: {
    caption: "node:fs method support",
    rows: [
      { method: "readFile / readFileSync", status: "yes", notes: "All encodings." },
      { method: "writeFile / writeFileSync", status: "yes", notes: "Atomic replace supported." },
      { method: "readdir / stat", status: "yes", notes: "withFileTypes supported." },
      {
        method: "watch / watchFile",
        status: "no",
        notes: "Not yet implemented — tracking in v1.1.",
      },
    ],
  },
};

export const WithPartialSupport: Story = {
  args: {
    caption: "node:crypto method support",
    rows: [
      { method: "createHash / createHmac", status: "yes", notes: "SHA-1/256/384/512, MD5." },
      { method: "randomBytes / randomUUID", status: "yes", notes: "Backed by the host CSPRNG." },
      { method: "scrypt / pbkdf2", status: "partial", notes: "Async form only; sync pending." },
      { method: "createSign / createVerify", status: "no", notes: "Not yet implemented." },
    ],
  },
};
