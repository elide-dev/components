import React from "react";
import { Button } from "@elide/ui/components/button";
import { CommandPalette } from "@elide/ui/components/command-palette";
import { TableOfContents } from "@elide/ui/components/table-of-contents";

const topics = [
  "Projects", "Deployments", "Runtime", "Networking", "Storage",
  "Observability", "Access", "Operations",
];
const guides = [
  "Overview", "Configuration", "Environments", "Validation", "Release workflow",
  "Monitoring", "Troubleshooting", "Recovery", "Automation", "Reference",
];
const sections = topics.flatMap((topic, topicIndex) => guides.map((guide, guideIndex) => ({
  id: `performance-section-${String(topicIndex * guides.length + guideIndex + 1).padStart(2, "0")}`,
  label: `${topic}: ${guide.toLowerCase()}`,
  topic,
  guide,
})));
const commandGroups = ["Projects", "Deployments", "Environments", "Members", "Observability"];
const commandActions = ["Open", "Inspect", "Configure", "Compare", "Review"];

// Keep the document independent of search state, as a routed documentation
// page would be. Profiling a command should measure its component work.
const PerformanceDocument = React.memo(function PerformanceDocument() {
  return (
    <div className="performance-document">
      <article aria-label="Operations handbook" data-testid="performance-article">
        {sections.map(section => (
          <section key={section.id} aria-labelledby={section.id}>
            <h2 id={section.id}>{section.label}</h2>
            <p>
              Start with the current {section.topic.toLowerCase()} configuration and record the
              environment you intend to change. Review the existing values, their owners, and any
              dependent services before applying an update. Keeping this information together gives
              the next person enough context to understand both the desired result and the decisions
              that led to it. Use a separate preview environment when a change affects shared traffic.
            </p>
            <p>
              The {section.guide.toLowerCase()} workflow should stay reproducible. Store the relevant
              settings alongside the application, provide clear defaults, and validate required values
              before starting work. If a request fails, preserve its identifier and check the associated
              logs before retrying. A useful status message explains what completed, what is still
              pending, and which action is available next without exposing sensitive configuration.
            </p>
            <p>
              After a successful update, inspect health checks and compare the observed behavior with
              the previous release. Watch latency, error rates, and resource use over a representative
              period. Keep a known recovery path available while the change settles. Record any
              unexpected behavior in the deployment notes so future reviews can distinguish a normal
              variation from a regression and repeat the same verification in another environment.
            </p>
          </section>
        ))}
      </article>
      <aside className="performance-toc" aria-label="Handbook navigation">
        <TableOfContents items={sections} data-testid="performance-toc" />
      </aside>
    </div>
  );
});

export function PerformanceApp() {
  const [commandsOpen, setCommandsOpen] = React.useState(false);
  const [expanded, setExpanded] = React.useState(false);
  const [selection, setSelection] = React.useState("No command selected.");
  const groups = React.useMemo(() => commandGroups.map((heading, groupIndex) => ({
    heading,
    items: Array.from({ length: 50 }, (_, itemIndex) => {
      const number = String(itemIndex + 1).padStart(2, "0");
      const title = `${commandActions[itemIndex % commandActions.length]} ${heading.toLowerCase()} ${number}`;
      return {
        id: `performance-command-${groupIndex}-${itemIndex}`,
        title,
        keywords: `${title} production preview staging`,
        subtitle: itemIndex % 3 === 0
          ? `Review configuration and recent activity for workspace ${number}.`
          : undefined,
        onSelect: () => setSelection(`Selected: ${title}`),
      };
    }),
  })), []);

  return (
    <>
      <a className="skip" href="#main">Skip to content</a>
      <header>
        <a href="/" className="wordmark">Elide</a>
        <a href="/platform.html">Platform examples</a>
      </header>
      <main id="main">
        <p className="eyebrow">Performance examples</p>
        <h1>Room to grow.</h1>
        <p className="intro">
          An operations handbook with 80 sections and 250 searchable commands.
          Explore a longer document, change its layout, and move through a larger command list.
        </p>
        <div className="actions">
          <Button onClick={() => setCommandsOpen(true)} data-testid="performance-search">
            Search all commands
          </Button>
          <Button
            variant="outline"
            onClick={() => setExpanded(!expanded)}
            aria-expanded={expanded}
            aria-controls="performance-introduction"
            data-testid="performance-expand"
          >
            {expanded ? "Collapse introduction" : "Expand introduction"}
          </Button>
        </div>
        <p role="status" data-testid="performance-selection" className="performance-selection">
          {selection}
        </p>
        <div id="performance-introduction" hidden={!expanded} className="performance-introduction">
          <h2>Before you begin</h2>
          <p>
            Confirm the workspace, environment, and access level for the task at hand. A change to a
            shared service can affect several applications, so identify the owner and agree on a
            verification plan before updating its configuration. Keep the current release available
            while you inspect the result.
          </p>
          <p>
            Collect the relevant deployment notes, configuration history, and operational dashboards.
            Compare the desired outcome with the behavior you can observe today. This preparation
            makes it easier to choose a small, reversible change and communicate its progress to
            the people who depend on the service.
          </p>
          <p>
            The handbook below covers the same workflow across projects, deployments, runtime,
            networking, storage, observability, access, and operations. Each section can be reached
            directly from its navigation link, including after this introduction changes the page height.
          </p>
        </div>
        <CommandPalette open={commandsOpen} onOpenChange={setCommandsOpen} groups={groups} />
        <PerformanceDocument />
      </main>
      <footer><a href="/">Back to component examples</a></footer>
    </>
  );
}
