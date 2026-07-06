import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { StatusBadge, type ApiStatus } from "./status-badge";

describe("StatusBadge", () => {
  const cases: [ApiStatus, string][] = [
    ["implemented", "Implemented"],
    ["supported", "Supported"],
    ["partial", "Partial"],
    ["missing", "Missing"],
    ["planned", "Planned"],
  ];

  it.each(cases)("renders the default label and a dot for status=%s", (status, label) => {
    const { container } = render(<StatusBadge status={status} />);
    expect(screen.getByText(label)).toBeInTheDocument();
    expect(container.querySelector("span > span.bg-current")).toBeInTheDocument();
  });

  it("allows overriding the label via the `label` prop", () => {
    render(<StatusBadge status="supported" label="31 of 38 methods" />);
    expect(screen.getByText("31 of 38 methods")).toBeInTheDocument();
    expect(screen.queryByText("Supported")).not.toBeInTheDocument();
  });

  it("allows overriding the label via children", () => {
    render(<StatusBadge status="partial">Custom child label</StatusBadge>);
    expect(screen.getByText("Custom child label")).toBeInTheDocument();
  });
});
