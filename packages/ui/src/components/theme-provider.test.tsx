import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import { ThemeProvider } from "./theme-provider";
import { useTheme } from "./theme-context";

function Consumer() {
  const { theme, setTheme, toggle } = useTheme();
  return (
    <div>
      <span data-testid="theme">{theme}</span>
      <button type="button" onClick={() => setTheme("light")}>
        set-light
      </button>
      <button type="button" onClick={toggle}>
        toggle
      </button>
    </div>
  );
}

/**
 * This jsdom setup exposes no working Storage (Node's own `localStorage` stub
 * shadows jsdom's and throws), so back it with an in-memory implementation.
 */
class MemoryStorage {
  private store = new Map<string, string>();
  get length() {
    return this.store.size;
  }
  getItem(key: string) {
    return this.store.has(key) ? this.store.get(key)! : null;
  }
  setItem(key: string, value: string) {
    this.store.set(key, String(value));
  }
  removeItem(key: string) {
    this.store.delete(key);
  }
  clear() {
    this.store.clear();
  }
  key(index: number) {
    return Array.from(this.store.keys())[index] ?? null;
  }
}

/** jsdom lacks matchMedia; build a minimal stub returning a fixed match. */
function stubMatchMedia(matches: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      matches,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  );
}

beforeEach(() => {
  vi.unstubAllGlobals();
  // Fresh storage per test; matchMedia stays undefined unless a test stubs it.
  vi.stubGlobal("localStorage", new MemoryStorage());
  document.documentElement.className = "";
  delete document.documentElement.dataset.theme;
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useTheme", () => {
  it("throws when used outside a ThemeProvider", () => {
    // Silence the expected React error boundary logging.
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<Consumer />)).toThrow(/useTheme must be used within a ThemeProvider/);
    spy.mockRestore();
  });
});

describe("ThemeProvider", () => {
  it("defaults to dark when there is no stored value and no matchMedia", () => {
    render(
      <ThemeProvider>
        <Consumer />
      </ThemeProvider>,
    );
    expect(screen.getByTestId("theme")).toHaveTextContent("dark");
    expect(document.documentElement).toHaveClass("dark");
    expect(document.documentElement.dataset.theme).toBe("dark");
  });

  it("reads the persisted value from localStorage under the default key", () => {
    window.localStorage.setItem("eld-theme", "light");
    render(
      <ThemeProvider>
        <Consumer />
      </ThemeProvider>,
    );
    expect(screen.getByTestId("theme")).toHaveTextContent("light");
    expect(document.documentElement).not.toHaveClass("dark");
    expect(document.documentElement.dataset.theme).toBe("light");
  });

  it("uses a custom storage key", () => {
    window.localStorage.setItem("my-key", "light");
    render(
      <ThemeProvider storageKey="my-key">
        <Consumer />
      </ThemeProvider>,
    );
    expect(screen.getByTestId("theme")).toHaveTextContent("light");
  });

  it("honors a light OS preference when nothing is stored", () => {
    stubMatchMedia(false);
    render(
      <ThemeProvider>
        <Consumer />
      </ThemeProvider>,
    );
    expect(screen.getByTestId("theme")).toHaveTextContent("light");
  });

  it("honors a dark OS preference when nothing is stored", () => {
    stubMatchMedia(true);
    render(
      <ThemeProvider defaultTheme="light">
        <Consumer />
      </ThemeProvider>,
    );
    expect(screen.getByTestId("theme")).toHaveTextContent("dark");
  });

  it("prefers a stored value over the OS preference", () => {
    stubMatchMedia(true); // OS says dark
    window.localStorage.setItem("eld-theme", "light");
    render(
      <ThemeProvider>
        <Consumer />
      </ThemeProvider>,
    );
    expect(screen.getByTestId("theme")).toHaveTextContent("light");
  });

  it("setTheme flips the theme, updates <html>, and persists it", async () => {
    const user = userEvent.setup();
    render(
      <ThemeProvider>
        <Consumer />
      </ThemeProvider>,
    );
    expect(screen.getByTestId("theme")).toHaveTextContent("dark");

    await user.click(screen.getByRole("button", { name: "set-light" }));

    expect(screen.getByTestId("theme")).toHaveTextContent("light");
    expect(document.documentElement).not.toHaveClass("dark");
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(window.localStorage.getItem("eld-theme")).toBe("light");
  });

  it("toggle flips between dark and light", async () => {
    const user = userEvent.setup();
    render(
      <ThemeProvider>
        <Consumer />
      </ThemeProvider>,
    );
    const toggle = screen.getByRole("button", { name: "toggle" });

    await user.click(toggle);
    expect(screen.getByTestId("theme")).toHaveTextContent("light");
    expect(window.localStorage.getItem("eld-theme")).toBe("light");

    await user.click(toggle);
    expect(screen.getByTestId("theme")).toHaveTextContent("dark");
    expect(document.documentElement).toHaveClass("dark");
    expect(window.localStorage.getItem("eld-theme")).toBe("dark");
  });
});
