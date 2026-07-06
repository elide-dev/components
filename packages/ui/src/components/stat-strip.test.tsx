import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { StatStrip } from "./stat-strip";

const stats = [
  { value: "24", label: "Node modules" },
  { value: "94%", label: "Test262 pass rate", emphasis: true },
  { value: "89%", label: "WinterTC coverage" },
];

describe("StatStrip", () => {
  it("renders every stat's value and label", () => {
    render(<StatStrip stats={stats} />);
    for (const stat of stats) {
      expect(screen.getByText(stat.value)).toBeInTheDocument();
      expect(screen.getByText(stat.label)).toBeInTheDocument();
    }
  });

  it("renders one cell per stat", () => {
    const { container } = render(<StatStrip stats={stats} />);
    expect(container.querySelectorAll("dd")).toHaveLength(stats.length);
  });

  it("emphasizes only the flagged stat's value", () => {
    render(<StatStrip stats={stats} />);
    expect(screen.getByText("94%")).toHaveClass("text-[var(--primary)]");
    expect(screen.getByText("24")).not.toHaveClass("text-[var(--primary)]");
    expect(screen.getByText("89%")).not.toHaveClass("text-[var(--primary)]");
  });

  it("exposes an accessible label on the region", () => {
    const { container } = render(<StatStrip stats={stats} />);
    expect(container.querySelector("dl")).toHaveAttribute("aria-label", "Statistics");
  });

  it("accepts a custom aria-label", () => {
    const { container } = render(<StatStrip stats={stats} aria-label="Compatibility metrics" />);
    expect(container.querySelector("dl")).toHaveAttribute("aria-label", "Compatibility metrics");
  });
});
