import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BROWSERS } from '../../scripts/build/config.mjs';
import { indexCompat } from '../../scripts/build/compat.mjs';
import {
  aboveUnitError,
  checkTables,
  referenceTable,
  tableRootsFor,
} from '../../scripts/build/tables.mjs';
import { makeExcluded } from '../../scripts/build/units.mjs';
import { miniBcd } from './helpers/fixtures.mjs';

const index = indexCompat(miniBcd());
const none = () => false;
const keys = (rows) => rows.map((r) => r.key);

function topic(url, features, tables = []) {
  return {
    url,
    file: `content${url}topic.md`,
    tables,
    demos: features.map((list, i) => ({ id: `demo-${i + 1}`, features: list })),
  };
}

test('referenceTable lists the root and its descendants, minus excluded', () => {
  const rows = referenceTable(
    ['html.elements.dialog'],
    index,
    (k) => k === 'html.elements.dialog.open',
  );
  assert.deepEqual(keys(rows), [
    'html.elements.dialog',
    'html.elements.dialog.closedby',
  ]);
  assert.equal(rows[0].name, 'dialog');
  assert.equal(rows[0].depth, 0);
  assert.equal(rows[1].name, 'closedby');
  assert.equal(rows[1].depth, 1);
  assert.deepEqual(Object.keys(rows[1].support), BROWSERS);
  assert.deepEqual(rows[1].support.chrome, { added: '134' });
  assert.deepEqual(rows[0].status, {
    experimental: false,
    deprecated: false,
    standard: true,
  });
});

test('referenceTable skips keys without __compat and unknown roots', () => {
  const rows = referenceTable(['api.Holder', 'api.Nope'], index, none);
  assert.deepEqual(keys(rows), ['api.Holder.method']);
  assert.equal(rows[0].name, 'method');
  assert.equal(rows[0].depth, 1);
  assert.deepEqual(
    referenceTable(['api.Old'], index, (k) => k === 'api.Old'),
    [],
  );
});

test('referenceTable de-duplicates overlapping roots and sorts by key', () => {
  const rows = referenceTable(
    ['html.elements.dialog.open', 'api.Old', 'html.elements.dialog'],
    index,
    none,
  );
  assert.deepEqual(keys(rows), [
    'api.Old',
    'html.elements.dialog',
    'html.elements.dialog.closedby',
    'html.elements.dialog.open',
  ]);
  const open = rows.find((r) => r.key === 'html.elements.dialog.open');
  assert.equal(open.name, 'open');
  assert.equal(open.depth, 1);
});

test('referenceTable names deeper keys by their path below the root', () => {
  const rows = referenceTable(['html'], index, none);
  const closedby = rows.find((r) => r.key === 'html.elements.dialog.closedby');
  assert.equal(closedby.name, 'elements.dialog.closedby');
  assert.equal(closedby.depth, 3);
});

test('tableRootsFor widens feature-level demo keys to their unit', () => {
  const t = topic(
    '/html/dialog/',
    [
      ['html.elements.dialog.closedby', 'html.global_attributes.inert'],
      ['api.HTMLDialogElement.showModal', 'manifests.name'],
    ],
    ['javascript.statements.let', 'html.elements.dialog'],
  );
  assert.deepEqual(tableRootsFor(t, index), [
    'api.HTMLDialogElement',
    'html.elements.dialog',
    'html.global_attributes.inert',
    'javascript.statements.let',
    'manifests.name',
  ]);
  assert.deepEqual(tableRootsFor(topic('/x/', []), index), []);
});

test('checkTables passes on the generated tables', () => {
  const topics = [
    topic('/html/dialog/', [['html.elements.dialog.closedby']]),
    topic('/js/old/', [], ['api.Old']),
  ];
  const excluded = makeExcluded([]);
  const tables = new Map(
    topics.map((t) => [
      t.url,
      referenceTable(tableRootsFor(t, index), index, excluded),
    ]),
  );
  assert.deepEqual(checkTables(topics, tables, index, excluded), []);
  assert.deepEqual(keys(tables.get('/html/dialog/')), [
    'html.elements.dialog',
    'html.elements.dialog.closedby',
    'html.elements.dialog.open',
  ]);
});

test('checkTables fails when a row of the demo unit is dropped', () => {
  // The demo lists only closedby, yet the whole unit must be in the table.
  const topics = [topic('/html/dialog/', [['html.elements.dialog.closedby']])];
  const full = referenceTable(tableRootsFor(topics[0], index), index, none);
  const tables = new Map([
    [
      '/html/dialog/',
      full.filter((r) => r.key !== 'html.elements.dialog.open'),
    ],
  ]);
  assert.deepEqual(checkTables(topics, tables, index, none), [
    'content/html/dialog/topic.md:1 sub-entry html.elements.dialog.open missing from the reference table',
  ]);
});

test('checkTables fails when a row of a table-level unit is dropped', () => {
  // tables: names one sub-key, yet the whole unit must be in the table.
  const csp = 'http.headers.Content-Security-Policy';
  const topics = [topic('/http/csp/', [], [`${csp}.script-src`])];
  assert.deepEqual(tableRootsFor(topics[0], index), [csp]);
  const full = referenceTable(tableRootsFor(topics[0], index), index, none);
  assert.deepEqual(keys(full), [csp, `${csp}.script-src`, `${csp}.style-src`]);
  const tables = new Map([['/http/csp/', full.slice(1, 2)]]);
  assert.deepEqual(checkTables(topics, tables, index, none), [
    `content/http/csp/topic.md:1 sub-entry ${csp} missing from the reference table`,
    `content/http/csp/topic.md:1 sub-entry ${csp}.style-src missing from the reference table`,
  ]);
  tables.set('/http/csp/', full);
  assert.deepEqual(checkTables(topics, tables, index, none), []);
});

test('checkTables accepts excluded rows and reports a missing table', () => {
  const topics = [topic('/html/dialog/', [['html.elements.dialog']])];
  const excluded = makeExcluded(['html.elements.dialog.open']);
  const tables = new Map([
    [
      '/html/dialog/',
      referenceTable(['html.elements.dialog'], index, excluded),
    ],
  ]);
  assert.deepEqual(checkTables(topics, tables, index, excluded), []);
  assert.deepEqual(checkTables(topics, new Map(), index, excluded), [
    'content/html/dialog/topic.md:1 sub-entry html.elements.dialog missing from the reference table',
    'content/html/dialog/topic.md:1 sub-entry html.elements.dialog.closedby missing from the reference table',
  ]);
});

test('two topics claiming one unit both list it', () => {
  const topics = [
    topic('/a/', [['html.elements.dialog']]),
    topic('/b/', [['html.elements.dialog.open']]),
  ];
  assert.deepEqual(tableRootsFor(topics[1], index), ['html.elements.dialog']);
  const full = referenceTable(tableRootsFor(topics[0], index), index, none);
  const tables = new Map([
    ['/a/', full],
    ['/b/', full.filter((r) => r.key === 'html.elements.dialog.open')],
  ]);
  assert.deepEqual(checkTables(topics, tables, index, none), [
    'content/b/topic.md:1 sub-entry html.elements.dialog missing from the reference table',
    'content/b/topic.md:1 sub-entry html.elements.dialog.closedby missing from the reference table',
  ]);
  tables.set('/b/', full);
  assert.deepEqual(checkTables(topics, tables, index, none), []);
});

test('aboveUnitError names keys above unit level, with the file and line', () => {
  // css.properties has no __compat of its own, like the real data.
  assert.equal(
    aboveUnitError('css.properties', 'content/css/t/topic.md', index),
    'content/css/t/topic.md:1 key css.properties is above unit level; list a unit such as css.properties.<name>',
  );
  assert.equal(
    aboveUnitError('api', 'content/api/t/topic.md', index),
    'content/api/t/topic.md:1 key api is above unit level; list a unit such as api.<name>',
  );
  // Units, table-level groups with their own __compat, unknown keys and
  // keys outside the counted namespaces are not this error.
  for (const key of [
    'css.properties.zoom',
    'css.properties.zoom.x',
    'http',
    'http.headers',
    'javascript.classes',
    'html.global_attributes',
    'css.nope',
    'html.elements.nope',
  ]) {
    assert.equal(aboveUnitError(key, 'f', index), null, key);
  }
});
