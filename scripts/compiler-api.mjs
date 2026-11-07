import { createRequire, registerHooks } from "node:module";

// Compiler API consumers (ESLint and docgen) need the JavaScript compiler.
// Native TypeScript 7 remains the compiler used by tsc.
const require = createRequire(import.meta.url);
registerHooks({
  resolve(specifier, context, nextResolve) {
    const target = specifier === "typescript" || specifier.startsWith("typescript/")
      ? require.resolve(specifier.replace(/^typescript/, "@typescript/typescript6"))
      : specifier;
    return nextResolve(target, context);
  },
});
