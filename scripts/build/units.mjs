// Coverage units: which compat keys count, at which level, and which of
// them are deprecated or gone from every tracked browser.

import { BROWSERS, UNIT_RULES } from './config.mjs';
import { byText, extractSupport } from './compat.mjs';

const RULES = UNIT_RULES.map((r) => ({
  parts: r.prefix.split('.'),
  level: r.level,
  depth: r.depth ?? 1,
}))
  // Longest prefix first, so the most specific rule wins.
  .toSorted((a, b) => b.parts.length - a.parts.length);

const startsWith = (parts, prefix) => prefix.every((p, i) => parts[i] === p);

// The unit a key belongs to, or null when the key does not count. A rule's
// prefix, or a node between it and unit depth, is a table unit of its own
// when it carries __compat (http.data-url, javascript.classes): nothing in
// a counted namespace may drop out. That needs the index to see __compat.
export function unitOf(key, index) {
  const parts = key.split('.');
  const rule = RULES.find((r) => startsWith(parts, r.parts));
  if (!rule) return null;
  const size = rule.parts.length + rule.depth;
  if (parts.length >= size) {
    return { unit: parts.slice(0, size).join('.'), level: rule.level };
  }
  return index?.get(key)?.compat ? { unit: key, level: 'table' } : null;
}

// Every unit in the data, with or without its own __compat block.
export function listUnits(index) {
  const units = [];
  for (const key of index.keys()) {
    const found = unitOf(key, index);
    if (found?.unit === key) units.push(found);
  }
  return units.toSorted((a, b) => byText(a.unit, b.unit));
}

const gone = (s) => s.added === false || s.removed !== undefined;

// Removed = no tracked browser supports the key in its chosen statement.
export function isDeprecated(key, index) {
  const compat = index.get(key)?.compat ?? null;
  if (compat === null) return { deprecated: false, removed: false };
  const support = extractSupport(compat);
  return {
    deprecated: compat.status?.deprecated ?? false,
    removed: BROWSERS.every((browser) => gone(support[browser])),
  };
}

// True for an excluded key and everything below it. Takes exclusion entries
// ({ key, reason }) or plain keys.
export function makeExcluded(exclusions) {
  const keys = new Set(
    exclusions.map((entry) => (typeof entry === 'string' ? entry : entry.key)),
  );
  return (key) => {
    if (keys.has(key)) return true;
    let end = key.indexOf('.');
    while (end !== -1) {
      if (keys.has(key.slice(0, end))) return true;
      end = key.indexOf('.', end + 1);
    }
    return false;
  };
}
