import * as React from "react";
import { cn } from "../lib/utils";
import { formatMessage } from "../i18n/format";
import { useMessages } from "../i18n/context";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./tabs";

export interface CodeSampleProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * - `below` (default): stacked, in order.
   * - `beside`: side by side when the sample's container is at least 48rem wide,
   *   stacked otherwise.
   * - `tabs`: one tab per child.
   */
  layout?: "below" | "beside" | "tabs";
  /** Tab labels; default to each child's `filename`/`title`, else "Code", "Output", "Panel 3", …. */
  labels?: string[];
}

function childLabel(child: React.ReactElement, index: number, m: { code: string; output: string; panel: string }): string {
  const props = child.props as { filename?: unknown; title?: unknown };
  if (typeof props.filename === "string" && props.filename) return props.filename;
  if (typeof props.title === "string" && props.title) return props.title;
  if (index === 0) return m.code;
  return index === 1 ? m.output : formatMessage(m.panel, { n: index + 1 });
}

/**
 * CodeSample — pairs a `CodeBlock` with the `Terminal` that runs it (or any
 * set of code surfaces), below, beside, or as tabs.
 */
export function CodeSample({ layout = "below", labels, children, className, ...props }: CodeSampleProps) {
  const m = useMessages().codeSample;
  const items = React.Children.toArray(children).filter(React.isValidElement);

  if (layout === "tabs") {
    return (
      <div data-slot="code-sample" data-layout="tabs" className={className} {...props}>
        <Tabs defaultValue="0">
          <TabsList variant="line">
            {items.map((child, i) => (
              <TabsTrigger key={i} value={String(i)}>
                {labels?.[i] ?? childLabel(child, i, m)}
              </TabsTrigger>
            ))}
          </TabsList>
          {items.map((child, i) => (
            // Keep panels mounted so a recording keeps its position across tab switches.
            <TabsContent key={i} value={String(i)} keepMounted>
              {child}
            </TabsContent>
          ))}
        </Tabs>
      </div>
    );
  }

  return (
    <div data-slot="code-sample" data-layout={layout} className={cn("eld-code-sample", className)} {...props}>
      <div className="eld-code-sample-grid">{items}</div>
    </div>
  );
}
