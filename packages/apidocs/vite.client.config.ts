import { defineConfig } from "vite";
import { bundle } from "./vite.shared.ts";

// assets/apidocs.js: the client islands, Preact inlined, loaded with defer.
export default defineConfig(bundle("src/client/islands.tsx", "ApiDocsClient", "apidocs.js", "dist/assets"));
