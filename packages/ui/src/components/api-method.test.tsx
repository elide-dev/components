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
});
