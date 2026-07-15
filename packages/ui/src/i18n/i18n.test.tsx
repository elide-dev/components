import { renderHook } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { MessagesProvider } from "./provider";
import { useMessages } from "./context";
import type { PartialMessages } from "./messages";

describe("useMessages", () => {
  it("returns the English defaults when there is no provider", () => {
    const { result } = renderHook(() => useMessages());
    expect(result.current.appNav.navLabel).toBe("Main navigation");
    expect(result.current.codeBlock.copy).toBe("Copy");
    expect(result.current.tableOfContents.title).toBe("On this page");
  });
});

describe("MessagesProvider", () => {
  it("deep-merges a partial locale (two levels) over the defaults", () => {
    const messages: PartialMessages = {
      appNav: { searchLabel: "Buscar" },
      codeBlock: { copy: "Copiar" },
    };
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <MessagesProvider messages={messages}>{children}</MessagesProvider>
    );
    const { result } = renderHook(() => useMessages(), { wrapper });

    // Overridden keys change.
    expect(result.current.appNav.searchLabel).toBe("Buscar");
    expect(result.current.codeBlock.copy).toBe("Copiar");

    // Untouched keys within an overridden component keep the English value.
    expect(result.current.appNav.navLabel).toBe("Main navigation");
    expect(result.current.codeBlock.copied).toBe("Copied");

    // Components absent from the override are untouched entirely.
    expect(result.current.tableOfContents.title).toBe("On this page");
  });
});
