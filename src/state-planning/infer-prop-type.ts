/**
 * Safe, finite-value classification of a prop's printed TypeScript type
 * (RFC-006).
 *
 * `ResolvedComponentProp.type` is a pretty-printed type string produced by the
 * TypeScript checker (e.g. `"boolean | undefined"`, `'"sm" | "md" | null'`),
 * not a structured AST. This module classifies that string into a closed set
 * Lantern can safely enumerate — never inventing values for anything it cannot
 * prove finite. Any ambiguity or unrecognized shape falls back to `"unsafe"`,
 * which is the deliberately conservative default: no value is fabricated.
 */

export type LiteralValue = string | number | boolean | null;

export type InferredPropType =
  | { readonly kind: "boolean" }
  | { readonly kind: "literal-union"; readonly values: readonly LiteralValue[] }
  | { readonly kind: "unsafe" };

const UNSAFE: InferredPropType = { kind: "unsafe" };

/** Classify a printed TypeScript type string into a safe, finite value set (or "unsafe"). */
export function inferPropType(typeText: string): InferredPropType {
  const members = splitTopLevelUnionMembers(typeText)
    .map((member) => member.trim())
    .filter((member) => member.length > 0);

  if (members.length === 0) {
    return UNSAFE;
  }

  // `undefined` only marks optionality on the containing prop; it never
  // becomes a value dimension of its own.
  const significant = members.filter((member) => member !== "undefined");
  if (significant.length === 0) {
    return UNSAFE;
  }

  if (significant.length === 1 && significant[0] === "boolean") {
    return { kind: "boolean" };
  }
  if (significant.every((member) => member === "true" || member === "false")) {
    return { kind: "boolean" };
  }

  const values: LiteralValue[] = [];
  for (const member of significant) {
    const literal = parseLiteralMember(member);
    if (!literal.ok) {
      return UNSAFE;
    }
    values.push(literal.value);
  }

  return { kind: "literal-union", values: dedupeLiterals(values) };
}

function parseLiteralMember(member: string): { ok: true; value: LiteralValue } | { ok: false } {
  if (member === "null") {
    return { ok: true, value: null };
  }
  if (member === "true") {
    return { ok: true, value: true };
  }
  if (member === "false") {
    return { ok: true, value: false };
  }
  if (/^"(?:[^"\\]|\\.)*"$/.test(member)) {
    try {
      return { ok: true, value: JSON.parse(member) as string };
    } catch {
      return { ok: false };
    }
  }
  if (/^'(?:[^'\\]|\\.)*'$/.test(member)) {
    return { ok: true, value: member.slice(1, -1).replace(/\\(.)/g, "$1") };
  }
  if (/^-?\d+(?:\.\d+)?$/.test(member)) {
    return { ok: true, value: Number(member) };
  }
  return { ok: false };
}

function dedupeLiterals(values: readonly LiteralValue[]): LiteralValue[] {
  const seen = new Set<string>();
  const deduped: LiteralValue[] = [];
  for (const value of values) {
    const key = JSON.stringify(value);
    if (!seen.has(key)) {
      seen.add(key);
      deduped.push(value);
    }
  }
  return deduped;
}

/**
 * Split a printed type on top-level `|` only — union members nested inside
 * `()`, `[]`, `{}`, `<>` or string literals are left intact. Any depth/quote
 * imbalance simply yields fragments that later fail literal parsing and fall
 * back to `"unsafe"`, so a parsing ambiguity can never produce a fabricated value.
 */
function splitTopLevelUnionMembers(text: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let quote: '"' | "'" | undefined;
  let current = "";

  for (let index = 0; index < text.length; index += 1) {
    const char = text.charAt(index);

    if (quote !== undefined) {
      current += char;
      if (char === "\\") {
        index += 1;
        current += text.charAt(index);
        continue;
      }
      if (char === quote) {
        quote = undefined;
      }
      continue;
    }

    if (char === '"' || char === "'") {
      quote = char;
      current += char;
      continue;
    }
    if (char === "(" || char === "[" || char === "{" || char === "<") {
      depth += 1;
      current += char;
      continue;
    }
    if (char === ")" || char === "]" || char === "}" || char === ">") {
      depth = Math.max(0, depth - 1);
      current += char;
      continue;
    }
    if (char === "|" && depth === 0) {
      parts.push(current);
      current = "";
      continue;
    }
    current += char;
  }
  parts.push(current);

  return parts;
}
