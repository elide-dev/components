import React from "react";
import { CodeBlock } from "@elide/ui/components/code-block";
import { CodeSample } from "@elide/ui/components/code-sample";
import { Terminal } from "@elide/ui/components/terminal";

const ESC = "\x1b";

const source = `import { Database } from "elide:sqlite";

const db = new Database(":memory:");
db.exec("CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT)");
db.exec("INSERT INTO users (name) VALUES ('Elide')");

const user = db.prepare("SELECT * FROM users WHERE id = ?").get(1);
console.log(\`Hello from \${user.name}!\`);`;

const run = `$ elide run app.ts\n${ESC}[32m✓${ESC}[0m Hello from ${ESC}[1;35mElide${ESC}[0m!`;

export function CodeApp() {
  return <>
    <a className="skip" href="#main">Skip to content</a>
    <header><a href="/" className="wordmark">Elide</a></header>
    <main id="main">
      <p className="eyebrow">Code samples</p>
      <h1>Show the code,<br />then show it run.</h1>
      <p className="intro">Highlighted source with line decorations, terminal sessions that read like a real shell, and runs that replay in place.</p>
      <section aria-labelledby="sample-heading">
        <h2 id="sample-heading">Query SQLite from TypeScript</h2>
        <CodeSample layout="beside">
          <CodeBlock filename="app.ts" lang="ts" code={source} statusBar={false}
            decorations={[{ line: 1, kind: "highlight" }, { line: 7, kind: "breakpoint" }, { line: 8, kind: "cursor" }]} />
          <Terminal code={run} recording={{ synthesize: { seed: 2 }, autoplay: "visible" }} data-testid="code-recording" />
        </CodeSample>
      </section>
      <section aria-labelledby="session-heading">
        <h2 id="session-heading">A realistic session</h2>
        <Terminal
          prompt={{ user: "dev", host: "elide", cwd: "~/app", symbol: "❯" }}
          lang="zsh"
          lines={[
            { kind: "comment", text: "# Install dependencies, then run the tests" },
            { kind: "command", text: "elide install --frozen-lockfile 2>&1 | tee install.log", exitCode: 0 },
            { kind: "output", text: `${ESC}[2mResolved 42 packages in 118ms${ESC}[0m` },
            { kind: "command", text: "elide test", exitCode: 1 },
            { kind: "output", text: `${ESC}[31m✕${ESC}[0m sqlite › rejects duplicate ids ${ESC}[2m(see https://docs.elide.dev/guides/sqlite)${ESC}[0m` },
            { kind: "command", text: "FORCE_COLOR=1 elide test --update-snapshots && echo \"ok: $USER\"", exitCode: 0 },
            { kind: "output", text: `${ESC}[32m12 passed${ESC}[0m ${ESC}[2m(31ms)${ESC}[0m` },
          ]}
          data-testid="code-session"
        />
      </section>
    </main>
    <footer>Elide · Interface components · <a href="/">Overview</a></footer>
  </>;
}
