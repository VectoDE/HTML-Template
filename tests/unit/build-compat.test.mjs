import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BROWSERS, BROWSER_LABELS } from '../../scripts/build/config.mjs';
import {
  extractSupport,
  indexBaseline,
  indexCompat,
  resolveKey,
  topicBaseline,
} from '../../scripts/build/compat.mjs';
import { loadCompatData } from '../../scripts/build/data.mjs';
import { miniBcd, miniWebFeatures } from './helpers/fixtures.mjs';

const index = indexCompat(miniBcd());
const baseline = indexBaseline(miniWebFeatures());
const support = (key) => extractSupport(index.get(key).compat);

test('BROWSERS and BROWSER_LABELS', () => {
  assert.deepEqual(BROWSERS, [
    'chrome',
    'chrome_android',
    'edge',
    'firefox',
    'firefox_android',
    'safari',
    'safari_ios',
  ]);
  assert.deepEqual(Object.keys(BROWSER_LABELS), BROWSERS);
  assert.equal(BROWSER_LABELS.safari_ios, 'Safari on iOS');
  assert.equal(BROWSER_LABELS.firefox_android, 'Firefox for Android');
});

test('indexCompat lists nodes with sorted children', () => {
  assert.deepEqual(index.get('html.elements.dialog').children, [
    'html.elements.dialog.closedby',
    'html.elements.dialog.open',
  ]);
  assert.equal(index.get('html.elements').compat, null);
  assert.deepEqual(index.get('html.elements').children, [
    'html.elements.dialog',
  ]);
  assert.ok(index.get('html.elements.dialog.open').compat);
  assert.equal(index.has('__meta'), false);
  assert.equal(index.has('browsers'), false);
  assert.ok(index.has('api.Old'));
});

test('extractSupport picks the unflagged, unprefixed statement', () => {
  const s = support('css.properties.zoom');
  assert.deepEqual(s.chrome, { added: '42' });
  assert.deepEqual(s.edge, { added: '18', prefix: '-webkit-' });
  assert.deepEqual(s.firefox, { added: '55', flags: true });
  assert.deepEqual(s.firefox_android, { added: false });
  assert.deepEqual(s.safari, { added: 'preview' });
});

test('extractSupport handles ranges, removal and partial support', () => {
  const old = support('api.Old');
  assert.deepEqual(old.chrome, { added: '20', removed: '60' });
  assert.deepEqual(old.safari, { added: '4', removed: '12', approx: true });
  assert.deepEqual(old.edge, { added: false });
  assert.deepEqual(support('html.elements.dialog.open').chrome, {
    added: '37',
    partial: true,
  });
});

test('api.Old is removed or absent in every browser', () => {
  const old = support('api.Old');
  for (const browser of BROWSERS) {
    assert.ok(
      old[browser].added === false || old[browser].removed !== undefined,
      browser,
    );
  }
});

test('extractSupport covers every tracked browser', () => {
  const s = support('api.NoIos');
  assert.deepEqual(Object.keys(s), BROWSERS);
  assert.deepEqual(s.safari_ios, { added: null });
  assert.deepEqual(s.chrome, { added: '10' });
});

test('extractSupport takes an alternative name and unknown versions', () => {
  const s = extractSupport({
    support: {
      chrome: { version_added: true },
      edge: [{ alternative_name: 'old', version_added: '12' }],
      firefox: { version_added: null },
    },
  });
  assert.deepEqual(s.chrome, { added: null });
  assert.deepEqual(s.edge, { added: '12', altName: 'old' });
  assert.deepEqual(s.firefox, { added: null });
});

test('indexBaseline: by-compat-key wins, moved is ignored, ≤ is stripped', () => {
  assert.deepEqual(baseline.get('html.elements.dialog.closedby'), {
    status: 'low',
    low: '2025-05-01',
    high: null,
    year: 2025,
    feature: 'dialog',
  });
  assert.equal(baseline.get('html.elements.dialog.open').status, 'high');
  assert.equal(baseline.get('html.elements.dialog.open').year, 2022);
  const zoom = baseline.get('css.properties.zoom');
  assert.equal(zoom.low, '≤2020-03-24');
  assert.equal(zoom.year, 2020);
  assert.deepEqual(baseline.get('api.NoIos'), {
    status: false,
    low: null,
    high: null,
    year: null,
    feature: 'no-baseline',
  });
  assert.equal(baseline.has('api.Old'), false);
});

test('indexBaseline keeps the weakest status, ties go to the lowest id', () => {
  const feature = (value, year) => ({
    kind: 'feature',
    compat_features: ['api.X'],
    status: { baseline: value, baseline_low_date: `${year}-01-01` },
  });
  const pick = (features) => indexBaseline({ features }).get('api.X');
  assert.equal(
    pick({ a: feature('high', 2018), b: feature('low', 2024) }).feature,
    'b',
  );
  assert.equal(
    pick({ b: feature('low', 2024), a: feature('high', 2018) }).feature,
    'b',
  );
  assert.equal(
    pick({ c: feature('low', 2023), b: feature('low', 2024) }).feature,
    'b',
  );
  assert.equal(
    pick({ a: feature('low', 2023), z: feature(false, 2020) }).status,
    false,
  );
});

test('resolveKey', () => {
  assert.equal(resolveKey('html.elements.nope', index, baseline), null);
  assert.equal(resolveKey('html.elements', index, baseline).support, null);
  const dialog = resolveKey('html.elements.dialog', index, baseline);
  assert.equal(dialog.key, 'html.elements.dialog');
  assert.equal(dialog.mdn, 'https://developer.mozilla.org/docs/Web/Test');
  assert.deepEqual(dialog.spec, ['https://example.test/spec']);
  assert.deepEqual(dialog.status, {
    experimental: false,
    deprecated: false,
    standard: true,
  });
  assert.deepEqual(dialog.baseline, {
    status: 'high',
    low: '2022-03-14',
    high: '2024-09-14',
    year: 2022,
  });
  assert.deepEqual(Object.keys(dialog.support), BROWSERS);
  const zoom = resolveKey('css.properties.zoom', index, baseline);
  assert.deepEqual(zoom.spec, [
    'https://example.test/a',
    'https://example.test/b',
  ]);
  assert.deepEqual(zoom.status, {
    experimental: true,
    deprecated: true,
    standard: false,
  });
  assert.equal(resolveKey('api.Old', index, baseline).baseline, null);
  assert.equal(resolveKey('html.elements', index, baseline).mdn, null);
});

test('topicBaseline', () => {
  const r = (status, year) => ({ baseline: { status, year } });
  assert.deepEqual(topicBaseline([r('high', 2022), r('low', 2024)]), {
    status: 'low',
    year: 2024,
  });
  assert.deepEqual(topicBaseline([r('high', 2022), r(false, null)]), {
    status: false,
    year: null,
  });
  assert.deepEqual(topicBaseline([r('high', 2020), r('high', 2022)]), {
    status: 'high',
    year: 2022,
  });
  assert.deepEqual(topicBaseline([]), { status: null, year: null });
  assert.deepEqual(topicBaseline([{ baseline: null }]), {
    status: null,
    year: null,
  });
});

test('loadCompatData reads through the injected resolve and readFile', async () => {
  const bcd = miniBcd();
  const web = miniWebFeatures();
  const files = new Map([
    ['/x/bcd/data.json', JSON.stringify(bcd)],
    ['/x/wf/data.json', JSON.stringify(web)],
    ['/x/wf/package.json', JSON.stringify({ version: '9.9.9' })],
  ]);
  const asked = [];
  const data = await loadCompatData({
    resolve: (name) => {
      asked.push(name);
      return name === 'web-features/data.json'
        ? '/x/wf/data.json'
        : '/x/bcd/data.json';
    },
    readFile: async (path) => {
      const text = files.get(String(path).replaceAll('\\', '/'));
      if (text === undefined) throw new Error(`unexpected read ${path}`);
      return text;
    },
  });
  assert.deepEqual(asked.toSorted(), [
    '@mdn/browser-compat-data',
    'web-features/data.json',
  ]);
  assert.deepEqual(data.versions, { bcd: '0.0.0-test', webFeatures: '9.9.9' });
  assert.deepEqual(data.bcd, bcd);
  assert.deepEqual(data.webFeatures, web);
});

test('loadCompatData reads the installed packages', async () => {
  const data = await loadCompatData();
  assert.match(data.versions.bcd, /^\d+\.\d+\.\d+/);
  assert.match(data.versions.webFeatures, /^\d+\.\d+\.\d+/);
  assert.ok(data.bcd.html && data.webFeatures.features);
});
