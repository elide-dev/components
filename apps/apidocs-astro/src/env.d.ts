/** The Workers runtime module that src/versions.ts reads the assets binding from, when it runs there. */
declare module "cloudflare:workers" {
  export const env: Record<string, unknown>;
}
