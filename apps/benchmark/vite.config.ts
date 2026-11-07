import React from "react";
import { renderToString } from "react-dom/server";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwind from "@tailwindcss/vite";
import { App } from "./src/App.tsx";
import { PlatformApp } from "./src/PlatformApp.tsx";
import { PerformanceApp } from "./src/PerformanceApp.tsx";
import { CodeApp, source as codeSource } from "./src/CodeApp.tsx";
import { highlightCode } from "@elide/ui/components/shiki";
import { codeChromeScript } from "@elide/ui/components/code-surface-styles";

import { I18nApp } from "./src/I18nApp.tsx";

const pages = { "i18n.html": I18nApp, "platform.html": PlatformApp, "performance.html": PerformanceApp, "code.html": CodeApp };

export default defineConfig({
  appType: "mpa",
  plugins: [react(), tailwind(), {
    name: "prerender-example",
    transformIndexHtml: async (html, ctx) => {
      const page = Object.entries(pages).find(([path]) => ctx.path.endsWith(path))?.[1] ?? App;
      // Code samples are highlighted here, at build time, and handed to the client as data.
      const props = page === CodeApp ? { highlighted: await highlightCode(codeSource, "ts") } : {};
      const data = page === CodeApp
        ? `<script type="application/json" id="code-data">${JSON.stringify(props.highlighted).replace(/</g, "\\u003c")}</script>`
        : "";
      return html
        .replace("<!--chrome-script-->", `<script>${codeChromeScript}</script>`)
        .replace("<!--data-->", data)
        .replace("<!--app-->", renderToString(React.createElement(page, props)));
    },
  }],
  build: { target: "es2022", cssCodeSplit: true, rolldownOptions: { input: { index: "index.html", platform: "platform.html", performance: "performance.html", i18n: "i18n.html", code: "code.html" } } },
});
