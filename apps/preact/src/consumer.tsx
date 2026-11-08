import { I18nProvider } from "@elide/ui/i18n";
import he from "@elide/ui/locales/he";
import { Breadcrumbs } from "@elide/ui/components/breadcrumbs";
import { Dialog, DialogTrigger, DialogContent, DialogTitle } from "@elide/ui/components/dialog";
import { useRef, useState } from "preact/hooks";
import { Button } from "@elide/ui/components/button";
import { buttonVariants } from "@elide/ui/components/button-variants";
import { Switch } from "@elide/ui/components/switch";
import { Terminal } from "@elide/ui/components/terminal";
import { ElideLogo } from "@elide/ui/elements/logo";
import { App } from "../../benchmark/src/App";
import { PlatformApp } from "../../benchmark/src/PlatformApp";

// Exercise native Preact hooks, JSX, refs and callback types alongside the same
// production examples used by the React consumer. These imports use public UI
// entry points and its emitted declarations, never library source aliases.
export function Consumer({ platform }: { platform: boolean }) {
  const [checked, setChecked] = useState(false);
  const ref = useRef<HTMLButtonElement>(null);
  return <>
    {platform ? <PlatformApp /> : <App />}
    <section id="preact-integration" aria-label="Preact integration">
      <ElideLogo title="Preact element logo" height={checked ? 48 : 24} data-testid="preact-element-logo" />
      <Switch aria-label="Preact state" checked={checked} onCheckedChange={next => setChecked(next)} />
      <Button ref={ref} onClick={event => { event.currentTarget.focus(); ref.current?.setAttribute("data-ref-checked", "true"); }}>
        {checked ? "Preact enabled" : "Preact disabled"}
      </Button>
      <a href="#preact-integration" className={buttonVariants()}>Back to content</a>
    </section>
    <Terminal
      code={"$ elide run app.ts\nHello from Elide!"}
      recording={{ synthesize: { seed: 1 } }}
      data-testid="preact-terminal"
    />
    <I18nProvider locale="he" messages={he} data-testid="preact-i18n">
      <Breadcrumbs segments={[{ label: "Elide" }]} />
      <Dialog><DialogTrigger render={<Button data-testid="preact-i18n-dialog" />}>{he.mobileNav.dialogLabel}</DialogTrigger>
        <DialogContent><DialogTitle>{he.mobileNav.dialogLabel}</DialogTitle></DialogContent></Dialog>
    </I18nProvider>
  </>;
}
