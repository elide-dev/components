import { Callout } from "../components/callout";
import { SupportMatrix } from "../components/support-matrix";
import { renderHook } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { MessagesProvider } from "./provider";
import { useMessages } from "./context";
import { en, type PartialMessages } from "./messages";

describe("useMessages", () => {
  it("returns the English defaults when there is no provider", () => {
    const { result } = renderHook(() => useMessages());
    expect(result.current.appNav.navLabel).toBe("Main navigation");
    expect(result.current.codeBlock.copy).toBe("Copy");
    expect(result.current.tableOfContents.title).toBe("On this page");
  });
});

describe("MessagesProvider", () => {
  it("deep-merges a partial locale (two levels) over the defaults", () => {
    const messages: PartialMessages = {
      appNav: { searchLabel: "Buscar" },
      codeBlock: { copy: "Copiar" },
    };
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <MessagesProvider messages={messages}>{children}</MessagesProvider>
    );
    const { result } = renderHook(() => useMessages(), { wrapper });

    // Overridden keys change.
    expect(result.current.appNav.searchLabel).toBe("Buscar");
    expect(result.current.codeBlock.copy).toBe("Copiar");

    // Untouched keys within an overridden component keep the English value.
    expect(result.current.appNav.navLabel).toBe("Main navigation");
    expect(result.current.codeBlock.copied).toBe("Copied");

    // Components absent from the override are untouched entirely.
    expect(result.current.tableOfContents.title).toBe("On this page");
  });
});

import { render, screen, fireEvent } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { vi } from "vitest";
import { I18nProvider } from "./provider";
import { useLocale } from "./locale-context";
import { loadMessages } from "./loader";
import { resolveLocale, supportedLocales } from "./locales";
import { Breadcrumbs } from "../components/breadcrumbs";
import { PageFooterNav } from "../components/page-footer-nav";
import { CommandPalette } from "../components/command-palette";
import { Dialog, DialogContent, DialogTitle } from "../components/dialog";
import { formatMessage, isolateText } from "./format";
import he from "./locales/he";
import ja from "./locales/ja";

describe("locale contracts", () => {
  it.each([
    ["zh-TW", "zh-Hant"], ["zh-HK", "zh-Hant"], ["zh-Hans-TW", "zh-Hans"],
    ["zh-CN", "zh-Hans"], ["zh", "zh-Hans"], ["iw-IL", "he"], ["ar-EG", "ar"],
    ["ja-JP", "ja"], ["ko-KR", "ko"], ["fr-CA", "fr"], ["bad_tag", "en"], ["xx", "en"],
  ])("resolves %s to %s", (tag, result) => expect(resolveLocale(tag)).toBe(result));

  it.each(supportedLocales)("loads the complete %s catalog", async locale => {
    const messages = await loadMessages(locale);
    expect(Object.keys(messages).sort()).toEqual(Object.keys(en).sort());
    for (const group of Object.keys(en) as (keyof typeof en)[]) {
      expect(Object.keys(messages[group]).sort()).toEqual(Object.keys(en[group]).sort());
    }
  });

  it("inherits nested overrides and does not leak messages between SSR requests", () => {
    function Label() { return <span>{useMessages().common.close}</span>; }
    const tree = (locale: string, messages: PartialMessages) => (
      <I18nProvider locale={locale} messages={messages}>
        <MessagesProvider messages={{ codeBlock: { copy: "custom" } }}><Label /></MessagesProvider>
      </I18nProvider>
    );
    expect(renderToString(tree("he", he))).toContain('lang="he" dir="rtl"');
    expect(renderToString(tree("he", he))).toContain(he.common.close);
    expect(renderToString(tree("ja", ja))).toContain(ja.common.close);
    expect(renderToString(tree("ja", ja))).not.toContain(he.common.close);
  });

  it("keeps locale context stable across unrelated provider renders", () => {
    const values: unknown[] = [];
    function Probe() { values.push(useLocale()); return null; }
    const view = render(<I18nProvider locale="he" messages={he}><Probe /></I18nProvider>);
    view.rerender(<I18nProvider locale="he" messages={he}><Probe /></I18nProvider>);
    expect(values[0]).toBe(values[1]);
  });

  it("localizes navigation and portaled close controls without mutating the document", () => {
    render(<I18nProvider locale="he" messages={he}>
      <Callout tone="warning" />
      <SupportMatrix rows={[{ method: "readFile()", status: "yes" }]} />
      <Breadcrumbs segments={[{ label: "API" }]} />
      <PageFooterNav next={{ href: "#api", label: "API" }} />
      <Dialog open modal={false}><DialogContent><DialogTitle>API</DialogTitle></DialogContent></Dialog>
    </I18nProvider>);
    expect(screen.getByRole("navigation", { name: he.breadcrumbs.navLabel })).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: he.pageFooterNav.navLabel })).toHaveTextContent(he.pageFooterNav.next);
    expect(screen.getByRole("note")).toHaveTextContent(he.callout.warning);
    expect(screen.getByRole("columnheader", { name: he.supportMatrix.method })).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toHaveAttribute("dir", "rtl");
    expect(screen.getByRole("dialog")).toHaveAttribute("lang", "he");
    expect(screen.getByRole("button", { name: he.common.close })).toBeInTheDocument();
    expect(document.documentElement.dir).not.toBe("rtl");
  });

  it("does not select a command while an IME composition is being confirmed", () => {
    const select = vi.fn();
    render(<I18nProvider locale="ja" messages={ja}>
      <CommandPalette open groups={[{ heading: "API", items: [{ id: "a", title: "API", onSelect: select }] }]} />
    </I18nProvider>);
    const input = screen.getByRole("textbox", { name: ja.commandPalette.placeholder });
    fireEvent.keyDown(input, { key: "Enter", isComposing: true });
    expect(select).not.toHaveBeenCalled();
    fireEvent.keyDown(input, { key: "Enter" });
    expect(select).toHaveBeenCalledOnce();
  });

  it("treats interpolation as text and isolates embedded identifiers", () => {
    expect(formatMessage("Link {name}", { name: "<script>" })).toBe("Link <script>");
    expect(isolateText("fs.readFile()")).toBe("\u2068fs.readFile()\u2069");
  });
});
