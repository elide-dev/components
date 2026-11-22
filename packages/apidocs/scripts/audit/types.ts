/**
 * Shared shapes for the audits: what a check found, who owns the fix, and how
 * a run reports a score against its threshold.
 */

/**
 * Who has to change for a finding to go away.
 * - page: the markup, CSS or client script of the pages (src/components, src/pages.tsx, src/styles, src/client).
 * - output: the set of files the renderer writes (src/render.tsx: llms.txt, sitemap.xml, robots.txt, JSON-LD content).
 * - host: the web server or CDN that serves the files (status codes, headers, compression, content negotiation).
 */
export type Owner = "page" | "output" | "host";

export type Status = "pass" | "partial" | "fail" | "na" | "review" | "info";

export interface Finding {
  /** The rule's stable id, such as "content-no-js" or "logical-properties". */
  rule: string;
  /** The rule's name for people. */
  name: string;
  status: Status;
  owner: Owner;
  /** Points earned and available, where the audit scores the rule. */
  score?: number;
  max?: number;
  /** What was measured, with numbers. */
  evidence: string;
  /** Pages or selectors the evidence came from, capped for the table. */
  where?: string[];
  /** The source file most likely to need the change. */
  file?: string;
  /** What to change. */
  fix?: string;
  /** Where the rule comes from. */
  source?: string;
}

export interface AuditResult {
  audit: "lighthouse" | "agentic" | "css";
  /** The site and page (or "site") audited, such as "java-elide index.html (mobile)". */
  target: string;
  /** 0 to 100, or undefined for a report with no score. */
  score?: number;
  threshold: number;
  /** Short failure labels for the table. */
  failures: string[];
  findings: Finding[];
  /** The path of the full report, relative to the report directory. */
  report?: string;
}

/** A built site under the audit server. */
export interface Site {
  /** "java-elide", "kotlin-neutral", "model-elide", ... */
  name: string;
  /** Absolute directory of the files. */
  dir: string;
  /** The site's URL under the audit server, with a trailing slash. */
  url: string;
  /** Pages to audit closely, as paths relative to the site root. */
  pages: RepresentativePages;
  /**
   * The URL a page (a path in dir, such as "index.html") is served at. Defaults to url + page; a site mirrored from
   * a server whose URLs differ from its file names (the Astro form, `--url`) maps them back.
   */
  urlOf?: (page: string) => string;
}

export interface RepresentativePages {
  overview: string;
  package: string;
  smallType: string;
  largestType: string;
  /** Every HTML page, for the checks that read all of them. */
  all: string[];
}
