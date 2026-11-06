import React from "react";
import { Button } from "@elide/ui/components/button";
import { CardGrid, FeatureCard } from "@elide/ui/components/card-grid";
import { StatStrip } from "@elide/ui/components/stat-strip";
import { AnchoredPopover } from "@elide/ui/components/anchored-popover";
import { DeferredContent } from "@elide/ui/components/deferred-content";
import { ReadingProgress } from "@elide/ui/components/reading-progress";
import { TableOfContents } from "@elide/ui/components/table-of-contents";
import { CommandPalette } from "@elide/ui/components/command-palette";
import { Dialog, DialogTrigger, DialogContent, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@elide/ui/components/dialog";

const sections = [
  { id: "layout-guide", label: "Responsive layout" },
  { id: "motion-guide", label: "Motion and focus" },
  { id: "rendering-guide", label: "Rendering long pages" },
];
const settings = [
  ["Theme", "Apply the light or dark theme at the document root so portaled content and browser controls agree."],
  ["Density", "Set --eld-density: compact on a container when its cards or statistics need tighter spacing."],
  ["Columns", "Set a maximum column count. Intrinsic grids wrap automatically when their available space narrows."],
  ["Focus", "Use an accessible name for each control. Escape dismisses a panel and returns focus to its trigger."],
  ["Placement", "AnchoredPopover uses CSS positioning when supported and keeps the floating implementation as its fallback."],
  ["Motion", "System reduced-motion preferences disable overlay transitions and the decorative reading indicator."],
  ["Rendering", "DeferredContent keeps its children mounted and only defers browser layout and painting."],
  ["Navigation", "Place section headings outside deferred bodies so in-page links and the table of contents remain measurable."],
];

function Cards() {
  return <><FeatureCard title="Project settings" description="Keep each component responsive to its container." /><FeatureCard title="Runtime configuration" description="Use the same controls in a sidebar or a full-width page." /><FeatureCard title="Deployment" description="Preserve readable spacing as the available width changes." /></>;
}

export function PlatformApp() {
  const [dark, setDark] = React.useState(false);
  const [commandsOpen, setCommandsOpen] = React.useState(false);
  React.useEffect(() => { document.documentElement.classList.toggle("dark", dark); }, [dark]);
  return <>
    <ReadingProgress />
    <a className="skip" href="#main">Skip to content</a>
    <header><a href="/" className="wordmark">Elide</a><Button variant="outline" onClick={() => setDark(!dark)} aria-pressed={dark}>Dark theme</Button></header>
    <main id="main">
      <p className="eyebrow">Platform examples</p>
      <h1>Components in context.</h1>
      <p className="intro">Responsive containers, native positioning, and rendering that follows the reader.</p>
      <div className="actions">
        <AnchoredPopover trigger={<Button>Project details</Button>} title="Project details" description="This panel follows its trigger and remains inside the viewport."><Button variant="outline">Edit project</Button></AnchoredPopover>
        <AnchoredPopover positioning="floating" trigger={<Button variant="outline">Floating details</Button>} title="Floating details" description="The same accessible panel with the fallback positioning engine." />
        <Button variant="outline" onClick={() => setCommandsOpen(true)}>Search commands</Button>
        <Dialog><DialogTrigger render={<Button variant="outline" />}>Review settings</DialogTrigger><DialogContent className="w-[min(90vw,40rem)] max-w-none sm:max-w-none" data-testid="responsive-dialog"><DialogTitle>Review settings</DialogTitle><DialogDescription>The footer follows this panel's width.</DialogDescription><AnchoredPopover trigger={<Button variant="outline">Nested details</Button>} title="Nested details" description="Escape closes the child panel first." /><DialogFooter><DialogClose render={<Button variant="outline" />}>Cancel</DialogClose><DialogClose render={<Button />}>Save</DialogClose></DialogFooter></DialogContent></Dialog>
      </div>
      <CommandPalette open={commandsOpen} onOpenChange={setCommandsOpen} groups={[{ heading: "Project", items: [{ id: "settings", title: "Open settings" }, { id: "deploy", title: "Deploy project" }] }]} />
      <section aria-labelledby="layout-heading"><h2 id="layout-heading">One system, different spaces</h2>
        <CardGrid data-testid="wide-grid"><Cards /></CardGrid>
        <div className="platform-narrow" style={{ "--eld-density": "compact" } as React.CSSProperties}>
          <CardGrid data-testid="narrow-grid"><Cards /></CardGrid>
          <StatStrip data-testid="narrow-stats" stats={[{ label: "Projects", value: "12" }, { label: "Builds", value: "248" }, { label: "Regions", value: "3" }]} />
        </div>
      </section>
      <div className="platform-document">
        <article>{sections.map(section => <section key={section.id} aria-labelledby={section.id}>
          <h2 id={section.id}>{section.label}</h2>
          <DeferredContent intrinsicBlockSize="var(--platform-body-size, 59rem)"><dl className="platform-settings">{settings.map(([term, description]) => <div key={term}><dt>{term}</dt><dd>{description}</dd></div>)}</dl></DeferredContent>
        </section>)}</article>
        <aside><TableOfContents items={sections} /></aside>
      </div>
    </main><footer><a href="/">Back to component examples</a></footer>
  </>;
}
