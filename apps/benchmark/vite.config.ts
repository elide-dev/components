import React from "react";
import { renderToString } from "react-dom/server";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwind from "@tailwindcss/vite";
import { App } from "./src/App.tsx";
import { PlatformApp } from "./src/PlatformApp.tsx";

export default defineConfig({
  appType: "mpa",
  plugins: [react(), tailwind(), {
    name: "prerender-example",
    transformIndexHtml: (html, ctx) => html.replace("<!--app-->", renderToString(React.createElement(ctx.path.endsWith("platform.html") ? PlatformApp : App))),
  }],
  build: { target: "es2022", cssCodeSplit: true, rolldownOptions: { input: { index: "index.html", platform: "platform.html" } } },
});
