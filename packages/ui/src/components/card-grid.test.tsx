import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { CardGrid, FeatureCard } from "./card-grid";

describe("FeatureCard", () => {
  it("renders the title and description", () => {
    render(<FeatureCard title="API Overview" description="Runtime, globals, and modules." />);
    expect(screen.getByText("API Overview")).toBeInTheDocument();
    expect(screen.getByText("Runtime, globals, and modules.")).toBeInTheDocument();
  });

  it("renders a trailing badge", () => {
    render(<FeatureCard title="Node Compatibility" badge={<span>24</span>} />);
    expect(screen.getByText("24")).toBeInTheDocument();
  });

  it("renders as a link when given an href", () => {
    render(<FeatureCard title="Web Standards" href="/web-standards" />);
    expect(screen.getByRole("link", { name: /Web Standards/ })).toHaveAttribute(
      "href",
      "/web-standards",
    );
  });

  it("opens external links in a new tab with a safe rel and shows the external icon", () => {
    render(<FeatureCard title="Database Modules" href="https://example.com" external />);
    const link = screen.getByRole("link", { name: /Database Modules/ });
    expect(link).toHaveAttribute("target", "_blank");
    expect(link.getAttribute("rel")).toContain("noopener");
    expect(link.querySelector("svg")).toBeInTheDocument();
  });

  it("does not render as a link when no href is given", () => {
    render(<FeatureCard title="Host APIs" />);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("calls onSelect when clicked", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<FeatureCard title="Host APIs" href="#host-apis" onSelect={onSelect} />);
    await user.click(screen.getByRole("link", { name: /Host APIs/ }));
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it("is keyboard-activatable when rendered without an href", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<FeatureCard title="Database Modules" onSelect={onSelect} />);
    const card = screen.getByRole("button", { name: /Database Modules/ });
    card.focus();
    await user.keyboard("{Enter}");
    expect(onSelect).toHaveBeenCalledTimes(1);
  });
});

describe("CardGrid", () => {
  it("renders every child", () => {
    render(
      <CardGrid>
        <FeatureCard title="One" />
        <FeatureCard title="Two" />
        <FeatureCard title="Three" />
      </CardGrid>,
    );
    expect(screen.getByText("One")).toBeInTheDocument();
    expect(screen.getByText("Two")).toBeInTheDocument();
    expect(screen.getByText("Three")).toBeInTheDocument();
  });

  it("defaults to three columns", () => {
    const { container } = render(
      <CardGrid>
        <FeatureCard title="One" />
      </CardGrid>,
    );
    expect(container.firstChild).toHaveClass("lg:grid-cols-3");
  });

  it("applies a requested column count", () => {
    const { container } = render(
      <CardGrid columns={2}>
        <FeatureCard title="One" />
      </CardGrid>,
    );
    expect(container.firstChild).toHaveClass("sm:grid-cols-2");
    expect(container.firstChild).not.toHaveClass("lg:grid-cols-3");
  });
});
