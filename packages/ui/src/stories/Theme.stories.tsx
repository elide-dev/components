import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { ThemeProvider } from "../components/theme-provider";
import { useTheme } from "../components/theme-context";
import { Button } from "../components/button";

function ThemeToggleDemo() {
  const { theme, toggle } = useTheme();
  return (
    <Button variant="outline" onClick={toggle}>
      Theme: {theme}
    </Button>
  );
}

const meta = {
  title: "Composites/ThemeProvider",
  parameters: { layout: "centered" },
} satisfies Meta;

export default meta;

export const Toggle: StoryObj = {
  render: () => (
    <ThemeProvider>
      <ThemeToggleDemo />
    </ThemeProvider>
  ),
  play: async ({ canvasElement }) => {
    const button = within(canvasElement).getByRole("button");
    // The button text reflects the ThemeProvider's own theme (independent of the
    // Storybook theme decorator, which also touches <html>). Toggle, then assert
    // the reported theme changed and that <html> reflects *that* theme — reading
    // intent from the provider avoids coupling to the decorator's initial value.
    const initiallyDark = button.textContent?.includes("dark") ?? false;
    const expected = initiallyDark ? "Theme: light" : "Theme: dark";
    await userEvent.click(button);
    // Assert the exact toggled value (deterministic: theme initializes
    // synchronously, so nothing re-initializes over the click).
    await waitFor(() => expect(button.textContent).toBe(expected));
    await waitFor(() =>
      expect(document.documentElement.classList.contains("dark")).toBe(!initiallyDark),
    );
  },
};
