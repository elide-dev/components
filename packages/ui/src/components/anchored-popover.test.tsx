import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AnchoredPopover } from "./anchored-popover";
import { Button } from "./button";

afterEach(() => vi.unstubAllGlobals());

describe.each([
  { supported: true, positioning: "auto" as const, expected: "css" },
  { supported: false, positioning: "auto" as const, expected: "floating" },
  { supported: true, positioning: "floating" as const, expected: "floating" },
])("AnchoredPopover ($expected, support=$supported, $positioning)", ({ supported, positioning, expected }) => {
  it("preserves naming, activation, Escape and focus restoration", async () => {
    vi.stubGlobal("CSS", { supports: () => supported });
    const user = userEvent.setup();
    render(<AnchoredPopover positioning={positioning} trigger={<Button>Settings</Button>}
      title="Project settings" description="Configure your project.">
      <label>Project name<input defaultValue="Example" /></label>
    </AnchoredPopover>);
    const trigger = screen.getByRole("button", { name: "Settings" });
    await user.tab();
    await user.keyboard("{Enter}");
    const popup = screen.getByRole("dialog", { name: "Project settings" });
    expect(popup).toHaveAccessibleDescription("Configure your project.");
    expect(popup).toHaveAttribute("data-positioning", expected);
    await user.keyboard("{Escape}");
    await waitFor(() => expect(popup).not.toBeInTheDocument());
    expect(trigger).toHaveFocus();
  });

  it("supports close controls and outside dismissal without losing trigger props", async () => {
    vi.stubGlobal("CSS", { supports: () => supported });
    const clicked = vi.fn();
    const user = userEvent.setup();
    render(<>
      <button>Outside</button>
      <AnchoredPopover positioning={positioning}
        trigger={<Button onClick={clicked} data-testid="anchor" style={{ color: "red" }}>Settings</Button>}
        title="Project settings" />
    </>);
    const trigger = screen.getByTestId("anchor");
    await user.click(trigger);
    expect(clicked).toHaveBeenCalledOnce();
    expect(trigger).toHaveStyle({ color: "rgb(255, 0, 0)" });
    await user.click(screen.getByRole("button", { name: "Close" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await user.click(trigger);
    await user.click(screen.getByRole("button", { name: "Outside" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });
});

it("keeps an outer native panel open when Escape dismisses a nested panel", async () => {
  vi.stubGlobal("CSS", { supports: () => true });
  const user = userEvent.setup();
  render(<AnchoredPopover trigger={<Button>Outer</Button>} title="Outer panel">
    <AnchoredPopover trigger={<Button>Inner</Button>} title="Inner panel" />
  </AnchoredPopover>);
  await user.click(screen.getByRole("button", { name: "Outer" }));
  const innerTrigger = screen.getByRole("button", { name: "Inner" });
  await user.click(innerTrigger);
  expect(screen.getByRole("dialog", { name: "Inner panel" })).toBeInTheDocument();
  await user.keyboard("{Escape}");
  await waitFor(() => expect(screen.queryByRole("dialog", { name: "Inner panel" })).not.toBeInTheDocument());
  expect(screen.getByRole("dialog", { name: "Outer panel" })).toBeInTheDocument();
  expect(innerTrigger).toHaveFocus();
});

it("retains the floating renderer for a focused server-rendered trigger", async () => {
  vi.stubGlobal("CSS", { supports: () => true });
  const user = userEvent.setup();
  const element = <>
    <AnchoredPopover trigger={<Button>Hydrated trigger</Button>} title="Hydrated panel" />
    <button>Next control</button>
  </>;
  const container = document.createElement("div");
  document.body.append(container);
  container.innerHTML = renderToString(element);
  const original = container.querySelector("button")!;
  original.focus();
  render(element, { hydrate: true, container });
  expect(screen.getByRole("button", { name: "Hydrated trigger" })).toBe(original);
  expect(original).toHaveFocus();

  await user.keyboard("{Enter}");
  expect(screen.getByRole("dialog", { name: "Hydrated panel" })).toHaveAttribute("data-positioning", "floating");
  await user.keyboard("{Escape}");
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  expect(original).toHaveFocus();

  await user.tab();
  expect(screen.getByRole("button", { name: "Next control" })).toHaveFocus();
  expect(screen.getByRole("button", { name: "Hydrated trigger" })).toBe(original);
  await user.click(screen.getByRole("button", { name: "Hydrated trigger" }));
  expect(screen.getByRole("dialog", { name: "Hydrated panel" })).toHaveAttribute("data-positioning", "floating");
});

it("enhances an unfocused, closed server-rendered panel after hydration", async () => {
  vi.stubGlobal("CSS", { supports: () => true });
  const user = userEvent.setup();
  const element = <AnchoredPopover trigger={<Button>Hydrated trigger</Button>} title="Hydrated panel" />;
  const container = document.createElement("div");
  document.body.append(container);
  container.innerHTML = renderToString(element);
  render(element, { hydrate: true, container });
  await user.click(screen.getByRole("button", { name: "Hydrated trigger" }));
  expect(screen.getByRole("dialog", { name: "Hydrated panel" })).toHaveAttribute("data-positioning", "css");
});

it.each(["defaultOpen", "open"] as const)("retains an initially %s panel during hydration and rerenders", async (openProp) => {
  vi.stubGlobal("CSS", { supports: () => true });
  const user = userEvent.setup();
  const element = <AnchoredPopover {...{ [openProp]: true }}
    trigger={<Button>Hydrated trigger</Button>} title="Hydrated panel">
    <label>Draft<input defaultValue="Saved" /></label>
  </AnchoredPopover>;
  const container = document.createElement("div");
  document.body.append(container);
  container.innerHTML = renderToString(element);
  const original = container.querySelector("button")!;
  const result = render(element, { hydrate: true, container });
  const panel = await screen.findByRole("dialog", { name: "Hydrated panel" });
  expect(panel).toHaveAttribute("data-positioning", "floating");
  expect(screen.getByRole("button", { name: "Hydrated trigger" })).toBe(original);
  await user.type(screen.getByRole("textbox", { name: "Draft" }), " draft");
  result.rerender(element);
  expect(screen.getByRole("dialog", { name: "Hydrated panel" })).toBe(panel);
  expect(screen.getByRole("textbox", { name: "Draft" })).toHaveValue("Saved draft");
});
