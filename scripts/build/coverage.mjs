// Coverage gate (spec §8.4): every counted compat unit is covered by a demo
// or a reference table, excluded with a reason, or still listed in
// pending.json. claims.json locks the support every demo key claims, so a
// data update shows its effect as a diff.

import { appendFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { pathToFileURL } from 'node:url';
import { BROWSERS } from './config.mjs';
import { byText, indexBaseline, indexCompat, resolveKey } from './compat.mjs';
import { loadContent } from './content.mjs';
import { loadCompatData } from './data.mjs';
import { checkTables, referenceTable, tableRootsFor } from './tables.mjs';
import { isDeprecated, listUnits, makeExcluded, unitOf } from './units.mjs';

const DIR = 'content/coverage';
export const FILES = Object.freeze({
  exclusions: `${DIR}/exclusions.json`,
  pending: `${DIR}/pending.json`,
  claims: `${DIR}/claims.json`,
});
const MIN_REASON = 10;
const SUMMARY_ERRORS = 50;
const FIX = 'run npm run coverage:update';

// --- helpers --------------------------------------------------------------

// The key itself and every dotted ancestor of it.
function* selfAndAncestors(key) {
  yield key;
  let end = key.lastIndexOf('.');
  while (end !== -1) {
    yield key.slice(0, end);
    end = key.lastIndexOf('.', end - 1);
  }
}

const isObject = (value) =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

// A detached copy, so the report never shares objects with the caller.
const plain = (value) => structuredClone(value);

// --- input checks ---------------------------------------------------------

function checkExclusions(exclusions, index, errors) {
  if (!Array.isArray(exclusions)) {
    errors.push(`${FILES.exclusions}: must be a list of { key, reason }`);
    return [];
  }
  const valid = [];
  const seen = new Set();
  for (const [i, entry] of exclusions.entries()) {
    if (!isObject(entry) || typeof entry.key !== 'string') {
      errors.push(
        `${FILES.exclusions}: entry ${i + 1} must be { "key": "...", "reason": "..." }`,
      );
      continue;
    }
    const { key } = entry;
    if (seen.has(key)) {
      errors.push(`${FILES.exclusions}: ${key} is listed more than once`);
    }
    seen.add(key);
    if (!index.has(key)) {
      errors.push(
        `${FILES.exclusions}: ${key} does not exist in the compat data`,
      );
    }
    const reason = typeof entry.reason === 'string' ? entry.reason.trim() : '';
    if (reason.length < MIN_REASON) {
      errors.push(
        `${FILES.exclusions}: ${key} needs a reason of at least ${MIN_REASON} characters`,
      );
    }
    valid.push(key);
  }
  return valid;
}

function checkPendingShape(pending, errors) {
  if (Array.isArray(pending) && pending.every((k) => typeof k === 'string')) {
    return pending;
  }
  errors.push(`${FILES.pending}: must be a list of keys`);
  return [];
}

// Every key a demo or a tables: list names, with the file that names it.
function listedKeys(topics) {
  const demo = [];
  const table = [];
  for (const topic of topics) {
    for (const key of topic.tables)
      table.push({ key, file: topic.file, topic });
    for (const d of topic.demos) {
      for (const key of d.features) demo.push({ key, file: d.file, topic });
    }
  }
  return { demo, table };
}

// --- coverage -------------------------------------------------------------

// Units covered by the listed keys, before exclusions are applied.
function coveredUnits(units, listed, index, errors) {
  const demoKeys = new Set(listed.demo.map((l) => l.key));
  const anyKeys = new Set([...demoKeys, ...listed.table.map((l) => l.key)]);
  // A unit is "above" a listed key when it is that key or one of its
  // ancestors, so a listed descendant covers it.
  const above = (keys) => {
    const set = new Set();
    for (const key of keys) for (const k of selfAndAncestors(key)) set.add(k);
    return set;
  };
  const aboveDemo = above(demoKeys);
  const aboveAny = above(anyKeys);
  const unitKeys = new Set(units.map((u) => u.unit));
  // A listed ancestor that is a unit itself (http.data-url) stands for its
  // whole subtree, the same way tableRootsFor widens it.
  const underListedUnit = (unit, keys) =>
    [...selfAndAncestors(unit)]
      .slice(1)
      .some((k) => keys.has(k) && unitKeys.has(k));
  const covered = new Set();
  for (const { unit, level } of units) {
    if (level === 'feature') {
      if (aboveDemo.has(unit) || underListedUnit(unit, demoKeys)) {
        covered.add(unit);
      }
    } else if (
      aboveAny.has(unit) ||
      [...selfAndAncestors(unit)].some((k) => anyKeys.has(k))
    ) {
      covered.add(unit);
    }
  }
  for (const { key, file, topic } of listed.table) {
    if (topic.appendix !== 'deprecated' || !index.has(key)) continue;
    const found = unitOf(key, index);
    if (found?.level !== 'feature') continue;
    const { deprecated, removed } = isDeprecated(found.unit, index);
    if (deprecated || removed) {
      covered.add(found.unit);
    } else {
      errors.push(
        `${file}: ${key} is in a deprecated appendix, but ${found.unit} is neither deprecated nor removed`,
      );
    }
  }
  return covered;
}

function checkListed(listed, index, excluded, errors) {
  for (const { key, file } of [...listed.demo, ...listed.table]) {
    if (!index.has(key)) {
      errors.push(`${file}: ${key} does not exist in the compat data`);
      continue;
    }
    const unit = unitOf(key, index)?.unit;
    if (excluded(key) || (unit !== undefined && excluded(unit))) {
      errors.push(`${file}: ${key} is both excluded and covered`);
    }
  }
}

function checkPending(pending, expected, unitKeys, index, errors) {
  const wanted = new Set(expected);
  const given = new Set();
  for (const key of pending) {
    if (given.has(key)) {
      errors.push(`${FILES.pending}: ${key} is listed more than once`);
      continue;
    }
    given.add(key);
    if (!index.has(key)) {
      errors.push(`${FILES.pending}: ${key} does not exist in the compat data`);
    } else if (!unitKeys.has(key)) {
      errors.push(`${FILES.pending}: ${key} is not a unit, ${FIX}`);
    } else if (!wanted.has(key)) {
      errors.push(
        `${FILES.pending}: ${key} is in pending.json but is covered or excluded`,
      );
    }
  }
  for (const key of expected) {
    if (!given.has(key)) {
      errors.push(
        `${FILES.pending}: ${key} is not covered, excluded or pending. Add a demo or table, add an exclusion with a reason, or ${FIX}`,
      );
    }
  }
}

// --- claims ---------------------------------------------------------------

const show = (value) => (value === undefined ? 'none' : JSON.stringify(value));

function claimChanges(before, after) {
  const parts = [];
  for (const browser of BROWSERS) {
    const old = before?.support?.[browser];
    const now = after.support?.[browser];
    if (!isDeepStrictEqual(old, now)) {
      parts.push(`${browser} ${show(old)} -> ${show(now)}`);
    }
  }
  const fields = new Set([...Object.keys(before ?? {}), ...Object.keys(after)]);
  fields.delete('support');
  for (const field of [...fields].toSorted(byText)) {
    if (!isDeepStrictEqual(before?.[field], after[field])) {
      parts.push(`${field} ${show(before?.[field])} -> ${show(after[field])}`);
    }
  }
  return parts;
}

function checkClaims(claims, expected, errors) {
  if (!isObject(claims)) {
    errors.push(`${FILES.claims}: must be an object of key to support`);
    return;
  }
  const keys = new Set([...Object.keys(claims), ...Object.keys(expected)]);
  for (const key of [...keys].toSorted(byText)) {
    if (!Object.hasOwn(expected, key)) {
      errors.push(
        `${FILES.claims}: ${key} is in claims.json but no demo lists it, ${FIX}`,
      );
    } else if (!Object.hasOwn(claims, key)) {
      errors.push(
        `${FILES.claims}: ${key} has no recorded claim, ${FIX} and review the diff`,
      );
    } else {
      const parts = claimChanges(claims[key], expected[key]);
      if (parts.length > 0) {
        errors.push(
          `${FILES.claims}: ${key} changed (${parts.join('; ')}), ${FIX} and review the diff`,
        );
      }
    }
  }
}

function expectedClaimsFor(listed, index, baseline) {
  const keys = [...new Set(listed.demo.map((l) => l.key))]
    .filter((key) => index.has(key))
    .toSorted(byText);
  return Object.fromEntries(
    keys.map((key) => [key, plain(resolveKey(key, index, baseline))]),
  );
}

// --- the check ------------------------------------------------------------

export function checkCoverage({
  topics,
  index,
  baseline,
  exclusions,
  pending,
  claims,
  strict = false,
}) {
  const errors = [];
  const excludedKeys = checkExclusions(exclusions, index, errors);
  const excluded = makeExcluded(excludedKeys);
  const pendingKeys = checkPendingShape(pending, errors);
  const listed = listedKeys(topics);
  checkListed(listed, index, excluded, errors);

  const units = listUnits(index);
  const unitKeys = new Set(units.map((u) => u.unit));
  const covered = coveredUnits(units, listed, index, errors);
  const counts = {
    units: units.length,
    featureUnits: units.filter((u) => u.level === 'feature').length,
    tableUnits: units.filter((u) => u.level === 'table').length,
    covered: 0,
    excluded: 0,
    pending: 0,
  };
  const expectedPending = [];
  for (const { unit } of units) {
    // An excluded unit counts as excluded even when an ancestor listing
    // reaches it: the reference table leaves it out as well.
    if (excluded(unit)) counts.excluded += 1;
    else if (covered.has(unit)) counts.covered += 1;
    else expectedPending.push(unit);
  }
  counts.pending = expectedPending.length;
  checkPending(pendingKeys, expectedPending, unitKeys, index, errors);
  if (strict && expectedPending.length > 0) {
    errors.push(
      `${FILES.pending}: strict mode needs every unit covered or excluded, ${expectedPending.length} still pending`,
    );
  }

  const expectedClaims = expectedClaimsFor(listed, index, baseline);
  checkClaims(claims, expectedClaims, errors);

  const tables = new Map(
    topics.map((t) => [
      t.url,
      referenceTable(tableRootsFor(t, index), index, excluded),
    ]),
  );
  errors.push(...checkTables(topics, tables, index, excluded));
  return { errors, counts, expectedPending, expectedClaims };
}

// --- output ---------------------------------------------------------------

function sortKeys(value) {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (!isObject(value)) return value;
  return Object.fromEntries(
    Object.keys(value)
      .toSorted(byText)
      .map((key) => [key, sortKeys(value[key])]),
  );
}

// Stable JSON: sorted object keys, two-space indent, LF, final newline.
export function serializeList(value) {
  return `${JSON.stringify(sortKeys(value), null, 2)}\n`;
}

export function formatSummary(report, versions) {
  const c = report.counts;
  const lines = [
    '## Coverage',
    '',
    '| Units | Feature units | Table units | Covered | Excluded | Pending |',
    '| ---: | ---: | ---: | ---: | ---: | ---: |',
    `| ${c.units} | ${c.featureUnits} | ${c.tableUnits} | ${c.covered} | ${c.excluded} | ${c.pending} |`,
    '',
    `Data: @mdn/browser-compat-data ${versions.bcd}, web-features ${versions.webFeatures}`,
    '',
  ];
  const { errors } = report;
  if (errors.length > 0) {
    lines.push(
      `### Errors (${errors.length})`,
      '',
      '```text',
      ...errors.slice(0, SUMMARY_ERRORS),
      '```',
      '',
    );
    if (errors.length > SUMMARY_ERRORS) {
      lines.push(`${errors.length - SUMMARY_ERRORS} more in the job log.`, '');
    }
  }
  return `${lines.join('\n')}\n`;
}

// --- CLI ------------------------------------------------------------------

// A missing file reads as fallback, unless it is required: then the
// missing file is an error of its own.
async function readJson(root, rel, { fallback, required = false }, errors) {
  let text;
  try {
    text = await readFile(join(root, rel), 'utf8');
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
    if (required) errors.push(`${rel} is missing`);
    return fallback;
  }
  try {
    return JSON.parse(text);
  } catch {
    errors.push(`${rel}: not valid JSON`);
    return fallback;
  }
}

const FLAGS = new Set(['--strict', '--update']);

export async function main(
  argv,
  {
    root = process.cwd(),
    env = process.env,
    stdout,
    stderr,
    load = loadCompatData,
  } = {},
) {
  const unknown = argv.filter((arg) => !FLAGS.has(arg));
  if (unknown.length > 0) {
    stderr.write(
      `coverage: unknown option ${unknown.join(' ')}. Usage: coverage.mjs [--strict] [--update]\n`,
    );
    return 1;
  }
  const strict = argv.includes('--strict');
  const data = await load();
  const index = indexCompat(data.bcd);
  const baseline = indexBaseline(data.webFeatures);
  const content = await loadContent(join(root, 'content'));
  const inputErrors = [...content.errors];
  const input = {
    topics: content.topics,
    index,
    baseline,
    exclusions: await readJson(
      root,
      FILES.exclusions,
      { fallback: [], required: true },
      inputErrors,
    ),
    pending: await readJson(root, FILES.pending, { fallback: [] }, inputErrors),
    claims: await readJson(root, FILES.claims, { fallback: {} }, inputErrors),
  };
  // --update rewrites pending.json and claims.json, so their own JSON errors
  // do not block it. Any other input error does: nothing is written then.
  const repairable = new Set(
    [FILES.pending, FILES.claims].map((rel) => `${rel}: not valid JSON`),
  );
  const blocking = inputErrors.filter((e) => !repairable.has(e));
  if (argv.includes('--update') && blocking.length > 0) {
    inputErrors.push(
      'coverage --update: nothing written, fix the errors above first',
    );
  } else if (argv.includes('--update')) {
    const computed = checkCoverage(input);
    await mkdir(join(root, DIR), { recursive: true });
    await writeFile(
      join(root, FILES.pending),
      serializeList(computed.expectedPending),
    );
    await writeFile(
      join(root, FILES.claims),
      serializeList(computed.expectedClaims),
    );
    input.pending = computed.expectedPending;
    input.claims = plain(computed.expectedClaims);
    // The files just written replace any read error they had.
    inputErrors.length = 0;
  }
  const report = checkCoverage({ ...input, strict });
  report.errors = [...inputErrors, ...report.errors];
  if (env.GITHUB_STEP_SUMMARY) {
    await appendFile(
      env.GITHUB_STEP_SUMMARY,
      formatSummary(report, data.versions),
    );
  }
  if (report.errors.length > 0) {
    stderr.write(
      `${report.errors.join('\n')}\n\ncoverage: failed (${report.errors.length} problem(s))\n`,
    );
    return 1;
  }
  const c = report.counts;
  stdout.write(
    `coverage: ok (${c.covered} covered, ${c.excluded} excluded, ${c.pending} pending of ${c.units} units)\n`,
  );
  return 0;
}

const entry = process.argv[1];
if (entry && import.meta.url === pathToFileURL(entry).href) {
  process.exitCode = await main(process.argv.slice(2), {
    stdout: process.stdout,
    stderr: process.stderr,
  });
}
