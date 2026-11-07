import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { CodeBlock } from "./code-block";
import { CodeGroup } from "./code-group";
import { Terminal } from "./terminal";

const group = (props: { syncKey?: string; defaultValue?: string } = {}) => (
  <CodeGroup {...props}>
    <Terminal title="bun" code={"bun add @elide/ui"} />
    <Terminal title="npm" code={"npm install @elide/ui"} />
    <CodeBlock lang="ts" code={"import '@elide/ui';"} />
  </CodeGroup>
);

afterEach(() => localStorage.clear());

describe("CodeGroup", () => {
  it("labels tabs from children and keeps every panel in the document", () => {
    render(group());
    expect(screen.getAllByRole("tab").map((tab) => tab.textContent)).toEqual(["bun", "npm", "ts"]);
    expect(screen.getByRole("tab", { name: "bun" })).toHaveAttribute("aria-selected", "true");
    expect(document.body).toHaveTextContent("npm install @elide/ui");
  });

  it("honors defaultValue", () => {
    render(group({ defaultValue: "npm" }));
    expect(screen.getByRole("tab", { name: "npm" })).toHaveAttribute("aria-selected", "true");
  });

  it("syncs groups sharing a key, and remembers the choice", async () => {
    const user = userEvent.setup();
    render(
      <>
        {group({ syncKey: "pm" })}
        {group({ syncKey: "pm" })}
      </>,
    );
    await user.click(screen.getAllByRole("tab", { name: "npm" })[0]);
    for (const tab of screen.getAllByRole("tab", { name: "npm" })) expect(tab).toHaveAttribute("aria-selected", "true");
    expect(localStorage.getItem("elide:code-group:pm")).toBe("npm");
  });

  it("restores a remembered choice on mount, ignoring unknown values", () => {
    localStorage.setItem("elide:code-group:pm", "npm");
    const { unmount } = render(group({ syncKey: "pm" }));
    expect(screen.getByRole("tab", { name: "npm" })).toHaveAttribute("aria-selected", "true");
    unmount();
    localStorage.setItem("elide:code-group:pm", "yarn");
    render(group({ syncKey: "pm" }));
    expect(screen.getByRole("tab", { name: "bun" })).toHaveAttribute("aria-selected", "true");
  });

  it("follows changes made in other tabs (storage events)", () => {
    render(group({ syncKey: "pm" }));
    act(() => {
      window.dispatchEvent(new StorageEvent("storage", { key: "elide:code-group:pm", newValue: "ts" }));
    });
    expect(screen.getByRole("tab", { name: "ts" })).toHaveAttribute("aria-selected", "true");
  });
});
