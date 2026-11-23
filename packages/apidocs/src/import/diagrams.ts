/**
 * Drawing a suite's diagrams: the importer leaves each Mermaid fence as a diagram block with its source
 * (ImportResult.diagrams), and drawDiagrams asks a DiagramRenderer for each one's SVG. The renderer is an interface so
 * that tests, and hosts without a browser, can supply their own; mermaid.ts is the real one.
 */

import type { ImportResult } from "./markdown";
import { sanitizeSvg } from "./svg";

/** One drawing: the SVG with its accessible title and description, or Mermaid's error. */
export type DrawResult = { svg: string; title?: string; description?: string } | { error: string };

export interface DiagramRenderer {
  /**
   * Draws one diagram. The seed makes the SVG's ids deterministic and distinct: the same source and seed always give
   * the same SVG, and two seeds never share an id.
   */
  draw(source: string, seed: string): Promise<DrawResult>;
  close(): Promise<void>;
}

/**
 * Fills in the SVG, title and description of every pending diagram, in order, and closes the renderer. A diagram that
 * fails to draw, or whose SVG fails sanitizeSvg, gets an error diagnostic at its fence (at the line Mermaid names,
 * when it names one) and keeps no SVG, so its page shows the source.
 */
export async function drawDiagrams(result: ImportResult, renderer: DiagramRenderer): Promise<void> {
  const counts = new Map<string, number>();
  try {
    for (const { block, path, line } of result.diagrams) {
      const index = counts.get(path) ?? 0;
      counts.set(path, index + 1);
      const drawn = await renderer.draw(block.source, `${path}#${index}`);
      if ("error" in drawn) {
        // Mermaid counts the diagram's own lines from 1; the source starts on the line after the fence.
        const at = /\bline (\d+)/i.exec(drawn.error);
        result.diagnostics.push({ file: path, line: at ? line + Number(at[1]) : line, severity: "error", message: `Mermaid: ${firstLine(drawn.error)}` });
        continue;
      }
      const clean = sanitizeSvg(drawn.svg);
      if (!clean.ok) {
        result.diagnostics.push({ file: path, line, severity: "error", message: `Mermaid: the drawn SVG failed the sanitizer: ${clean.reason}` });
        continue;
      }
      block.svg = clean.svg;
      if (drawn.title) block.title = drawn.title;
      if (drawn.description) block.description = drawn.description;
    }
  } finally {
    await renderer.close();
  }
}

function firstLine(text: string): string {
  return text.trim().split("\n").map(l => l.trim()).filter(Boolean).join(" ").slice(0, 400);
}
