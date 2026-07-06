import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
import { ApiMethod } from "../components/api-method";
import { CodeBlock } from "../components/code-block";

const meta = {
  title: "Composites/ApiMethod",
  component: ApiMethod,
  parameters: { layout: "padded" },
} satisfies Meta<typeof ApiMethod>;

export default meta;
type Story = StoryObj<typeof meta>;

const readFileExample = `const { readFile } = require("node:fs/promises");
const text = await readFile("./config.json", "utf8");
console.log(JSON.parse(text));`;

export const ReadFile: Story = {
  args: {
    signature: "fs.readFile(path[, options], callback)",
    status: "supported",
    anchorId: "fs-readfile",
    description: (
      <>
        Asynchronously reads the entire contents of a file. The <code>promises</code> variant
        returns the contents instead of using a callback.
      </>
    ),
    params: [
      { name: "path", type: "string | Buffer | URL", description: "Filename to read." },
      {
        name: "options",
        type: "Object | string",
        description: (
          <>
            <code>encoding</code> and <code>flag</code> — defaults to a Buffer.
          </>
        ),
      },
      {
        name: "callback",
        type: "Function",
        description: (
          <>
            Called with <code>(err, data)</code>.
          </>
        ),
      },
    ],
    example: <CodeBlock filename="example.ts" lang="ts" code={readFileExample} />,
  },
  render: (args) => (
    <div style={{ maxWidth: 720 }}>
      <ApiMethod {...args} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Supported")).toBeInTheDocument();
    await expect(canvas.getByText("path")).toBeInTheDocument();
    await expect(canvas.getByRole("link", { name: /Link to/ })).toHaveAttribute("href", "#fs-readfile");
  },
};
