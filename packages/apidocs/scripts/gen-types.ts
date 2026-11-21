/**
 * Generates src/model.ts from schema/apidocs-1.schema.json. The schema is the
 * contract; the types follow it. Handles the subset the schema uses: objects
 * with properties, arrays, $ref, const, string enums and oneOf unions.
 *
 *   bun scripts/gen-types.ts          # rewrite src/model.ts
 *   bun scripts/gen-types.ts --check  # exit 1 when src/model.ts is stale
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

type Schema = {
  $ref?: string;
  type?: string;
  const?: string;
  enum?: string[];
  oneOf?: Schema[];
  items?: Schema;
  properties?: Record<string, Schema>;
  required?: string[];
  description?: string;
  $defs?: Record<string, Schema>;
};

const root = new URL("..", import.meta.url);

export function generate(schema: Schema): string {
  const out: string[] = [
    "// Generated from schema/apidocs-1.schema.json by scripts/gen-types.ts. Do not edit.",
    "",
  ];
  for (const [name, def] of Object.entries(schema.$defs ?? {})) {
    if (def.description) out.push(`/** ${def.description} */`);
    if (def.type === "object") {
      out.push(`export interface ${name} {`);
      const required = new Set(def.required ?? []);
      for (const [prop, propSchema] of Object.entries(def.properties ?? {})) {
        if (propSchema.description) out.push(`  /** ${propSchema.description} */`);
        out.push(`  ${prop}${required.has(prop) ? "" : "?"}: ${type(propSchema)};`);
      }
      out.push("}", "");
    } else {
      out.push(`export type ${name} = ${type(def)};`, "");
    }
  }
  return out.join("\n");
}

function type(schema: Schema): string {
  if (schema.$ref) return schema.$ref.replace("#/$defs/", "");
  if (schema.const !== undefined) return JSON.stringify(schema.const);
  if (schema.enum) return schema.enum.map(v => JSON.stringify(v)).join(" | ");
  if (schema.oneOf) return schema.oneOf.map(type).join(" | ");
  switch (schema.type) {
    case "string": return "string";
    case "integer":
    case "number": return "number";
    case "boolean": return "boolean";
    case "array": {
      const item = type(schema.items!);
      return item.includes("|") ? `(${item})[]` : `${item}[]`;
    }
    default: throw new Error(`Unsupported schema: ${JSON.stringify(schema)}`);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const schema = JSON.parse(readFileSync(new URL("schema/apidocs-1.schema.json", root), "utf8"));
  const target = new URL("src/model.ts", root);
  const text = generate(schema);
  if (process.argv.includes("--check")) {
    if (readFileSync(target, "utf8") !== text) {
      console.error("src/model.ts is stale: run bun scripts/gen-types.ts");
      process.exit(1);
    }
  } else {
    writeFileSync(target, text);
  }
}
