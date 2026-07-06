import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { SupportMatrix, type SupportRow } from "./support-matrix";

const rows: SupportRow[] = [
  { method: "readFile / readFileSync", status: "yes", notes: "All encodings." },
  { method: "scrypt / pbkdf2", status: "partial", notes: "Async form only; sync pending." },
  { method: "watch / watchFile", status: "no", notes: "Not yet implemented." },
];

describe("SupportMatrix", () => {
  it("renders a table with the provided rows", () => {
    render(<SupportMatrix rows={rows} />);
    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.getAllByRole("row")).toHaveLength(rows.length + 1); // + header row
  });

  it("renders method and notes text for each row", () => {
    render(<SupportMatrix rows={rows} />);
    expect(screen.getByText("readFile / readFileSync")).toBeInTheDocument();
    expect(screen.getByText("All encodings.")).toBeInTheDocument();
    expect(screen.getByText("scrypt / pbkdf2")).toBeInTheDocument();
    expect(screen.getByText("watch / watchFile")).toBeInTheDocument();
  });

  it("exposes an accessible label per status, never color alone", () => {
    render(<SupportMatrix rows={rows} />);
    expect(screen.getByRole("img", { name: "Supported" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Partial" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Not supported" })).toBeInTheDocument();
  });

  it("gives header cells scope=\"col\"", () => {
    render(<SupportMatrix rows={rows} />);
    for (const label of ["Method", "Status", "Notes"]) {
      expect(screen.getByRole("columnheader", { name: label })).toHaveAttribute("scope", "col");
    }
  });

  it("supports custom columns", () => {
    render(
      <SupportMatrix
        rows={rows}
        columns={[
          { key: "method", label: "API" },
          { key: "status", label: "Available", align: "center" },
          { key: "notes", label: "Detail" },
        ]}
      />,
    );
    expect(screen.getByRole("columnheader", { name: "API" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Available" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Detail" })).toBeInTheDocument();
  });

  it("sets an accessible caption on the table", () => {
    render(<SupportMatrix rows={rows} caption="node:fs method support" />);
    expect(screen.getByRole("table", { name: "node:fs method support" })).toBeInTheDocument();
  });

  it("merges a consumer className onto the root", () => {
    const { container } = render(<SupportMatrix rows={rows} className="custom-x" />);
    expect(container.firstChild).toHaveClass("custom-x");
  });
});
