import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { ElideLogo, ElideMark } from "./elide-logo";

describe("ElideLogo", () => {
  it("renders the mark and the wordmark by default, with the wordmark hidden", () => {
    const { container } = render(<ElideLogo />);
    const svgs = container.querySelectorAll("svg");
    expect(svgs).toHaveLength(2);
    // The wordmark is decorative alongside the mark.
    const hidden = container.querySelector("svg[aria-hidden]");
    expect(hidden).toBeInTheDocument();
  });

  it("exposes a single accessible image named Elide", () => {
    render(<ElideLogo />);
    // The wordmark's aria-hidden removes it from the tree, so only the mark is named.
    expect(screen.getByRole("img", { name: "Elide" })).toBeInTheDocument();
  });

  it("renders only the mark when markOnly is set", () => {
    const { container } = render(<ElideLogo markOnly />);
    const svgs = container.querySelectorAll("svg");
    expect(svgs).toHaveLength(1);
    expect(container.querySelector("svg[aria-hidden]")).not.toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Elide" })).toBeInTheDocument();
  });

  it("gives each mark on a page a distinct gradient id", () => {
    const { container } = render(
      <>
        <ElideMark />
        <ElideMark />
      </>,
    );
    const gradients = container.querySelectorAll("linearGradient");
    expect(gradients).toHaveLength(2);
    const [a, b] = Array.from(gradients).map((g) => g.getAttribute("id"));
    expect(a).toBeTruthy();
    expect(b).toBeTruthy();
    expect(a).not.toBe(b);
  });
});
