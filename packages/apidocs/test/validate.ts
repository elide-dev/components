/**
 * A strict validator for the JSON Schema subset apidocs-1.schema.json uses:
 * type, properties, required, additionalProperties: false, items, $ref,
 * const, enum, oneOf and minimum. Returns every error with its JSON path.
 */
import schema from "../schema/apidocs-1.schema.json";

interface S {
  $ref?: string;
  type?: string;
  const?: unknown;
  enum?: unknown[];
  oneOf?: S[];
  items?: S;
  properties?: Record<string, S>;
  required?: string[];
  additionalProperties?: boolean;
  minimum?: number;
}

const defs = (schema as { $defs: Record<string, S> }).$defs;

export function validate(value: unknown): string[] {
  const errors: string[] = [];
  check(value, schema as S, "$", errors);
  return errors;
}

function check(value: unknown, s: S, path: string, errors: string[]) {
  if (s.$ref) return check(value, defs[s.$ref.replace("#/$defs/", "")]!, path, errors);
  if (s.const !== undefined && value !== s.const) errors.push(`${path}: expected ${JSON.stringify(s.const)}`);
  if (s.enum && !s.enum.includes(value)) errors.push(`${path}: ${JSON.stringify(value)} is not one of ${s.enum.join(", ")}`);
  if (s.oneOf) {
    const matches = s.oneOf.filter(option => {
      const sub: string[] = [];
      check(value, option, path, sub);
      return sub.length === 0;
    });
    if (matches.length !== 1) errors.push(`${path}: matches ${matches.length} of the oneOf options (kind ${JSON.stringify((value as { kind?: unknown })?.kind)})`);
    return;
  }
  switch (s.type) {
    case "string": if (typeof value !== "string") errors.push(`${path}: expected a string`); break;
    case "boolean": if (typeof value !== "boolean") errors.push(`${path}: expected a boolean`); break;
    case "integer":
      if (!Number.isInteger(value)) errors.push(`${path}: expected an integer`);
      else if (s.minimum !== undefined && (value as number) < s.minimum) errors.push(`${path}: below ${s.minimum}`);
      break;
    case "array":
      if (!Array.isArray(value)) errors.push(`${path}: expected an array`);
      else value.forEach((item, i) => check(item, s.items!, `${path}[${i}]`, errors));
      break;
    case "object": {
      if (typeof value !== "object" || value === null || Array.isArray(value)) {
        errors.push(`${path}: expected an object`);
        break;
      }
      const record = value as Record<string, unknown>;
      for (const key of s.required ?? []) if (!(key in record)) errors.push(`${path}: missing ${key}`);
      for (const [key, item] of Object.entries(record)) {
        const prop = s.properties?.[key];
        if (!prop) {
          if (s.additionalProperties === false) errors.push(`${path}: unexpected property ${key}`);
        } else check(item, prop, `${path}.${key}`, errors);
      }
    }
  }
}
