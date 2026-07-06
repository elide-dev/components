import * as React from "react";
import type { Preview, Decorator } from "@storybook/react-vite";

// Pulls in Tailwind + @elide/tokens (theme.css + fonts). One import themes the
// whole catalog.
import "@elide/ui/styles.css";

/** Global theme toggle in the toolbar. */
export const globalTypes = {
  theme: {
    description: "Color theme",
    defaultValue: "dark",
    toolbar: {
      title: "Theme",
      icon: "circlehollow",
      items: [
        { value: "light", title: "Light" },
        { value: "dark", title: "Dark" },
      ],
      dynamicTitle: true,
    },
  },
};

const withTheme: Decorator = (Story, context) => {
  const theme = context.globals.theme ?? "dark";
  // Drive the theme from <html>, not a wrapper div: Base UI overlays (Tooltip,
  // Popover, Dialog, …) render through a Portal into <body>, so they'd escape a
  // wrapper's `.dark` class and fall back to light tokens. Toggling the class on
  // documentElement themes portaled content too — and mirrors how a consuming app
  // applies the theme.
  React.useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", theme === "dark");
    return () => root.classList.remove("dark");
  }, [theme]);
  return (
    <div
      style={{
        background: "var(--background)",
        color: "var(--foreground)",
        fontFamily: "var(--eld-font-sans)",
        minHeight: "100vh",
        padding: 32,
      }}
    >
      <Story />
    </div>
  );
};

const preview: Preview = {
  decorators: [withTheme],
  parameters: {
    layout: "fullscreen",
    controls: { matchers: { color: /(background|color)$/i, date: /Date$/ } },
    a11y: { test: "todo" },
    // Chromatic snapshots every story in both themes.
    chromatic: {
      modes: {
        light: { theme: "light" },
        dark: { theme: "dark" },
      },
    },
  },
};

export default preview;
