import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { PageFooterNav } from "./page-footer-nav";

const prev = { label: "Getting Started", href: "#getting-started" };
const next = { label: "Configuration", href: "#configuration" };

describe("PageFooterNav", () => {
  it("renders a pagination landmark", () => {
    render(<PageFooterNav prev={prev} next={next} />);
    expect(screen.getByRole("navigation", { name: "Pagination" })).toBeInTheDocument();
  });

  it("renders the previous link with its label and href", () => {
    render(<PageFooterNav prev={prev} next={next} />);
    const link = screen.getByRole("link", { name: /Getting Started/ });
    expect(link).toHaveAttribute("href", "#getting-started");
    expect(link).toHaveTextContent("Previous");
  });

  it("renders the next link with its label and href", () => {
    render(<PageFooterNav prev={prev} next={next} />);
    const link = screen.getByRole("link", { name: /Configuration/ });
    expect(link).toHaveAttribute("href", "#configuration");
    expect(link).toHaveTextContent("Next");
  });

  it("omits the previous link when prev is not provided", () => {
    render(<PageFooterNav next={next} />);
    expect(screen.queryByText("Previous")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Configuration/ })).toBeInTheDocument();
  });

  it("omits the next link when next is not provided", () => {
    render(<PageFooterNav prev={prev} />);
    expect(screen.queryByText("Next")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Getting Started/ })).toBeInTheDocument();
  });

  it("merges a consumer className onto the nav", () => {
    render(<PageFooterNav prev={prev} className="custom-x" />);
    expect(screen.getByRole("navigation", { name: "Pagination" })).toHaveClass("custom-x");
  });
});
