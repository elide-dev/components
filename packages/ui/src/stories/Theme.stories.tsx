import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";
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
    const before = document.documentElement.classList.contains("dark");
    await userEvent.click(button);
    await expect(document.documentElement.classList.contains("dark")).toBe(!before);
  },
};
