// Minimal JSON Schema checker covering only what schema/meta.schema.json uses:
// type, required, properties, additionalProperties, items, enum, pattern, const,
// if/then/not. Returns a list of "path: reason" strings. No dependency needed.
// ponytail: not a full draft-2020-12 validator; swap for ajv if the schema grows.

export function validate(schema, value, path = "$") {
  const errs = [];
  const typeOf = (v) => (Array.isArray(v) ? "array" : v === null ? "null" : typeof v);
  if (schema.type && typeOf(value) !== schema.type) {
    return [`${path}: expected ${schema.type}, got ${typeOf(value)}`];
  }
  if (schema.enum && !schema.enum.includes(value)) errs.push(`${path}: must be one of ${schema.enum.join(", ")}`);
  if (schema.const !== undefined && value !== schema.const) errs.push(`${path}: must equal ${schema.const}`);
  if (schema.pattern && !new RegExp(schema.pattern).test(value)) errs.push(`${path}: does not match ${schema.pattern}`);
  if (typeOf(value) === "object") {
    for (const k of schema.required ?? []) if (!(k in value)) errs.push(`${path}: missing required "${k}"`);
    for (const [k, sub] of Object.entries(schema.properties ?? {})) {
      if (k in value) errs.push(...validate(sub, value[k], `${path}.${k}`));
    }
    if (schema.additionalProperties && typeof schema.additionalProperties === "object") {
      for (const [k, v] of Object.entries(value)) {
        if (!(k in (schema.properties ?? {}))) errs.push(...validate(schema.additionalProperties, v, `${path}.${k}`));
      }
    }
  }
  if (typeOf(value) === "array" && schema.items) {
    value.forEach((v, i) => errs.push(...validate(schema.items, v, `${path}[${i}]`)));
  }
  if (schema.not && validate(schema.not, value, path).length === 0) errs.push(`${path}: must not match "not" schema`);
  if (schema.if) {
    const ok = validate(schema.if, value, path).length === 0;
    const branch = ok ? schema.then : schema.else;
    if (branch) errs.push(...validate(branch, value, path));
  }
  return errs;
}
