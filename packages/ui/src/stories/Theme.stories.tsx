import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { ThemeProvider, useTheme } from "../components/theme-provider";
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
    const initial = button.textContent;
    await userEvent.click(button);
    await waitFor(() => expect(button.textContent).not.toBe(initial));
    const nowDark = button.textContent?.includes("dark") ?? false;
    await waitFor(() =>
      expect(document.documentElement.classList.contains("dark")).toBe(nowDark),
    );
  },
};
