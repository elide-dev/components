import React from "react";
import { renderToString } from "react-dom/server";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwind from "@tailwindcss/vite";
import { App } from "./src/App.tsx";
import { PlatformApp } from "./src/PlatformApp.tsx";
import { PerformanceApp } from "./src/PerformanceApp.tsx";

const pages = { "platform.html": PlatformApp, "performance.html": PerformanceApp };

export default defineConfig({
  appType: "mpa",
  plugins: [react(), tailwind(), {
    name: "prerender-example",
    transformIndexHtml: (html, ctx) => {
      const page = Object.entries(pages).find(([path]) => ctx.path.endsWith(path))?.[1] ?? App;
      return html.replace("<!--app-->", renderToString(React.createElement(page)));
    },
  }],
  build: { target: "es2022", cssCodeSplit: true, rolldownOptions: { input: { index: "index.html", platform: "platform.html", performance: "performance.html" } } },
});
