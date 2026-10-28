import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  byText,
  indexBaseline,
  indexCompat,
} from '../../scripts/build/compat.mjs';
import { SITE } from '../../scripts/build/config.mjs';
import {
  buildNav,
  buildPrecache,
  buildSearchIndex,
  buildSitemap,
  buildTopicData,
} from '../../scripts/build/outputs.mjs';
import { referenceTable, tableRootsFor } from '../../scripts/build/tables.mjs';
import { makeTopic, miniBcd, miniWebFeatures } from './helpers/fixtures.mjs';

const index = indexCompat(miniBcd());
const baseline = indexBaseline(miniWebFeatures());
const none = () => false;
const tableOf = (topic) =>
  referenceTable(tableRootsFor(topic, index), index, none);

// --- TopicData ------------------------------------------------------------

test('buildTopicData holds the summary, the demos and the table', () => {
  const topic = makeTopic();
  const table = tableOf(topic);
  const { data, errors } = buildTopicData(topic, { index, baseline, table });
  assert.deepEqual(errors, []);
  assert.deepEqual(Object.keys(data), [
    'url',
    'title',
    'number',
    'category',
    'interface',
    'spec',
    'mdn',
    'permissions',
    'baseline',
    'demos',
    'table',
  ]);
  assert.equal(data.url, '/HTML-Template/html/dialog/');
  assert.equal(data.category, 'html');
  assert.deepEqual(data.spec, topic.spec);
  assert.deepEqual(data.permissions, ['camera', 'fullscreen']);
  // dialog is high (2022), closedby is low (2025): weakest status, latest year.
  assert.deepEqual(data.baseline, { status: 'low', year: 2025 });
  assert.equal(data.demos.length, 2);
  assert.deepEqual(Object.keys(data.demos[0]), [
    'id',
    'title',
    'runsIn',
    'permissions',
    'detect',
    'features',
  ]);
  assert.equal(data.demos[0].features[0].key, 'html.elements.dialog');
  assert.equal(data.demos[0].features[0].support.safari.added, '15.4');
  assert.deepEqual(data.demos[1].permissions, ['camera', 'fullscreen']);
  assert.equal(data.demos[1].runsIn, 'window');
  assert.deepEqual(data.table, table);
});

test('buildTopicData copies, so later edits do not leak into the topic', () => {
  const topic = makeTopic();
  const { data } = buildTopicData(topic, { index, baseline, table: [] });
  data.spec.push('x');
  data.demos[1].permissions.push('x');
  assert.equal(topic.spec.length, 1);
  assert.deepEqual(topic.demos[1].permissions, ['fullscreen', 'camera']);
});

test('buildTopicData: a key without Baseline data makes the topic unknown', () => {
  const topic = makeTopic({
    demos: [{ ...makeTopic().demos[0], features: ['api.Holder.method'] }],
  });
  const { data } = buildTopicData(topic, { index, baseline, table: [] });
  assert.deepEqual(data.baseline, { status: null, year: null });
  const appendix = makeTopic({ demos: [], appendix: 'deprecated' });
  const empty = buildTopicData(appendix, { index, baseline, table: [] });
  assert.deepEqual(empty.data.baseline, { status: null, year: null });
  assert.deepEqual(empty.data.permissions, []);
});

test('buildTopicData reports keys missing from the data by file', () => {
  const first = makeTopic().demos[0];
  const topic = makeTopic({
    demos: [{ ...first, features: ['html.elements.dialog', 'api.Nope'] }],
  });
  const { data, errors } = buildTopicData(topic, {
    index,
    baseline,
    table: [],
  });
  assert.deepEqual(errors, [`${first.file}:1 unknown compat key "api.Nope"`]);
  assert.deepEqual(
    data.demos[0].features.map((f) => f.key),
    ['html.elements.dialog'],
  );
});

// --- nav ------------------------------------------------------------------

test('buildNav lists all four categories, empty ones with count 0', () => {
  const nav = buildNav([]);
  assert.deepEqual(
    nav.categories.map((c) => [c.id, c.label, c.count, c.topics]),
    [
      ['html', 'HTML', 0, []],
      ['css', 'CSS', 0, []],
      ['js', 'JS APIs', 0, []],
      ['recipes', 'Recipes', 0, []],
    ],
  );
});

test('buildNav counts topics and demos, sorted by number', () => {
  const later = makeTopic({
    slug: 'popover',
    url: '/html/popover/',
    number: 2,
  });
  const nav = buildNav([later, makeTopic()]);
  const html = nav.categories[0];
  assert.equal(html.count, 2);
  assert.deepEqual(html.topics[0], {
    slug: 'dialog',
    title: 'Dialog',
    number: 1,
    url: '/HTML-Template/html/dialog/',
    demos: 2,
  });
  assert.equal(html.topics[1].slug, 'popover');
  assert.equal(nav.categories[1].count, 0);
});

// --- search ---------------------------------------------------------------

test('buildSearchIndex has the topic, its demos and the features it covers', () => {
  const topic = makeTopic();
  const entries = buildSearchIndex(
    [topic],
    new Map([[topic.url, tableOf(topic)]]),
  );
  assert.deepEqual(
    entries.map((e) => [e.type, e.url, e.title]),
    [
      ['demo', '/HTML-Template/html/dialog/#demo-1', 'Demo 1'],
      ['demo', '/HTML-Template/html/dialog/#demo-2', 'Demo 2'],
      ['feature', '/HTML-Template/html/dialog/#reference', 'dialog'],
      ['topic', '/HTML-Template/html/dialog/', 'Dialog'],
    ],
  );
  for (const entry of entries) {
    assert.equal(entry.category, 'html');
    assert.ok(entry.terms.length > 0);
    assert.deepEqual(entry.terms, entry.terms.toSorted(byText));
  }
  const feature = entries.find((e) => e.type === 'feature');
  assert.ok(feature.terms.includes('html.elements.dialog'));
  const demo = entries.find((e) => e.url.endsWith('#demo-2'));
  assert.ok(demo.terms.includes('html.elements.dialog.closedby'));
  const top = entries.find((e) => e.type === 'topic');
  assert.ok(top.terms.includes('htmldialogelement'));
});

test('buildSearchIndex finds the unit of rows without a root row', () => {
  const topic = makeTopic({
    category: 'js',
    slug: 'holder',
    url: '/js/holder/',
    interface: null,
    demos: [{ ...makeTopic().demos[0], features: ['api.Holder.method'] }],
  });
  const entries = buildSearchIndex(
    [topic],
    new Map([[topic.url, tableOf(topic)]]),
  );
  const features = entries.filter((e) => e.type === 'feature');
  assert.deepEqual(
    features.map((e) => [e.title, e.terms]),
    [['Holder', ['api.holder']]],
  );
  // A topic missing from the map simply has no feature entries.
  assert.equal(
    buildSearchIndex([topic], new Map()).filter((e) => e.type === 'feature')
      .length,
    0,
  );
});

// --- sitemap --------------------------------------------------------------

test('buildSitemap writes sorted absolute URLs without lastmod', () => {
  const xml = buildSitemap(['/html/dialog/', '/', '/html/dialog/'], SITE);
  assert.ok(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>\n'));
  assert.ok(
    xml.includes(
      '<loc>https://vectode.github.io/HTML-Template/html/dialog/</loc>',
    ),
  );
  assert.ok(!xml.includes('\\'));
  assert.ok(!xml.includes('lastmod'));
  assert.equal(xml.split('<loc>').length - 1, 2);
  assert.ok(
    xml.indexOf('HTML-Template/</loc>') < xml.indexOf('html/dialog/</loc>'),
  );
  assert.ok(xml.endsWith('</urlset>\n'));
});

test('buildSitemap uses / for backslash paths and escapes text', () => {
  const xml = buildSitemap(['\\css\\grid\\', '/a&b/'], SITE);
  assert.ok(xml.includes('HTML-Template/css/grid/</loc>'));
  assert.ok(xml.includes('HTML-Template/a&amp;b/</loc>'));
  assert.ok(!xml.includes('\\'));
});

// --- precache -------------------------------------------------------------

test('buildPrecache lists every file but itself, as site URLs', () => {
  const files = new Map([
    ['index.html', 'home'],
    ['html/dialog/index.html', 'dialog'],
    ['data/nav.json', Buffer.from('{}')],
    ['precache.json', 'old'],
    ['sitemap.xml', 'x'],
  ]);
  const { version, urls } = buildPrecache(files);
  assert.deepEqual(urls, [
    '/HTML-Template/',
    '/HTML-Template/data/nav.json',
    '/HTML-Template/html/dialog/',
    '/HTML-Template/sitemap.xml',
  ]);
  assert.match(version, /^[0-9a-f]{16}$/);
});

test('buildPrecache version follows the documented formula', () => {
  const files = new Map([
    ['b.txt', 'b'],
    ['a.txt', 'a'],
  ]);
  const hex = (x) => createHash('sha256').update(x).digest('hex');
  const lines = ['a.txt', 'b.txt']
    .map((p) => `${p}\0${hex(p === 'a.txt' ? 'a' : 'b')}`)
    .join('\n');
  assert.equal(buildPrecache(files).version, hex(lines).slice(0, 16));
});

test('buildPrecache ignores insertion order and sees one changed byte', () => {
  const a = new Map([
    ['index.html', 'home'],
    ['data/nav.json', '{}'],
  ]);
  const b = new Map([
    ['data/nav.json', '{}'],
    ['index.html', 'home'],
  ]);
  assert.deepEqual(buildPrecache(a), buildPrecache(b));
  const c = new Map([
    ['data/nav.json', '{}'],
    ['index.html', 'hom3'],
  ]);
  assert.notEqual(buildPrecache(a).version, buildPrecache(c).version);
  assert.deepEqual(buildPrecache(a).urls, buildPrecache(c).urls);
  // The precache file itself never changes the version.
  const d = new Map([...a, ['precache.json', 'anything']]);
  assert.equal(buildPrecache(d).version, buildPrecache(a).version);
});

test('buildPrecache treats backslash and slash paths alike', () => {
  const posix = new Map([['html/dialog/index.html', 'x']]);
  const win = new Map([['html\\dialog\\index.html', 'x']]);
  assert.deepEqual(buildPrecache(win), buildPrecache(posix));
});

test('every emitted URL carries the site base', () => {
  const topic = makeTopic();
  const table = tableOf(topic);
  const { data } = buildTopicData(topic, { index, baseline, table });
  const nav = buildNav([topic]);
  const search = buildSearchIndex([topic], new Map([[topic.url, table]]));
  const precache = buildPrecache(
    new Map([
      ['index.html', 'a'],
      ['html/dialog/index.html', 'b'],
      ['data/nav.json', 'c'],
    ]),
  );
  const urls = [
    data.url,
    ...nav.categories.flatMap((c) => c.topics.map((t) => t.url)),
    ...search.map((e) => e.url),
    ...precache.urls,
  ];
  assert.ok(urls.length > 8);
  for (const url of urls) assert.ok(url.startsWith(SITE.base), url);
});

test('outputs take another site base when one is passed', () => {
  const site = { ...SITE, base: '/' };
  const topic = makeTopic();
  const { data } = buildTopicData(topic, { index, baseline, table: [], site });
  assert.equal(data.url, '/html/dialog/');
  assert.equal(
    buildNav([topic], { site }).categories[0].topics[0].url,
    '/html/dialog/',
  );
  const search = buildSearchIndex([topic], new Map(), { site });
  assert.ok(search.every((e) => e.url.startsWith('/html/dialog/')));
  assert.deepEqual(
    buildPrecache(new Map([['index.html', 'x']]), { site }).urls,
    ['/'],
  );
});
