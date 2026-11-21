/**
 * Audits the static output: Lighthouse (performance, accessibility, best
 * practices, SEO, and the experimental agentic-browsing category, on mobile
 * and desktop), agent readiness (the checks Is Agentic scores, run locally),
 * and the good-css.com rules. AUDITS.md says where each rule comes from.
 *
 *   bun run audit [--only lighthouse,agentic,css] [--sample java,kotlin] [--preset neutral,elide]
 *                 [--model api.json] [--page path.html] [--theme theme.json]
 *                 [--lighthouse-sites first|all] [--form-factor mobile,desktop]
 *                 [--threshold N] [--threshold-lighthouse N] [--threshold-agentic N] [--threshold-css N]
 *                 [--host static|agent] [--no-base-url] [--no-build] [--out dir] [--json]
 *
 * Each site is built with dist/runner.mjs exactly as the doclet builds it, and
 * served on its own free localhost port for the run, with compression and
 * cache headers. Full reports go to a fresh temporary directory (or --out),
 * whose path is printed. Exits 1 when any score is below its threshold.
 */
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { samples } from "../samples";
import { agenticAudit } from "./audit/agentic";
import { buildDist, renderSite, representativePages } from "./audit/build";
import { cssAudit, type Stylesheet } from "./audit/css";
import { type FormFactor, type LighthouseRun, reportPath, startLighthouse } from "./audit/lighthouse";
import { type AuditServer, type HostProfile, serve } from "./audit/server";
import type { AuditResult, Site } from "./audit/types";

const args = process.argv.slice(2);
if (args.includes("--help") || args.includes("-h")) {
  console.log(readFileSync(new URL(import.meta.url), "utf8").split("*/")[0]!.replace(/^\/\*\*?|^ \* ?/gm, ""));
  process.exit(0);
}
const flag = (name: string) => {
  const at = args.indexOf(`--${name}`);
  return at < 0 ? undefined : args[at + 1];
};
const list = (name: string, fallback: string[]) => flag(name)?.split(",").map(s => s.trim()).filter(Boolean) ?? fallback;
const cwd = process.env.INIT_CWD ?? process.cwd();
const AUDITS = ["lighthouse", "agentic", "css"] as const;
const only = new Set(list("only", [...AUDITS]));
for (const a of only) if (!AUDITS.includes(a as (typeof AUDITS)[number])) throw new Error(`--only takes ${AUDITS.join(", ")}; got ${a}`);
const presets = list("preset", ["neutral", "elide"]);
const sampleNames = list("sample", ["java", "kotlin"]);
const modelPath = flag("model") ? resolve(cwd, flag("model")!) : undefined;
const formFactors = list("form-factor", ["mobile", "desktop"]) as FormFactor[];
const host = (flag("host") ?? "static") as HostProfile;
const base = Number(flag("threshold") ?? 100);
const threshold = { lighthouse: Number(flag("threshold-lighthouse") ?? base), agentic: Number(flag("threshold-agentic") ?? base), css: Number(flag("threshold-css") ?? base) };
const extraTheme = flag("theme") ? JSON.parse(readFileSync(resolve(cwd, flag("theme")!), "utf8")) : {};
const reportDir = flag("out") ? resolve(cwd, flag("out")!) : mkdtempSync(join(tmpdir(), "apidocs-audit-"));
mkdirSync(join(reportDir, "lighthouse"), { recursive: true });
const started = Date.now();

if (!args.includes("--no-build")) {
  console.log("  building dist/ ...");
  buildDist();
}

// Build each site under its own server, so each sits at a host root (llms.txt, robots.txt and sitemap.xml are root files).
const servers: AuditServer[] = [];
const sites: Site[] = [];
const inputs = modelPath
  ? presets.map(preset => ({ name: `model-${preset}`, preset, model: { path: modelPath } }))
  : sampleNames.flatMap(sample => {
      if (!samples[sample as keyof typeof samples]) throw new Error(`No sample named ${sample}; use ${Object.keys(samples).join(" or ")}`);
      return presets.map(preset => ({ name: `${sample}-${preset}`, preset, model: { json: JSON.stringify(samples[sample as keyof typeof samples]) } }));
    });
for (const input of inputs) {
  const dir = join(reportDir, "sites", input.name);
  const server = serve(dir, host);
  servers.push(server);
  const theme = { ...extraTheme, extends: extraTheme.extends ?? input.preset, ...(args.includes("--no-base-url") ? {} : { baseUrl: server.url }) };
  const stats = renderSite({ model: input.model, theme, out: dir, work: join(reportDir, "work", input.name) });
  const prefer = flag("page") ?? (modelPath ? "dev/elide/kotlin/api/Ir.html" : undefined);
  sites.push({ name: input.name, dir, url: server.url, pages: representativePages(dir, prefer) });
  console.log(`  ${input.name}: ${stats.files} files, ${(stats.bytes / 1e6).toFixed(1)} MB, at ${server.url}`);
}

const results: AuditResult[] = [];
let exitCode = 0;
try {
  for (const site of sites) {
    if (only.has("css")) {
      const sheets: Stylesheet[] = [
        { path: "assets/apidocs.css", css: readFileSync(join(site.dir, "assets/apidocs.css"), "utf8"), source: "src/styles/apidocs.css" },
        { path: "assets/theme.css", css: readFileSync(join(site.dir, "assets/theme.css"), "utf8"), source: "src/theme.ts (themeCss) and src/presets/*" },
      ];
      const css = cssAudit(sheets);
      const report = `css--${site.name}.json`;
      writeFileSync(join(reportDir, report), JSON.stringify(css, null, 2));
      results.push({ audit: "css", target: `${site.name} stylesheets`, score: css.score, threshold: threshold.css, failures: css.rules.filter(r => r.status !== "pass").map(r => `${r.rule} (${r.evidence.split(" ")[0]})`), findings: [...css.rules, ...css.checklist], report });
    }
    if (only.has("agentic")) {
      const agentic = await agenticAudit(site);
      const report = `agentic--${site.name}.json`;
      writeFileSync(join(reportDir, report), JSON.stringify(agentic, null, 2));
      const scored = agentic.findings.filter(f => f.status === "fail" || f.status === "partial");
      results.push({ audit: "agentic", target: `${site.name} (${agentic.pages.length} pages, host ${host})`, score: agentic.score, threshold: threshold.agentic, failures: scored.map(f => `${f.rule}${f.evidence.startsWith("[") ? "*" : ""} ${fmt(f.score)}/${f.max}`), findings: agentic.findings, report });
    }
  }

  if (only.has("lighthouse")) {
    const which = flag("lighthouse-sites") ?? "first";
    const lhSites = which === "all" ? sites : [sites.find(s => s.name.endsWith("-elide")) ?? sites[0]!];
    console.log(`  lighthouse: ${lhSites.length} site(s) x 4 pages x ${formFactors.length} form factors ...`);
    const lh = await startLighthouse();
    try {
      for (const site of lhSites) {
        const { overview, package: pkg, smallType, largestType } = site.pages;
        for (const page of [...new Set([overview, pkg, smallType, largestType])]) {
          for (const formFactor of formFactors) {
            const base = reportPath(reportDir, site.name, page, formFactor);
            const t = Date.now();
            let run: LighthouseRun;
            try {
              run = await lh.run(site.url + page, formFactor, base);
            } catch (e) {
              results.push({ audit: "lighthouse", target: `${site.name} ${page} ${formFactor}`, score: 0, threshold: threshold.lighthouse, failures: [`did not run: ${(e as Error).message.slice(0, 120)}`], findings: [] });
              continue;
            }
            const cats = ["performance", "accessibility", "best-practices", "seo", "agentic-browsing"];
            const scores = cats.map(c => run.categories[c]);
            const gated = scores.slice(0, 4).filter((s): s is number => s !== null && s !== undefined);
            writeFileSync(`${base}.summary.json`, JSON.stringify(run, null, 2));
            results.push({
              audit: "lighthouse", target: `${site.name} ${page} ${formFactor}`,
              score: Math.min(...gated), threshold: threshold.lighthouse,
              failures: [`P${scores[0]} A${scores[1]} BP${scores[2]} S${scores[3]} AG${scores[4] ?? "-"}`, ...run.failing.map(f => `${f.rule} ${f.score}`)],
              findings: [...run.failing, ...run.advisories],
              report: `${base.slice(reportDir.length + 1)}.html`,
            });
            console.log(`    ${site.name} ${page} ${formFactor}: P${scores[0]} A${scores[1]} BP${scores[2]} S${scores[3]} AG${scores[4] ?? "-"} (${((Date.now() - t) / 1000).toFixed(1)} s)`);
          }
        }
      }
    } finally {
      await lh.close();
    }
  }
} finally {
  for (const server of servers) server.stop();
}

// Report.
for (const r of results) if (r.score === undefined || r.score < r.threshold) exitCode = 1;
writeFileSync(join(reportDir, "summary.json"), JSON.stringify({ started: new Date(started).toISOString(), seconds: (Date.now() - started) / 1000, host, threshold, results }, null, 2));
writeFileSync(join(reportDir, "summary.md"), markdown(results));
if (args.includes("--json")) console.log(JSON.stringify(results.map(({ findings, ...r }) => r), null, 2));
else printTable(results);
console.log(`\n  reports: ${reportDir}  (summary.md, summary.json, lighthouse/*.html)`);
console.log(`  ${((Date.now() - started) / 1000).toFixed(0)} s; ${exitCode ? "below threshold" : "all scores at or above threshold"}\n`);
process.exit(exitCode);

function printTable(rows: AuditResult[]): void {
  const cells = rows.map(r => [r.audit, r.target, r.score === undefined ? "-" : `${r.score}`, `${r.score !== undefined && r.score >= r.threshold ? "ok" : "LOW"} (${r.threshold})`, r.failures.join(", ")]);
  const head = ["audit", "target", "score", "threshold", "failures"];
  const width = (i: number) => Math.min(i === 1 ? 60 : 20, Math.max(head[i]!.length, ...cells.map(c => c[i]!.length)));
  const line = (c: string[]) => "  " + c.map((v, i) => (i === 4 ? v : v.slice(0, width(i)).padEnd(width(i)))).join("  ");
  console.log("\n" + line(head));
  for (const c of cells) console.log(line([...c.slice(0, 4), wrap(c[4]!, 100, 2 + [0, 1, 2, 3].reduce((a, i) => a + width(i) + 2, 0))]));
}

function wrap(text: string, width: number, indent: number): string {
  const out: string[] = [];
  let current = "";
  for (const word of text.split(", ")) {
    if (current && current.length + word.length + 2 > width) {
      out.push(current + ",");
      current = word;
    } else current = current ? `${current}, ${word}` : word;
  }
  out.push(current);
  return out.join("\n" + " ".repeat(indent));
}

function markdown(rows: AuditResult[]): string {
  const lines = ["# apidocs audit", "", `Host profile: ${host}. Thresholds: ${JSON.stringify(threshold)}.`, "", "| Audit | Target | Score | Threshold | Failures |", "| --- | --- | ---: | ---: | --- |"];
  for (const r of rows) lines.push(`| ${r.audit} | ${r.target} | ${r.score ?? "-"} | ${r.threshold} | ${r.failures.join(", ").replace(/\|/g, "\\|")} |`);
  for (const r of rows) {
    const shown = r.findings.filter(f => f.status !== "pass" && f.status !== "na");
    if (!shown.length) continue;
    lines.push("", `## ${r.audit}: ${r.target}${r.report ? ` ([report](${r.report}))` : ""}`, "");
    for (const f of shown) {
      lines.push(`- **${f.rule}** (${f.status}, ${f.owner}${f.score !== undefined ? `, ${fmt(f.score)}/${f.max}` : ""}): ${f.evidence}${f.file ? ` File: \`${f.file}\`.` : ""}${f.fix ? ` Fix: ${f.fix}` : ""}`);
      for (const w of f.where ?? []) lines.push(`  - ${w.replace(/\n/g, " ")}`);
    }
  }
  return lines.join("\n") + "\n";
}

function fmt(n: number | undefined): string {
  return n === undefined ? "-" : Number.isInteger(n) ? `${n}` : n.toFixed(2);
}

