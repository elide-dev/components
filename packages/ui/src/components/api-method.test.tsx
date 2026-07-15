import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { ApiMethod, ParamRow } from "./api-method";

describe("ParamRow", () => {
  it("renders the name, type, and description", () => {
    render(<ParamRow name="path" type="string | Buffer | URL" description="Filename to read." />);
    expect(screen.getByText("path")).toBeInTheDocument();
    expect(screen.getByText("string | Buffer | URL")).toBeInTheDocument();
    expect(screen.getByText("Filename to read.")).toBeInTheDocument();
  });

  it("omits the description span when no description is given", () => {
    render(<ParamRow name="signal" type="AbortSignal" />);
    expect(screen.getByText("signal")).toBeInTheDocument();
    expect(screen.getByText("AbortSignal")).toBeInTheDocument();
  });
});

describe("ApiMethod", () => {
  it("renders the signature and status badge", () => {
    const { container } = render(
      <ApiMethod signature="fs.readFile(path[, options], callback)" status="supported" />,
    );
    expect(container).toHaveTextContent("fs.readFile(path[, options], callback)");
    expect(screen.getByText("Supported")).toBeInTheDocument();
  });

  it("renders params via ParamRow", () => {
    render(
      <ApiMethod
        signature="fs.readFile()"
        params={[
          { name: "path", type: "string", description: "Filename." },
          { name: "callback", type: "Function", description: "Called on completion." },
        ]}
      />,
    );
    expect(screen.getByText("path")).toBeInTheDocument();
    expect(screen.getByText("callback")).toBeInTheDocument();
    expect(screen.getByText("Called on completion.")).toBeInTheDocument();
  });

  it("uses anchorId as the element id and links to it", () => {
    const { container } = render(<ApiMethod signature="fs.readFile()" anchorId="fs-readfile" />);
    expect(container.querySelector("#fs-readfile")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Link to/ })).toHaveAttribute("href", "#fs-readfile");
  });

  it("renders example content", () => {
    render(<ApiMethod signature="fs.readFile()" example={<div>{'console.log("hi")'}</div>} />);
    expect(screen.getByText('console.log("hi")')).toBeInTheDocument();
  });

  it("renders a non-string (ReactNode) signature as-is and labels the anchor generically", () => {
    render(
      <ApiMethod signature={<span data-testid="sig">custom signature node</span>} anchorId="custom" />,
    );
    expect(screen.getByTestId("sig")).toBeInTheDocument();
    // emphasizeSignature can't split a node, so the anchor uses the fallback name.
    expect(screen.getByRole("link", { name: "Link to this method" })).toHaveAttribute(
      "href",
      "#custom",
    );
  });

  it("leaves a signature with no parenthesis unsplit", () => {
    const { container } = render(<ApiMethod signature="fs.constants" />);
    expect(container).toHaveTextContent("fs.constants");
  });
});
