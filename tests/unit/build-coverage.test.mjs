import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import {
  access,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { indexBaseline, indexCompat } from '../../scripts/build/compat.mjs';
import {
  checkCoverage,
  formatSummary,
  main,
  serializeList,
} from '../../scripts/build/coverage.mjs';
import { listUnits } from '../../scripts/build/units.mjs';
import { miniBcd, miniWebFeatures, writeTree } from './helpers/fixtures.mjs';

let base;
before(async () => {
  base = await mkdtemp(join(tmpdir(), 'html-template-coverage-'));
});
after(async () => {
  await rm(base, { recursive: true, force: true });
});

const PENDING = 'content/coverage/pending.json';
const CLAIMS = 'content/coverage/claims.json';
const EXCLUSIONS = 'content/coverage/exclusions.json';

function setup(bcd = miniBcd()) {
  const index = indexCompat(bcd);
  const baseline = indexBaseline(miniWebFeatures());
  const units = listUnits(index).map((u) => u.unit);
  return { index, baseline, units };
}

const base0 = setup();
const ALL = base0.units;

function topic({ features = [], tables = [], appendix = null, slug = 't' }) {
  return {
    url: `/html/${slug}/`,
    file: `content/html/${slug}/topic.md`,
    tables,
    appendix,
    demos: features.map((list, i) => ({
      id: `demo-${i + 1}`,
      file: `content/html/${slug}/0${i + 1}-d.demo.html`,
      features: list,
    })),
  };
}

// Runs the check with sensible defaults: pending and claims are the
// computed values unless a test passes its own.
function run(options = {}, data = base0) {
  const input = {
    topics: [],
    index: data.index,
    baseline: data.baseline,
    exclusions: [],
    strict: false,
    ...options,
  };
  const first = checkCoverage({
    ...input,
    pending: input.pending ?? [],
    claims: input.claims ?? {},
  });
  return checkCoverage({
    ...input,
    pending: input.pending ?? first.expectedPending,
    claims: input.claims ?? first.expectedClaims,
  });
}

const has = (report, ...parts) =>
  report.errors.some((e) => parts.every((p) => e.includes(p)));

test('no topics, every unit pending: no errors', () => {
  const report = run({ pending: ALL, claims: {} });
  assert.deepEqual(report.errors, []);
  assert.equal(report.counts.pending, report.counts.units);
  assert.equal(report.counts.units, ALL.length);
  assert.equal(
    report.counts.featureUnits + report.counts.tableUnits,
    report.counts.units,
  );
  assert.equal(report.counts.covered, 0);
  assert.equal(report.counts.excluded, 0);
  assert.deepEqual(report.expectedPending, ALL);
  assert.deepEqual(report.expectedClaims, {});
});

test('a demo key covers its unit; a stale pending entry fails', () => {
  const topics = [topic({ features: [['html.elements.dialog.closedby']] })];
  const report = run({ topics, pending: ALL });
  assert.ok(!report.expectedPending.includes('html.elements.dialog'));
  assert.equal(report.counts.covered, 1);
  assert.ok(
    has(
      report,
      PENDING,
      'html.elements.dialog is in pending.json but is covered or excluded',
    ),
  );
  assert.deepEqual(run({ topics }).errors, []);
});

test('a new unit missing from pending names the key and the fix', () => {
  const bcd = miniBcd();
  bcd.api.New = structuredClone(bcd.api.NoIos);
  const report = run({ pending: ALL, claims: {} }, setup(bcd));
  assert.equal(report.errors.length, 1);
  assert.equal(
    report.errors[0],
    `${PENDING}:1 api.New is not covered, excluded or pending. Add a demo or table, add an exclusion with a reason, or run npm run coverage:update`,
  );
});

test('pending entries that are no units or repeat are errors', () => {
  const report = run({
    pending: [...ALL, 'html.elements.dialog.open', ALL[0]],
  });
  assert.ok(has(report, PENDING, 'html.elements.dialog.open', 'not a unit'));
  assert.ok(has(report, PENDING, ALL[0], 'more than once'));
});

test('exclusions need a reason of 10 characters', () => {
  const short = run({ exclusions: [{ key: 'api.Old', reason: ' short    ' }] });
  assert.ok(has(short, EXCLUSIONS, 'api.Old', 'reason'));
  const ok = run({
    exclusions: [{ key: 'api.Old', reason: 'removed from all browsers' }],
  });
  assert.deepEqual(ok.errors, []);
  assert.equal(ok.counts.excluded, 1);
  assert.ok(!ok.expectedPending.includes('api.Old'));
});

test('exclusion keys are unique and entries well formed', () => {
  const entry = { key: 'api.Old', reason: 'removed from all browsers' };
  const report = run({ exclusions: [entry, entry, 'api.Old', { key: 1 }] });
  assert.ok(has(report, EXCLUSIONS, 'api.Old', 'more than once'));
  assert.ok(has(report, EXCLUSIONS, 'entry 3'));
  assert.ok(has(report, EXCLUSIONS, 'entry 4'));
  assert.ok(has(run({ exclusions: {} }), EXCLUSIONS, 'list'));
});

test('an excluded key that a demo lists is both excluded and covered', () => {
  const report = run({
    topics: [topic({ features: [['api.Old']] })],
    exclusions: [{ key: 'api.Old', reason: 'removed from all browsers' }],
  });
  assert.ok(
    has(report, 'content/html/t/01-d.demo.html', 'api.Old', 'both excluded'),
  );
  const below = run({
    topics: [topic({ features: [['html.elements.dialog.open']] })],
    exclusions: [{ key: 'html.elements.dialog', reason: 'test reason here' }],
  });
  assert.ok(has(below, 'html.elements.dialog.open', 'both excluded'));
});

test('a sub-entry exclusion under a covered unit is fine', () => {
  const report = run({
    topics: [topic({ features: [['html.elements.dialog']] })],
    exclusions: [
      { key: 'html.elements.dialog.open', reason: 'test reason here' },
    ],
  });
  assert.deepEqual(report.errors, []);
});

test('unknown keys in demos, tables and pending are named with the file', () => {
  const report = run({
    topics: [
      topic({ features: [['css.properties.nope']], tables: ['http.nope'] }),
    ],
    pending: [...ALL, 'api.Gone'],
  });
  assert.ok(
    has(
      report,
      'content/html/t/01-d.demo.html',
      'css.properties.nope does not exist in the compat data',
    ),
  );
  assert.ok(
    has(
      report,
      'content/html/t/topic.md',
      'http.nope does not exist in the compat data',
    ),
  );
  assert.ok(has(report, PENDING, 'api.Gone does not exist in the compat data'));
  const excl = run({
    exclusions: [{ key: 'api.Nope', reason: 'test reason here' }],
  });
  assert.ok(has(excl, EXCLUSIONS, 'api.Nope does not exist'));
});

test('a deprecated appendix covers removed units only', () => {
  const ok = run({
    topics: [topic({ tables: ['api.Old'], appendix: 'deprecated' })],
  });
  assert.deepEqual(ok.errors, []);
  assert.ok(!ok.expectedPending.includes('api.Old'));
  const zoom = run({
    topics: [
      topic({ tables: ['css.properties.zoom'], appendix: 'deprecated' }),
    ],
  });
  assert.deepEqual(zoom.errors, []);
  const bad = run({
    topics: [
      topic({ tables: ['html.elements.dialog'], appendix: 'deprecated' }),
    ],
  });
  assert.ok(
    has(bad, 'content/html/t/topic.md', 'html.elements.dialog', 'deprecated'),
  );
  assert.ok(bad.expectedPending.includes('html.elements.dialog'));
});

test('a plain topic table does not cover a feature unit', () => {
  const report = run({ topics: [topic({ tables: ['api.Old'] })] });
  assert.ok(report.expectedPending.includes('api.Old'));
});

test('table units: listed, via ancestor, via descendant or by a demo', () => {
  const units = (options) => run(options).expectedPending;
  const viaAncestor = units({ topics: [topic({ tables: ['http'] })] });
  assert.ok(!viaAncestor.includes('http.headers.Content-Security-Policy'));
  assert.ok(!viaAncestor.includes('http.data-url'));
  const viaChild = units({
    topics: [
      topic({ tables: ['http.headers.Content-Security-Policy.script-src'] }),
    ],
  });
  assert.ok(!viaChild.includes('http.headers.Content-Security-Policy'));
  assert.ok(viaChild.includes('http.data-url'));
  const viaDemo = units({
    topics: [topic({ features: [['javascript.classes']] })],
  });
  assert.ok(!viaDemo.includes('javascript.classes'));
  assert.ok(!viaDemo.includes('javascript.classes.private_class_fields'));
});

test('an ancestor prefix-node unit in a demo covers its descendant units', () => {
  const report = run({ topics: [topic({ features: [['http.data-url']] })] });
  assert.ok(!report.expectedPending.includes('http.data-url'));
  assert.ok(!report.expectedPending.includes('http.data-url.css_files'));
  assert.equal(report.counts.covered, 2);
});

test('excluded wins over an ancestor listing', () => {
  const report = run({
    topics: [topic({ tables: ['http'] })],
    exclusions: [{ key: 'http.data-url', reason: 'test reason here' }],
  });
  assert.deepEqual(report.errors, []);
  assert.ok(!report.expectedPending.includes('http.data-url'));
  assert.ok(report.counts.excluded >= 1);
  assert.equal(
    report.counts.covered + report.counts.excluded + report.counts.pending,
    report.counts.units,
  );
});

test('strict fails while units are pending, with the count', () => {
  const pending = ALL.slice(0, 1);
  const exclusions = ALL.slice(1).map((key) => ({
    key,
    reason: 'test reason here',
  }));
  const report = run({ strict: true, pending, exclusions });
  assert.equal(report.errors.length, 1);
  assert.match(report.errors[0], /\b1\b/);
  assert.match(report.errors[0], /pending/);
  const done = run({
    strict: true,
    exclusions: ALL.map((key) => ({ key, reason: 'test reason here' })),
  });
  assert.deepEqual(done.errors, []);
});

test('claims lock: missing, matching, changed, stale', () => {
  const topics = [topic({ features: [['html.elements.dialog', 'api.NoIos']] })];
  const missing = run({ topics, claims: {} });
  const claimErrors = missing.errors.filter((e) => e.startsWith(CLAIMS));
  assert.equal(claimErrors.length, 2);
  assert.ok(has(missing, CLAIMS, 'html.elements.dialog'));
  assert.ok(has(missing, CLAIMS, 'api.NoIos'));
  const claims = missing.expectedClaims;
  assert.deepEqual(Object.keys(claims), ['api.NoIos', 'html.elements.dialog']);
  assert.deepEqual(run({ topics, claims }).errors, []);

  const bcd = miniBcd();
  bcd.html.elements.dialog.__compat.support.chrome.version_added = '38';
  const changed = run({ topics, claims }, setup(bcd));
  assert.equal(changed.errors.length, 1);
  assert.ok(has(changed, CLAIMS, 'html.elements.dialog', '37', '38'));

  const stale = run({ topics: [], claims, pending: ALL });
  assert.ok(has(stale, CLAIMS, 'api.NoIos', 'no demo lists it'));
  assert.ok(has(run({ claims: [] }), CLAIMS, 'object'));
});

test('claims report changes beside support by field', () => {
  const topics = [topic({ features: [['html.elements.dialog']] })];
  const claims = structuredClone(run({ topics }).expectedClaims);
  claims['html.elements.dialog'].mdn = 'https://example.test/old';
  const report = run({ topics, claims });
  assert.ok(has(report, CLAIMS, 'html.elements.dialog', 'mdn'));
});

test('pending must be a list of strings', () => {
  assert.ok(has(run({ pending: 'x' }), PENDING, 'list'));
});

test('serializeList sorts object keys and ends with a newline', () => {
  assert.equal(serializeList([]), '[]\n');
  assert.equal(
    serializeList({ b: 1, a: { d: [2, { z: 1, y: 2 }], c: null } }),
    '{\n  "a": {\n    "c": null,\n    "d": [\n      2,\n      {\n        "y": 2,\n        "z": 1\n      }\n    ]\n  },\n  "b": 1\n}\n',
  );
});

test('formatSummary shows counts, versions and the first 50 errors', () => {
  const report = run({ pending: ALL });
  report.errors = Array.from({ length: 60 }, (_, i) => `problem ${i}`);
  const text = formatSummary(report, { bcd: '8.1.7', webFeatures: '3.44.0' });
  assert.match(text, /\| Units \|/);
  assert.match(text, new RegExp(`\\| ${ALL.length} \\|`));
  assert.match(text, /8\.1\.7/);
  assert.match(text, /3\.44\.0/);
  assert.match(text, /problem 49/);
  assert.doesNotMatch(text, /problem 50/);
  assert.match(text, /10 more/);
  const clean = formatSummary(run({ pending: ALL }), {
    bcd: 'a',
    webFeatures: 'b',
  });
  assert.doesNotMatch(clean, /problem/);
});

// --- CLI ------------------------------------------------------------------

let counter = 0;
async function project(files = {}) {
  const root = join(base, `case-${counter++}`);
  // A null value leaves that file out; content/coverage/ always exists.
  const tree = Object.entries({ [EXCLUSIONS]: '[]\n', ...files }).filter(
    ([, text]) => text !== null,
  );
  await writeTree(root, Object.fromEntries(tree));
  await mkdir(join(root, 'content/coverage'), { recursive: true });
  return root;
}

const fixtureData = () => ({
  bcd: miniBcd(),
  webFeatures: miniWebFeatures(),
  versions: { bcd: '0.0.0-test', webFeatures: '0.0.0-test' },
});

async function cli(argv, root, env = {}) {
  let out = '';
  let err = '';
  const code = await main(argv, {
    root,
    env,
    stdout: { write: (s) => (out += s) },
    stderr: { write: (s) => (err += s) },
    load: async () => fixtureData(),
  });
  return { code, out, err };
}

const topicMd = `---
title: Dialog
number: 1
lede: A modal box.
spec: https://html.spec.whatwg.org/#the-dialog-element
---

Body.
`;

const demoHtml = `<script type="application/json" data-demo-meta>
{
  "title": "Modal",
  "summary": "s",
  "fallback": "f",
  "features": ["html.elements.dialog.closedby", "http.data-url"],
  "detect": "true",
  "runsIn": "frame"
}
</script>
<template data-lang="js">
  run();
</template>
`;

test('main --update writes both files and a second run passes unchanged', async () => {
  const root = await project({
    'content/html/dialog/topic.md': topicMd,
    'content/html/dialog/01-modal.demo.html': demoHtml,
  });
  const first = await cli(['--update'], root);
  assert.equal(first.err, '');
  assert.equal(first.code, 0);
  const pending = await readFile(join(root, PENDING), 'utf8');
  const claims = await readFile(join(root, CLAIMS), 'utf8');
  assert.ok(pending.endsWith(']\n'));
  assert.ok(!pending.includes('\r'));
  assert.deepEqual(Object.keys(JSON.parse(claims)), [
    'html.elements.dialog.closedby',
    'http.data-url',
  ]);
  const second = await cli([], root);
  assert.equal(second.code, 0);
  assert.match(
    second.out,
    /^coverage: ok \(3 covered, 0 excluded, \d+ pending of \d+ units\)\n$/,
  );
  assert.equal(await readFile(join(root, PENDING), 'utf8'), pending);
  assert.equal(await readFile(join(root, CLAIMS), 'utf8'), claims);
  const again = await cli(['--update'], root);
  assert.equal(again.code, 0);
  assert.equal(await readFile(join(root, PENDING), 'utf8'), pending);
  assert.equal(await readFile(join(root, CLAIMS), 'utf8'), claims);
});

test('main without the files fails and names the fix', async () => {
  const root = await project();
  const { code, err } = await cli([], root);
  assert.equal(code, 1);
  assert.match(err, /coverage:update/);
  assert.match(err, /coverage: failed/);
});

test('main --strict fails while units are pending', async () => {
  const root = await project();
  assert.equal((await cli(['--update'], root)).code, 0);
  const { code, err } = await cli(['--strict'], root);
  assert.equal(code, 1);
  assert.match(err, /pending/);
});

test('main appends the summary when GITHUB_STEP_SUMMARY is set', async () => {
  const root = await project();
  const summary = join(root, 'summary.md');
  await writeFile(summary, 'before\n');
  await cli(['--update'], root, { GITHUB_STEP_SUMMARY: summary });
  const text = await readFile(summary, 'utf8');
  assert.ok(text.startsWith('before\n'));
  assert.match(text, /0\.0\.0-test/);
});

test('main reports content errors, bad JSON and unknown flags', async () => {
  const root = await project({
    [PENDING]: '[oops',
    'content/html/dialog/topic.md': '---\ntitle: x\n---\n',
  });
  const { code, err } = await cli([], root);
  assert.equal(code, 1);
  assert.match(err, /content\/coverage\/pending\.json: not valid JSON/);
  assert.match(err, /content\/html\/dialog\/topic\.md/);
  const flag = await cli(['--nope'], root);
  assert.equal(flag.code, 1);
  assert.match(flag.err, /--nope/);
});

const exists = (path) =>
  access(path).then(
    () => true,
    () => false,
  );

test('main fails when exclusions.json is missing, and --update writes nothing', async () => {
  const root = await project({ [EXCLUSIONS]: null });
  const check = await cli([], root);
  assert.equal(check.code, 1);
  assert.match(check.err, /content\/coverage\/exclusions\.json is missing/);
  const update = await cli(['--update'], root);
  assert.equal(update.code, 1);
  assert.match(update.err, /exclusions\.json is missing/);
  assert.equal(await exists(join(root, PENDING)), false);
  assert.equal(await exists(join(root, CLAIMS)), false);
});

test('main --update writes nothing while exclusions.json is invalid', async () => {
  const root = await project({ [EXCLUSIONS]: '[oops' });
  const { code, err } = await cli(['--update'], root);
  assert.equal(code, 1);
  assert.match(err, /exclusions\.json: not valid JSON/);
  assert.equal(await exists(join(root, PENDING)), false);
  assert.equal(await exists(join(root, CLAIMS)), false);
});

test('main --update writes nothing while content fails to load', async () => {
  const root = await project({
    [PENDING]: '[]\n',
    'content/html/dialog/topic.md': '---\ntitle: x\n---\n',
  });
  const { code, err } = await cli(['--update'], root);
  assert.equal(code, 1);
  assert.match(err, /content\/html\/dialog\/topic\.md/);
  assert.equal(await readFile(join(root, PENDING), 'utf8'), '[]\n');
  assert.equal(await exists(join(root, CLAIMS)), false);
});

test('main --update repairs invalid pending.json and claims.json', async () => {
  const root = await project({ [PENDING]: '[oops', [CLAIMS]: '{oops' });
  const { code, err } = await cli(['--update'], root);
  assert.equal(err, '');
  assert.equal(code, 0);
  assert.ok(
    Array.isArray(JSON.parse(await readFile(join(root, PENDING), 'utf8'))),
  );
  assert.equal(await readFile(join(root, CLAIMS), 'utf8'), '{}\n');
});

test('a key above unit level is named with file and line', () => {
  const report = run({
    topics: [
      topic({ features: [['css.properties']], tables: ['css.properties'] }),
    ],
  });
  assert.ok(
    has(
      report,
      'content/html/t/01-d.demo.html:1 key css.properties is above unit level',
    ),
  );
  assert.ok(
    has(report, 'content/html/t/topic.md:1 key css.properties is above unit'),
  );
});
