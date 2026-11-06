import { I18nProvider } from "@elide/ui/i18n";
import he from "@elide/ui/locales/he";
import { Breadcrumbs } from "@elide/ui/components/breadcrumbs";
import { Dialog, DialogTrigger, DialogContent, DialogTitle } from "@elide/ui/components/dialog";
import { useRef, useState } from "preact/hooks";
import { Button } from "@elide/ui/components/button";
import { Switch } from "@elide/ui/components/switch";
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
    <section aria-label="Preact integration">
      <Switch aria-label="Preact state" checked={checked} onCheckedChange={next => setChecked(next)} />
      <Button ref={ref} onClick={event => { event.currentTarget.focus(); ref.current?.setAttribute("data-ref-checked", "true"); }}>
        {checked ? "Preact enabled" : "Preact disabled"}
      </Button>
      <Button render={<a href="#main" />}>Back to content</Button>
    </section>
    <I18nProvider locale="he" messages={he} data-testid="preact-i18n">
      <Breadcrumbs segments={[{ label: "Elide" }]} />
      <Dialog><DialogTrigger render={<Button data-testid="preact-i18n-dialog" />}>{he.mobileNav.dialogLabel}</DialogTrigger>
        <DialogContent><DialogTitle>{he.mobileNav.dialogLabel}</DialogTitle></DialogContent></Dialog>
    </I18nProvider>
  </>;
}
