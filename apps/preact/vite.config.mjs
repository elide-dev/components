import { defineConfig } from "vite";
import preact from "@preact/preset-vite";
import tailwind from "@tailwindcss/vite";

export default defineConfig({
  plugins: [preact(), tailwind(), {
    name: "verify-preact-runtime",
    generateBundle(_options, bundle) {
      const chunks = Object.values(bundle).filter(file => file.type === "chunk");
      const modules = chunks.flatMap(file => Object.keys(file.modules));
      const react = modules.filter(id => /\/node_modules\/(?:\.bun\/)?(?:react|react-dom)(?:@|\/)/.test(id));
      react.push(...chunks.flatMap(file => [...file.imports, ...file.dynamicImports]).filter(id => /^(?:react|react-dom)(?:\/|$)/.test(id)));
      if (react.length) this.error(`React entered the Preact bundle:\n${react.join("\n")}`);
      if (!modules.some(id => /\/node_modules\/(?:\.bun\/)?preact(?:@|\/)/.test(id))) {
        this.error("The compatibility fixture must bundle Preact.");
      }
    },
  }],
  resolve: { dedupe: ["preact"] },
  // Externalized React dependencies bypass Vite's aliases during SSR.
  ssr: { noExternal: true },
  build: { target: "es2022", outDir: "dist/client" },
});
