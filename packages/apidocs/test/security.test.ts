/**
 * Documentation comments and themes are untrusted: hostile URLs and markup
 * must never reach an attribute or execute. These inputs mirror known bypasses
 * of blocklist sanitizers.
 */
import { describe, expect, test } from "bun:test";
import type { Model } from "../src/model";
import { render } from "../src/render";
import { sanitize } from "../src/sanitize";
import { safeUrl } from "../src/url";
import { checkSite } from "./check";

describe("safeUrl", () => {
  const hostile = [
    "javascript:alert(1)", "JaVaScRiPt:alert(1)", " javascript:alert(1)", "\u0001javascript:alert(1)",
    "java\tscript:alert(1)", "java\nscript:alert(1)", "java\rscript:alert(1)", "jav&#x61;script:alert(1)",
    "&#106;avascript:alert(1)", "&#0000106avascript:alert(1)", "javascript&colon;alert(1)", "javascript&#58;alert(1)",
    "data:text/html,<script>alert(1)</script>", "DATA:text/html;base64,PHNjcmlwdD4=", "vbscript:msgbox(1)",
    "file:///etc/passwd", "blob:https://x/y", "\\\\evil/share", "java\u0000script:alert(1)",
    "jav&amp;#x61;script:alert(1)", "jav&amp;amp;#x61;script:alert(1)", "&amp;#106;avascript:alert(1)",
    "javascript&amp;colon;alert(1)", "javascript&amp;amp;colon;alert(1)", "java&Tab;script:alert(1)",
    "java&NewLine;script:alert(1)", "&amp;amp;amp;amp;amp;amp;#106;avascript:alert(1)",
  ];
  for (const url of hostile) test(`rejects ${JSON.stringify(url)}`, () => expect(safeUrl(url)).toBeUndefined());
  const fine = ["https://example.com/a?b#c", "HTTP://example.com", "mailto:a@example.com", "../x.html#y", "x.html", "a/b.html#read(java.io.InputStream)"];
  for (const url of fine) test(`keeps ${url}`, () => expect(safeUrl(url)).toBe(url));
});

describe("sanitize", () => {
  const cases: [string, string][] = [
    ['<b onclick="alert(1)">x</b>', "<b>x</b>"],
    ["<b onclick='alert(1)'>x</b>", "<b>x</b>"],
    ["<b onclick=alert(1)>x</b>", "<b>x</b>"],
    ['<b ONCLICK = "alert(1)">x</b>', "<b>x</b>"],
    ["<b/onclick=alert(1)>x</b>", "<b>x</b>"],
    ['<b onmouseover="a" title="t">x</b>', '<b title="t">x</b>'],
    ["<script>alert(1)</script>after", "after"],
    ["<SCRIPT src=//evil.js></SCRIPT>after", "after"],
    ["<img src=x onerror=alert(1)>", ""],
    ["<svg onload=alert(1)><circle/><script>alert(2)</script></svg>after", "after"],
    ['<iframe srcdoc="<script>alert(1)</script>"></iframe>after', "after"],
    ['<a href="jav&#x61;script:alert(1)">x</a>', "<a>x</a>"],
    ['<a href="&#x6A;avascript:alert(1)">x</a>', "<a>x</a>"],
    ['<a href=" javascript:alert(1)">x</a>', "<a>x</a>"],
    ['<a href="data:text/html,x">x</a>', "<a>x</a>"],
    ['<a href="vbscript:x">x</a>', "<a>x</a>"],
    ['<a href="https://example.com/" target="_blank" rel="opener">ok</a>', '<a href="https://example.com/">ok</a>'],
    ['<sup class="x" style="color:red" id="y">2</sup>', "<sup>2</sup>"],
    ["<style>body{display:none}</style>shown", "shown"],
    ["<math><mi>x</mi></math>shown", "shown"],
    ["<object data=x></object><embed src=x>", ""],
    ["<b>unclosed", "<b>unclosed</b>"],
    ['<a href="x>broken', ""],
    ["<b", ""],
    ["1 < 2 && 3 > 2", "1 &lt; 2 &amp;&amp; 3 &gt; 2"],
    ["<!-- <script>alert(1)</script> -->kept", "kept"],
    ["<p><script>alert(1)</script>ok</p>", "<p>ok</p>"],
    ["<unknown onclick=x>text</unknown>", "text"],
    ['<td colspan="2" rowspan="x" onclick="y">c</td>', '<td colspan="2">c</td>'],
    ['<th scope="col" scope="evil">h</th>', '<th scope="col">h</th>'],
    ['<span title="&quot;><script>alert(1)</script>">t</span>', '<span title="&quot;&gt;&lt;script&gt;alert(1)&lt;/script&gt;">t</span>'],
    ["</b>stray", "stray"],
  ];
  for (const [input, output] of cases) test(`sanitizes ${JSON.stringify(input)}`, () => expect(sanitize(input)).toBe(output));
});

describe("Markdown link destinations", () => {
  const model: Model = {
    schema: "apidocs/1",
    module: { name: "m", doc: { body: [{ kind: "paragraph", children: [
      { kind: "link", url: "https://example.com/a?b=1&amp;c=(x) y\"z'<w>`v\\", children: [{ kind: "text", text: "odd" }] },
      { kind: "link", url: "jav&amp;#x61;script:alert(1)", children: [{ kind: "text", text: "double" }] },
    ] }] } },
  };
  const md = render(model)["index.md"] as string;
  test("are percent-encoded so a Markdown renderer cannot reinterpret them", () => {
    const destination = /\[odd\]\(([^\s]*)\)/.exec(md)?.[1];
    expect(destination).toBe("https://example.com/a?b=1%26c=%28x%29%20y%22z%27%3Cw%3E%60v%5C");
    expect(destination).not.toMatch(/[&()<>"'`\\ ]/);
  });
  test("drop a doubly encoded script URL, keeping the label", () => {
    expect(md).toContain("double");
    expect(md).not.toMatch(/script:/i);
  });
});

describe("hostile models and themes", () => {
  const hostile: Model = {
    schema: "apidocs/1",
    module: { name: "evil", doc: { body: [{ kind: "paragraph", children: [
      { kind: "link", url: "javascript:alert(1)", children: [{ kind: "text", text: "click me" }] },
      { kind: "link", url: "jav&#x61;script:alert(2)", children: [{ kind: "text", text: "encoded" }] },
      { kind: "raw", html: '<img src=x onerror="alert(3)"><sup onclick=alert(4)>2</sup>', text: "2" },
    ] }, { kind: "raw", html: "<svg onload=alert(5)></svg><script>alert(6)</script>", text: "" }] } },
    externals: [{ prefix: "x.", url: "javascript:alert(7)//" }],
    packages: [{ id: "p", name: "p", types: [{
      id: "p.T", name: "T", kind: "class", language: "java",
      signature: [{ kind: "type", text: "Evil", ref: "x.Evil", url: "javascript:alert(8)" }],
      source: { path: "p/T.java", line: 1 },
      doc: { see: [[{ kind: "link", url: "data:text/html,<script>alert(9)</script>", children: [{ kind: "text", text: "see" }] }]] },
    }] }],
  };
  const theme = {
    links: { header: [{ label: "bad", url: "javascript:alert(10)" }, { label: "good", url: "https://example.com/" }], footer: [{ label: "bad", url: " vbscript:x" }] },
    sourceLink: "javascript:alert('{path}')",
    baseUrl: "javascript:alert(11)//",
  };
  const site = render(hostile, theme);

  test("the output has no event handlers and no unsafe URLs", () => {
    expect(checkSite(site, { allowed: ["https://example.com/"] })).toEqual([]);
    for (const [file, content] of Object.entries(site)) {
      if (typeof content !== "string" || !file.endsWith(".html")) continue;
      expect(content).not.toMatch(/javascript:|vbscript:|data:text|onerror|onload|onclick/i);
      expect(content).not.toMatch(/<script>alert/);
    }
  });
  test("unsafe links keep their labels as text", () => {
    expect(site["index.html"]).toContain("click me");
    expect(site["index.html"]).toContain("<sup>2</sup>");
    expect(site["p/T.html"]).toContain(">see<");
  });
  test("the theme's unsafe links, base URL and source template are dropped", () => {
    expect(site["index.html"]).toContain('href="https://example.com/"');
    expect(site["sitemap.xml"]).toBeUndefined();
    expect(site["p/T.html"]).not.toContain("source-link");
  });
  test("Markdown keeps labels and drops unsafe URLs", () => {
    for (const [file, content] of Object.entries(site)) {
      if (typeof content === "string" && file.endsWith(".md")) expect(content).not.toMatch(/javascript:|data:text|vbscript:/i);
    }
    expect(site["index.md"]).toContain("click me");
  });
  test("the checker catches what slips through", () => {
    expect(checkSite({ "a.html": '<b onclick="x">y</b><a href="javascript:x">z</a><a href="jav&#x61;script:x">w</a>' }, { allowed: [] })).toEqual([
      'a.html: event handler attribute in <b onclick="x">',
      "a.html: unsafe URL javascript:x",
      "a.html: unsafe URL jav&#x61;script:x",
    ]);
  });
});
