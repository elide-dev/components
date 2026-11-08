import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AiActions } from "../components/ai-actions";

describe("AiActions clipboard lifecycle", () => {
  const original = Object.getOwnPropertyDescriptor(navigator, "clipboard");
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    if (original) Object.defineProperty(navigator, "clipboard", original);
    else Reflect.deleteProperty(navigator, "clipboard");
  });
  function setup(writeText: (value: string) => Promise<void>) {
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    return render(<AiActions markdown="# docs" />);
  }
  it("keeps one timer across repeated clicks and clears it on unmount", async () => {
    const view = setup(vi.fn().mockResolvedValue(undefined));
    for (let i = 0; i < 5; i++) await act(async () => { fireEvent.click(screen.getByRole("button")); });
    expect(vi.getTimerCount()).toBe(1);
    expect(screen.getByRole("button")).toHaveAccessibleName(/copied/i);
    view.unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
  it("does not schedule feedback after a pending write completes on an unmounted control", async () => {
    let resolve!: () => void;
    const view = setup(() => new Promise<void>(done => { resolve = done; }));
    fireEvent.click(screen.getByRole("button"));
    view.unmount();
    await act(async () => resolve());
    expect(vi.getTimerCount()).toBe(0);
  });
  it("does not announce success when the Clipboard API is unavailable", async () => {
    setup(vi.fn());
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: undefined });
    await act(async () => { fireEvent.click(screen.getByRole("button")); });
    expect(screen.getByRole("button")).not.toHaveAccessibleName(/copied/i);
    expect(vi.getTimerCount()).toBe(0);
  });
  it("ignores stale results and does not announce a failed copy", async () => {
    let first!: () => void;
    const write = vi.fn().mockImplementationOnce(() => new Promise<void>(resolve => { first = resolve; }))
      .mockRejectedValueOnce(new Error("denied"));
    setup(write);
    fireEvent.click(screen.getByRole("button"));
    await act(async () => { fireEvent.click(screen.getByRole("button")); });
    await act(async () => first());
    expect(screen.getByRole("button")).not.toHaveAccessibleName(/copied/i);
    expect(vi.getTimerCount()).toBe(0);
  });
});
