import * as React from "react";
import { WrapText } from "lucide-react";
import { useMessages } from "../i18n/context";
import { CodeSurfaceBadge } from "./code-surface";
import { codeControlClassName } from "./code-surface-styles";
import { CopyButton } from "./copy-button";

export interface CodeSurfaceActionsProps {
  /** Language or shell badge. */
  lang?: string;
  /** Consumer controls, placed before the built-in ones. */
  children?: React.ReactNode;
  /** Show the wrap toggle in this state; omit to hide the toggle. */
  wrapped?: boolean;
  onWrapChange?: (wrapped: boolean) => void;
  /** Copied text; omit to hide the copy button. */
  copyValue?: string;
  /** Accessible name of the copy button (defaults to the localized "Copy"). */
  copyLabel?: string;
}

/** Title-bar controls shared by code surfaces: badge, extras, wrap toggle, copy. */
export function CodeSurfaceActions({ lang, children, wrapped, onWrapChange, copyValue, copyLabel }: CodeSurfaceActionsProps) {
  const m = useMessages();
  return (
    <>
      {lang ? <CodeSurfaceBadge>{lang}</CodeSurfaceBadge> : null}
      {children}
      {wrapped !== undefined ? (
        <button type="button" className={codeControlClassName} aria-label={m.codeBlock.wrap} aria-pressed={wrapped} onClick={() => onWrapChange?.(!wrapped)}>
          <WrapText aria-hidden />
        </button>
      ) : null}
      {copyValue ? <CopyButton value={copyValue} label="" copyLabel={copyLabel} className="px-1.5 py-1.5" /> : null}
    </>
  );
}
