import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
import { FileText } from "lucide-react";
import { AiActions } from "../components/ai-actions";

const meta = {
  title: "Composites/AiActions",
  component: AiActions,
  parameters: { layout: "padded" },
} satisfies Meta<typeof AiActions>;

export default meta;
type Story = StoryObj<typeof meta>;

const pageMarkdown = `# Elide Overview

A polyglot runtime and toolchain in one native binary — run JS, TS, and
Python; compile Java and Kotlin; serve apps.

\`\`\`sh
curl elide.sh | bash
\`\`\`
`;

export const Default: Story = {
  args: {
    markdown: pageMarkdown,
    actions: [
      { label: "Open in Claude", href: "https://claude.ai/new?q=Elide+Overview", external: true },
      { label: "Open in ChatGPT", href: "https://chatgpt.com/?q=Elide+Overview", external: true },
      { label: "View as text", icon: <FileText aria-hidden className="h-[13px] w-[13px]" />, href: "#raw" },
    ],
  },
  render: (args) => (
    <div style={{ maxWidth: 260 }}>
      <AiActions {...args} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Use with AI")).toBeInTheDocument();
    await expect(canvas.getByRole("button", { name: /Copy as Markdown/ })).toBeInTheDocument();

    const claude = canvas.getByRole("link", { name: "Open in Claude" });
    await expect(claude).toHaveAttribute("target", "_blank");
    await expect(claude.getAttribute("rel")).toContain("noopener");
  },
};

export const CopyOnly: Story = {
  args: { markdown: pageMarkdown },
  render: (args) => (
    <div style={{ maxWidth: 260 }}>
      <AiActions {...args} />
    </div>
  ),
};
