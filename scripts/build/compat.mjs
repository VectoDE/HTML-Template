// Turns browser-compat-data and web-features into the per-key facts the
// reference shows: support per browser, status flags and Baseline.

import { BROWSERS } from './config.mjs';

const IGNORED = new Set(['__meta', 'browsers']);
const COMPAT = '__compat';
const RANK = { false: 0, low: 1, high: 2 };

const isObject = (value) =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

// --- index ----------------------------------------------------------------

function childNames(node) {
  return Object.keys(node).filter(
    (name) => name !== COMPAT && isObject(node[name]),
  );
}

// Every dotted key of the data, each with its __compat block (or null) and
// the sorted keys one level below it.
export function indexCompat(bcd) {
  const index = new Map();
  const stack = Object.keys(bcd)
    .filter((name) => !IGNORED.has(name) && isObject(bcd[name]))
    .map((name) => [name, bcd[name]]);
  while (stack.length > 0) {
    const [key, node] = stack.pop();
    const names = childNames(node);
    index.set(key, {
      compat: node[COMPAT] ?? null,
      children: names.map((name) => `${key}.${name}`).toSorted(),
    });
    for (const name of names) stack.push([`${key}.${name}`, node[name]]);
  }
  return index;
}

// --- support --------------------------------------------------------------

// Lower is better: the plain, current statement first, flags last.
function statementRank(statement) {
  if (statement.flags) return 3;
  if (statement.prefix || statement.alternative_name) return 2;
  return statement.version_removed ? 1 : 0;
}

function chooseStatement(raw) {
  const list = Array.isArray(raw) ? raw : [raw];
  let best = null;
  for (const statement of list) {
    if (!isObject(statement)) continue;
    if (best === null || statementRank(statement) < statementRank(best)) {
      best = statement;
    }
  }
  return best;
}

// "≤4" means "4 or earlier": the number stays, approx marks it.
function versionOf(value) {
  if (typeof value !== 'string')
    return { text: value === false ? false : null };
  return value.startsWith('≤')
    ? { text: value.slice(1), approx: true }
    : { text: value };
}

function toSupport(statement) {
  if (statement === null) return { added: null };
  const added = versionOf(statement.version_added);
  const result = { added: added.text };
  if (added.approx) result.approx = true;
  if (typeof statement.version_removed === 'string') {
    result.removed = versionOf(statement.version_removed).text;
  }
  if (statement.partial_implementation) result.partial = true;
  if (statement.prefix) result.prefix = statement.prefix;
  if (statement.alternative_name) result.altName = statement.alternative_name;
  if (statement.flags) result.flags = true;
  return result;
}

export function extractSupport(compat) {
  const support = {};
  for (const browser of BROWSERS) {
    support[browser] = toSupport(chooseStatement(compat.support?.[browser]));
  }
  return support;
}

// --- Baseline -------------------------------------------------------------

function yearOf(low) {
  if (typeof low !== 'string') return null;
  const year = Number.parseInt(low.replace('≤', '').slice(0, 4), 10);
  return Number.isNaN(year) ? null : year;
}

function toBaseline(status, feature) {
  const low = status.baseline_low_date ?? null;
  const known = status.baseline === 'high' || status.baseline === 'low';
  return {
    status: known ? status.baseline : false,
    low,
    high: status.baseline_high_date ?? null,
    year: yearOf(low),
    feature,
  };
}

function* featureEntries(id, feature) {
  const byKey = feature.status?.by_compat_key ?? {};
  for (const key of feature.compat_features ?? []) {
    yield [key, toBaseline(byKey[key] ?? feature.status ?? {}, id)];
  }
}

// When several features list a key, the weakest status wins (conservative).
// Features are visited by id, so a tie keeps the lowest id.
export function indexBaseline(webFeatures) {
  const index = new Map();
  for (const id of Object.keys(webFeatures.features).toSorted()) {
    const feature = webFeatures.features[id];
    if (feature.kind !== 'feature') continue;
    for (const [key, entry] of featureEntries(id, feature)) {
      const known = index.get(key);
      if (!known || RANK[entry.status] < RANK[known.status]) {
        index.set(key, entry);
      }
    }
  }
  return index;
}

// --- resolving ------------------------------------------------------------

function specList(value) {
  if (value === undefined) return [];
  return Array.isArray(value) ? [...value] : [value];
}

export function resolveKey(key, index, baseline) {
  const node = index.get(key);
  if (!node) return null;
  const compat = node.compat;
  const entry = baseline.get(key);
  return {
    key,
    mdn: compat?.mdn_url ?? null,
    spec: specList(compat?.spec_url),
    status: {
      experimental: compat?.status?.experimental ?? false,
      deprecated: compat?.status?.deprecated ?? false,
      standard: compat?.status?.standard_track ?? false,
    },
    support: compat ? extractSupport(compat) : null,
    baseline: entry
      ? {
          status: entry.status,
          low: entry.low,
          high: entry.high,
          year: entry.year,
        }
      : null,
  };
}

// The weakest status of the keys with the latest year among them. Keys
// without Baseline data are left out.
export function topicBaseline(resolved) {
  const known = resolved.map((r) => r.baseline).filter(Boolean);
  if (known.length === 0) return { status: null, year: null };
  const status = known.reduce(
    (weakest, b) => (RANK[b.status] < RANK[weakest] ? b.status : weakest),
    known[0].status,
  );
  if (status === false) return { status, year: null };
  const years = known.map((b) => b.year).filter((y) => y !== null);
  return { status, year: years.length > 0 ? Math.max(...years) : null };
}
