import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { CopyCommand } from "./copy-command";

describe("CopyCommand", () => {
  it("renders the command and the default prompt glyph", () => {
    render(<CopyCommand command="curl elide.sh | bash" />);
    expect(screen.getByText("curl elide.sh | bash")).toBeInTheDocument();
    expect(screen.getByText("$")).toBeInTheDocument();
  });

  it("supports a custom prompt glyph", () => {
    render(<CopyCommand command="elide run app.ts" prompt=">" />);
    expect(screen.getByText(">")).toBeInTheDocument();
  });

  it("gives the copy button an accessible name", () => {
    render(<CopyCommand command="curl elide.sh | bash" />);
    expect(screen.getByRole("button", { name: "Copy" })).toBeInTheDocument();
  });

  it("copies the command to the clipboard when the copy button is clicked", async () => {
    // `userEvent.setup()` installs its own clipboard stub as a getter-only
    // property, so it must be overridden *after* setup (and via
    // `defineProperty`, since plain assignment fails against the getter).
    const user = userEvent.setup();
    const writeText = vi.fn();
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });

    render(<CopyCommand command="curl elide.sh | bash" />);
    await user.click(screen.getByRole("button", { name: "Copy" }));

    expect(writeText).toHaveBeenCalledWith("curl elide.sh | bash");
  });
});
