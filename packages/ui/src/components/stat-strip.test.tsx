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
    expect(screen.getByText("94%")).toHaveClass("text-[var(--primary-emphasis)]");
    expect(screen.getByText("24")).not.toHaveClass("text-[var(--primary-emphasis)]");
    expect(screen.getByText("89%")).not.toHaveClass("text-[var(--primary-emphasis)]");
  });

  it("exposes an accessible label on the region", () => {
    const { container } = render(<StatStrip stats={stats} />);
    expect(container.querySelector("dl")).toHaveAttribute("aria-label", "Statistics");
  });

  it("accepts a custom aria-label", () => {
    const { container } = render(<StatStrip stats={stats} aria-label="Compatibility metrics" />);
    expect(container.querySelector("dl")).toHaveAttribute("aria-label", "Compatibility metrics");
  });

  it("keeps consumer layout overrides on the semantic list", () => {
    const { container } = render(
      <StatStrip
        stats={stats}
        columns={2}
        id="metrics"
        className="gap-3"
        style={{ maxWidth: 320, gridTemplateColumns: "1fr 2fr" }}
      />,
    );
    const list = container.firstElementChild!;
    expect(list.tagName).toBe("DL");
    expect(list).toHaveAttribute("id", "metrics");
    expect(list).toHaveClass("gap-3");
    expect(list).toHaveStyle({ maxWidth: "320px", gridTemplateColumns: "1fr 2fr" });
    expect(list.querySelectorAll(":scope > div > dt")).toHaveLength(stats.length);
    expect(list.querySelectorAll(":scope > div > dd")).toHaveLength(stats.length);
  });

  it("renders an empty collection without an invalid column count", () => {
    const { container } = render(<StatStrip stats={[]} />);
    expect(container.firstElementChild).toHaveStyle({ "--eld-stat-columns": "1" });
    expect(container.querySelectorAll("dd")).toHaveLength(0);
  });
});
