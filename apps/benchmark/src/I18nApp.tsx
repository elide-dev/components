import React, { useState, useRef } from "react";
import {
  I18nProvider, localeInfo, supportedLocales, type SupportedLocale, type Messages,
  Breadcrumbs, PageFooterNav, CopyCommand, CodeBlock, TableOfContents, StatusBadge,
  Button, Dialog, DialogTrigger, DialogContent, DialogTitle,
  Tabs, TabsList, TabsTrigger, TabsContent, Switch,
  Sheet, SheetTrigger, SheetContent, SheetTitle,
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent,
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
  AnchoredPopover, CommandPalette,
} from "@elide/ui";
import he from "@elide/ui/locales/he";
import { loadMessages } from "@elide/ui/i18n/loader";

export function I18nApp() {
  const [{ locale, messages }, setLocale] = useState<{ locale: SupportedLocale; messages: Messages }>({ locale: "he", messages: he });
  const requestId = useRef(0);
  const [search, setSearch] = useState(false);
  const [error, setError] = useState("");
  const m = messages;
  return <I18nProvider locale={locale} messages={m} data-testid="locale-root">
    <header><a href="/" className="wordmark">Elide</a>
      <label>{m.appNav.language} <select data-testid="locale-select" value={locale} onChange={async event => {
        const next = event.target.value as SupportedLocale;
        const request = ++requestId.current;
        try {
          const messages = await loadMessages(next);
          if (request === requestId.current) { setLocale({ locale: next, messages }); setError(""); }
        } catch { if (request === requestId.current) setError("Could not load the selected language."); }
      }}>{supportedLocales.map(code => <option key={code} value={code}>{localeInfo[code].name}</option>)}</select></label>
    </header>
    <main>
      <h1>{m.appNav.docsBadge}</h1>
      {error && <p role="alert">{error}</p>}
      <Breadcrumbs segments={[{ label: "Elide", href: "/" }, { label: m.appNav.docsBadge }]} />
      <section className="i18n-controls" aria-label={m.sectionTabs.navLabel}>
        <Dialog><DialogTrigger render={<Button data-testid="dialog-trigger" />}>{m.mobileNav.dialogLabel}</DialogTrigger>
          <DialogContent><DialogTitle>{m.mobileNav.dialogLabel}</DialogTitle><p>{m.tableOfContents.title}</p></DialogContent></Dialog>
        <Sheet><SheetTrigger render={<Button data-testid="sheet-trigger" />}>{m.mobileNav.openNavigation}</SheetTrigger>
          <SheetContent side="start"><SheetTitle>{m.mobileNav.dialogLabel}</SheetTitle></SheetContent></Sheet>
        <DropdownMenu><DropdownMenuTrigger render={<Button data-testid="menu-trigger" />}>{m.sectionTabs.navLabel}</DropdownMenuTrigger>
          <DropdownMenuContent><DropdownMenuItem>{m.appNav.install}</DropdownMenuItem>
            <DropdownMenuSub><DropdownMenuSubTrigger data-testid="submenu-trigger">{m.appNav.language}</DropdownMenuSubTrigger>
              <DropdownMenuSubContent><DropdownMenuItem>{m.appNav.docsBadge}</DropdownMenuItem></DropdownMenuSubContent>
            </DropdownMenuSub></DropdownMenuContent></DropdownMenu>
        <Select defaultValue="a"><SelectTrigger aria-label={m.appNav.language}><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="a">{m.appNav.docsBadge}</SelectItem><SelectItem value="b">API</SelectItem></SelectContent></Select>
        <AnchoredPopover title={m.tableOfContents.title} trigger={<Button data-testid="anchor-trigger">{m.tableOfContents.title}</Button>}><p>{m.sidebar.comingSoon}</p></AnchoredPopover>
        <Button onClick={() => setSearch(true)} data-testid="search-trigger">{m.appNav.searchLabel}</Button>
        <label className="inline-flex items-center gap-2">{m.appNav.toggleTheme}<Switch data-testid="rtl-switch" /></label>
      </section>
      <section>
        <Tabs defaultValue="one"><TabsList aria-label={m.sectionTabs.navLabel}>
          <TabsTrigger value="one">{m.appNav.docsBadge}</TabsTrigger><TabsTrigger value="two">API</TabsTrigger>
        </TabsList><TabsContent value="one"><StatusBadge status="supported" /></TabsContent><TabsContent value="two"><StatusBadge status="planned" /></TabsContent></Tabs>
      </section>
      <section><CopyCommand command="curl elide.sh | bash" label={m.copyCommand.copy} /></section>
      <section><CodeBlock code={'const greeting = "שלום · 日本語 · 한국어 · 中文";'} lang="typescript" filename="example.ts" /></section>
      <section><TableOfContents activeId="i18n-first" items={[{ id: "i18n-first", label: m.appNav.docsBadge }, { id: "i18n-second", label: "API", depth: 1 }]} />
        <h2 id="i18n-first">{m.tableOfContents.title}</h2><h2 id="i18n-second">API</h2></section>
      <PageFooterNav prev={{ href: "#i18n-first", label: m.appNav.docsBadge }} next={{ href: "#i18n-second", label: "API" }} />
      <CommandPalette open={search} onOpenChange={setSearch} groups={[{ heading: m.appNav.docsBadge, items: [{ id: "ja", title: "日本語", keywords: "日本語 Japanese" }, { id: "ko", title: "한국어", keywords: "한국어 Korean" }] }]} />
    </main>
  </I18nProvider>;
}
