import React from "react";
import { Button } from "@elide/ui/components/button";
import { Badge } from "@elide/ui/components/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@elide/ui/components/tabs";
import { Switch } from "@elide/ui/components/switch";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@elide/ui/components/accordion";
import { Dialog, DialogTrigger, DialogContent, DialogTitle, DialogDescription } from "@elide/ui/components/dialog";
import { CardGrid, FeatureCard } from "@elide/ui/components/card-grid";
import { CopyCommand } from "@elide/ui/components/copy-command";

export function App() {
  const [dark, setDark] = React.useState(false);
  React.useEffect(() => { document.documentElement.classList.toggle("dark", dark); }, [dark]);
  return <>
    <a className="skip" href="#main">Skip to content</a>
    <header><a href="#main" className="wordmark">Elide</a><label className="theme">Dark theme <Switch checked={dark} onCheckedChange={setDark} /></label></header>
    <main id="main">
      <p className="eyebrow">Elide components</p>
      <h1>Make room for<br />what matters.</h1>
      <p className="intro">Focused controls, thoughtful color, and motion that follows your lead. Built for the web.</p>
      <div className="actions"><Dialog><DialogTrigger render={<Button size="lg" />}>Explore the details</DialogTrigger><DialogContent><DialogTitle>Designed to work together</DialogTitle><DialogDescription>Use Tab to move through controls and Escape to close this dialog. Your focus returns to the trigger.</DialogDescription></DialogContent></Dialog><Button variant="outline" size="lg" render={<a href="#components" />}>Browse components</Button></div>
      <section id="components" aria-labelledby="components-heading"><h2 id="components-heading">A consistent foundation</h2>
        <Tabs defaultValue="overview"><TabsList aria-label="Component examples"><TabsTrigger value="overview">Overview</TabsTrigger><TabsTrigger value="install">Installation</TabsTrigger></TabsList><TabsContent value="overview"><CardGrid><FeatureCard title="Purposeful motion" description="Quick responses, gentle settling, and respect for reduced motion." /><FeatureCard title="Accessible by design" description="Keyboard navigation, clear focus, and semantic controls." badge={<Badge>Native</Badge>} /><FeatureCard title="Color with depth" description="Royal purple and muted rose, with progressive color enhancement." /></CardGrid></TabsContent><TabsContent value="install"><CopyCommand command="bun add @elide/ui @elide/tokens" /></TabsContent></Tabs>
      </section>
      <section aria-labelledby="questions-heading"><h2 id="questions-heading">Built for your workflow</h2><Accordion><AccordionItem value="keyboard"><AccordionTrigger>Can I use the keyboard?</AccordionTrigger><AccordionContent>Yes. Tabs support arrow keys, dialogs manage focus, and controls retain native keyboard behavior.</AccordionContent></AccordionItem><AccordionItem value="motion"><AccordionTrigger>What if I prefer less motion?</AccordionTrigger><AccordionContent>The components follow your system's reduced-motion preference.</AccordionContent></AccordionItem></Accordion></section>
    </main><footer>Elide · Interface components</footer>
  </>;
}
