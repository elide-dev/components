/**
 * Lighthouse, run programmatically against the audit server with the
 * Chromium that Playwright installs (the same one test/browser.test.ts uses;
 * point PLAYWRIGHT_BROWSERS_PATH at a Playwright browser directory). One
 * Chrome serves every run, one page at a time, so performance numbers do not
 * compete for the CPU.
 */
import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import * as chromeLauncher from "chrome-launcher";
import lighthouse, { type Flags } from "lighthouse";
import desktopConfig from "lighthouse/core/config/desktop-config.js";
import { chromium } from "playwright";
import type { Finding } from "./types";

export type FormFactor = "mobile" | "desktop";

export interface LighthouseRun {
  url: string;
  formFactor: FormFactor;
  lighthouseVersion: string;
  /** Category id to score, 0 to 100. agentic-browsing is Lighthouse's experimental category, scored as a fraction. */
  categories: Record<string, number | null>;
  /** Audits that count toward a category score and did not pass, with their category, weight and measured value. */
  failing: Finding[];
  /** Insights and diagnostics that did not pass but carry no weight. */
  advisories: Finding[];
  /** Core metrics, as Lighthouse displays them. */
  metrics: Record<string, string>;
}

export interface Lighthouse {
  run(url: string, formFactor: FormFactor, reportBase: string): Promise<LighthouseRun>;
  close(): Promise<void>;
}

export function chromiumPath(): string {
  const path = process.env.CHROME_PATH ?? chromium.executablePath();
  if (!existsSync(path)) {
    throw new Error(`No Chromium at ${path}. Set PLAYWRIGHT_BROWSERS_PATH to a Playwright ${chromiumVersionHint()} browser directory, run \`bunx playwright install chromium\`, or set CHROME_PATH.`);
  }
  return path;
}

function chromiumVersionHint(): string {
  try {
    return `1.${require("playwright/package.json").version.split(".")[1]}`;
  } catch {
    return "";
  }
}

export async function startLighthouse(): Promise<Lighthouse> {
  const probe = Bun.listen({ hostname: "127.0.0.1", port: 0, socket: { data() {} } });
  const port = probe.port;
  probe.stop(true);
  const chrome = await chromeLauncher.launch({
    port,
    chromePath: chromiumPath(),
    chromeFlags: ["--headless=new", "--no-sandbox", "--disable-gpu-sandbox"],
    logLevel: "silent",
  });
  return {
    async run(url, formFactor, reportBase) {
      const flags: Flags = { port: chrome.port, output: ["json", "html"], logLevel: "error" };
      const result = await lighthouse(url, flags, formFactor === "desktop" ? desktopConfig : undefined);
      if (!result) throw new Error(`Lighthouse returned nothing for ${url}`);
      const [json, html] = result.report as string[];
      writeFileSync(`${reportBase}.json`, json!);
      writeFileSync(`${reportBase}.html`, html!);
      return summarize(result.lhr, formFactor);
    },
    async close() {
      chrome.kill();
    },
  };
}

// The LHR type is large; this reads only what the summary needs.
interface Lhr {
  finalDisplayedUrl: string;
  lighthouseVersion: string;
  runtimeError?: { code: string; message: string };
  runWarnings: string[];
  categories: Record<string, { id: string; score: number | null; auditRefs: { id: string; weight: number }[] }>;
  audits: Record<string, { id: string; title: string; score: number | null; scoreDisplayMode: string; displayValue?: string; numericValue?: number; numericUnit?: string; details?: { type: string; items?: unknown[] }; metricSavings?: Record<string, number> }>;
}

function summarize(lhrInput: unknown, formFactor: FormFactor): LighthouseRun {
  const lhr = lhrInput as Lhr;
  if (lhr.runtimeError) throw new Error(`Lighthouse runtime error ${lhr.runtimeError.code}: ${lhr.runtimeError.message}`);
  const categories: Record<string, number | null> = {};
  const failing: Finding[] = [];
  const weighted = new Set<string>();
  for (const category of Object.values(lhr.categories)) {
    categories[category.id] = category.score === null ? null : Math.round(category.score * 100);
    for (const ref of category.auditRefs) {
      const audit = lhr.audits[ref.id];
      if (!audit || ref.weight === 0) continue;
      weighted.add(ref.id);
      if (audit.score === null || audit.score >= 1 || /notApplicable|informative|manual/.test(audit.scoreDisplayMode)) continue;
      failing.push({
        rule: audit.id, name: audit.title, owner: ownerOf(audit.id), status: audit.score === 0 ? "fail" : "partial",
        score: Math.round(audit.score * 100), max: 100,
        evidence: `${category.id} (weight ${ref.weight}): score ${Math.round(audit.score * 100)}${audit.displayValue ? `, ${audit.displayValue}` : ""}${audit.numericValue !== undefined ? ` (${round(audit.numericValue)} ${audit.numericUnit ?? ""})` : ""}`,
        where: items(audit.details),
        source: `https://developer.chrome.com/docs/lighthouse/`,
      });
    }
  }
  const advisories: Finding[] = [];
  for (const audit of Object.values(lhr.audits)) {
    if (weighted.has(audit.id) || audit.score === null || audit.score >= 1 || /notApplicable|informative|manual|error/.test(audit.scoreDisplayMode)) continue;
    const savings = audit.metricSavings ? Object.entries(audit.metricSavings).filter(([, v]) => v > 0).map(([k, v]) => `${k} -${round(v)}`).join(", ") : "";
    advisories.push({
      rule: audit.id, name: audit.title, owner: ownerOf(audit.id), status: "info",
      evidence: `unweighted: score ${Math.round(audit.score * 100)}${audit.displayValue ? `, ${audit.displayValue}` : ""}${savings ? `; metric savings ${savings}` : ""}`,
      where: items(audit.details),
    });
  }
  const metrics: Record<string, string> = {};
  for (const id of ["first-contentful-paint", "largest-contentful-paint", "total-blocking-time", "cumulative-layout-shift", "speed-index", "interactive"]) {
    if (lhr.audits[id]?.displayValue) metrics[id] = lhr.audits[id]!.displayValue!;
  }
  return { url: lhr.finalDisplayedUrl, formFactor, lighthouseVersion: lhr.lighthouseVersion, categories, failing, advisories, metrics };
}

/** Audits whose result depends on the server rather than the pages. */
const HOST_AUDITS = new Set(["uses-text-compression", "uses-long-cache-ttl", "cache-insight", "uses-http2", "modern-http-insight", "redirects", "server-response-time", "document-latency-insight", "is-on-https", "redirects-http", "has-hsts", "csp-xss", "origin-isolation", "clickjacking-mitigation", "http-status-code"]);
const OUTPUT_AUDITS = new Set(["robots-txt", "llms-txt", "ard-schema", "canonical", "hreflang", "structured-data"]);

function ownerOf(id: string): Finding["owner"] {
  return HOST_AUDITS.has(id) ? "host" : OUTPUT_AUDITS.has(id) ? "output" : "page";
}

function items(details: { type: string; items?: unknown[] } | undefined): string[] | undefined {
  if (!details?.items?.length) return undefined;
  return details.items.slice(0, 5).map(item => {
    const i = item as Record<string, unknown>;
    const node = i.node as { snippet?: string; selector?: string; nodeLabel?: string } | undefined;
    if (node) return `${node.selector ?? ""} ${node.snippet ?? node.nodeLabel ?? ""}`.trim().slice(0, 160);
    const parts = [i.url, i.source, i.label, i.wastedBytes !== undefined ? `wasted ${round(Number(i.wastedBytes))} B` : undefined, i.cacheLifetimeMs !== undefined ? `ttl ${i.cacheLifetimeMs} ms` : undefined]
      .filter(x => x !== undefined && x !== "" && typeof x !== "object");
    return parts.length ? parts.join(" ").slice(0, 160) : JSON.stringify(i).slice(0, 160);
  });
}

const round = (n: number) => (Math.abs(n) >= 100 ? Math.round(n) : Math.round(n * 100) / 100);

export function reportPath(dir: string, site: string, page: string, formFactor: FormFactor): string {
  return join(dir, "lighthouse", `${site}--${page.replace(/\//g, "_").replace(/\.html$/, "")}--${formFactor}`);
}
