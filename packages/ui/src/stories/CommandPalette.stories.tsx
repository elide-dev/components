import type { Meta, StoryObj } from "@storybook/react-vite";
import * as React from "react";
import { expect, screen, userEvent } from "storybook/test";
import { FileText, FileCode, Sparkles } from "lucide-react";
import { CommandPalette, type CommandGroup } from "../components/command-palette";

const groups: CommandGroup[] = [
  {
    heading: "Pages",
    items: [
      {
        id: "sqlite-js",
        title: "SQLite in JavaScript",
        subtitle: "API Reference · Database Modules",
        icon: <FileText />,
        keywords: "sqlite javascript database",
      },
      {
        id: "sqlite-host",
        title: "SQLite host module — elide:sqlite",
        subtitle: "API Reference · Host APIs",
        icon: <FileCode />,
        keywords: "sqlite host module",
      },
      {
        id: "sqlite-ex",
        title: "Example: JavaScript with SQLite",
        subtitle: "Code Samples",
        icon: <Sparkles />,
        keywords: "sqlite example javascript",
      },
    ],
  },
  {
    heading: "Actions",
    items: [
      { id: "ask-ai", title: "Ask AI about “sqlite”", icon: <Sparkles />, keywords: "ask ai sqlite" },
    ],
  },
];

const meta = {
  title: "Docs/CommandPalette",
  component: CommandPalette,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof CommandPalette>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Open by default, matching the mockup's ⌘K overlay state. */
export const Default: Story = {
  render: () => {
    const [open, setOpen] = React.useState(true);
    return (
      <div style={{ minHeight: "100vh", padding: 24 }}>
        <button
          type="button"
          onClick={() => setOpen(true)}
          style={{ font: "500 13px/1 'Inter',sans-serif" }}
        >
          Open palette (⌘K)
        </button>
        <CommandPalette open={open} onOpenChange={setOpen} groups={groups} />
      </div>
    );
  },
  // a11y regression guard: the overlay must be a labelled dialog and the search
  // field must have an accessible name (both required for screen-reader use).
  play: async () => {
    const dialog = await screen.findByRole("dialog", { name: "Command palette" });
    await expect(dialog).toBeInTheDocument();
    const input = screen.getByRole("textbox");
    await expect(input).toHaveAccessibleName();
  },
};

/** Wires a global ⌘K / Ctrl+K listener the way a real app would. */
export const WithGlobalShortcut: Story = {
  render: () => {
    const [open, setOpen] = React.useState(false);
    React.useEffect(() => {
      const onKey = (e: KeyboardEvent) => {
        if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
          e.preventDefault();
          setOpen((o) => !o);
        }
      };
      window.addEventListener("keydown", onKey);
      return () => window.removeEventListener("keydown", onKey);
    }, []);
    return (
      <div style={{ minHeight: "100vh", padding: 24 }}>
        <p style={{ font: "400 14px/1.6 'Inter',sans-serif" }}>
          Press <kbd>⌘K</kbd> (or <kbd>Ctrl+K</kbd>) to toggle the palette.
        </p>
        <CommandPalette open={open} onOpenChange={setOpen} groups={groups} />
      </div>
    );
  },
  play: async () => {
    await userEvent.keyboard("{Meta>}k{/Meta}");
    const dialog = await screen.findByRole("dialog", { name: "Command palette" });
    await expect(dialog).toBeInTheDocument();
  },
};
