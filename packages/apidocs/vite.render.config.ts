import { defineConfig } from "vite";
import { bundle } from "./vite.shared.ts";

// render.js: the pure render(model, theme) function, Preact and the highlighter inlined, one classic script that
// defines the global ApiDocs.
export default defineConfig(bundle("src/entry-render.ts", "ApiDocs", "render.js", "dist"));
