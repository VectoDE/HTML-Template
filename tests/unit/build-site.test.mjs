import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { access, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { indexBaseline, indexCompat } from '../../scripts/build/compat.mjs';
import { main as coverageMain } from '../../scripts/build/coverage.mjs';
import { buildSite, main } from '../../scripts/build/site.mjs';
import {
  makeTopic,
  miniBcd,
  miniWebFeatures,
  writeTree,
} from './helpers/fixtures.mjs';

let base;
before(async () => {
  base = await mkdtemp(join(tmpdir(), 'html-template-site-'));
});
after(async () => {
  await rm(base, { recursive: true, force: true });
});

const index = indexCompat(miniBcd());
const baseline = indexBaseline(miniWebFeatures());
const fixtureData = () => ({
  bcd: miniBcd(),
  webFeatures: miniWebFeatures(),
  versions: { bcd: '0.0.0-test', webFeatures: '0.0.0-test' },
});
const sink = () => {
  const box = { text: '' };
  return { box, write: (s) => (box.text += s) };
};

// --- buildSite ------------------------------------------------------------

const input = (topics) => ({ topics, index, baseline, exclusions: [] });

test('buildSite writes pages, data files, sitemap, robots and precache', () => {
  const { files, errors } = buildSite(input([makeTopic()]));
  assert.deepEqual(errors, []);
  assert.deepEqual(
    [...files.keys()],
    [
      'data/compat/html/dialog.json',
      'data/nav.json',
      'data/search-index.json',
      'html/dialog/index.html',
      'index.html',
      'precache.json',
      'robots.txt',
      'sitemap.xml',
    ],
  );
  const data = JSON.parse(files.get('data/compat/html/dialog.json'));
  assert.equal(data.demos[0].features[0].key, 'html.elements.dialog');
  assert.ok(data.table.some((row) => row.key === 'html.elements.dialog'));
  assert.ok(data.table.some((row) => row.key === 'html.elements.dialog.open'));
  assert.ok(files.get('html/dialog/index.html').includes('<h1>Dialog</h1>'));
  assert.ok(files.get('index.html').includes('/HTML-Template/html/dialog/'));
  assert.match(
    files.get('robots.txt'),
    /^Sitemap: https:\/\/vectode\.github\.io\/HTML-Template\/sitemap\.xml$/m,
  );
  assert.ok(
    files
      .get('sitemap.xml')
      .includes(
        '<loc>https://vectode.github.io/HTML-Template/html/dialog/</loc>',
      ),
  );
  for (const text of files.values()) assert.ok(!text.includes('\r'));
});

test('precache lists every other file', () => {
  const { files } = buildSite(input([makeTopic()]));
  const { urls, version } = JSON.parse(files.get('precache.json'));
  assert.match(version, /^[0-9a-f]{16}$/);
  assert.deepEqual(urls, [
    '/HTML-Template/',
    '/HTML-Template/data/compat/html/dialog.json',
    '/HTML-Template/data/nav.json',
    '/HTML-Template/data/search-index.json',
    '/HTML-Template/html/dialog/',
    '/HTML-Template/robots.txt',
    '/HTML-Template/sitemap.xml',
  ]);
});

test('two runs give identical files', () => {
  const a = buildSite(input([makeTopic()]));
  const b = buildSite(input([makeTopic()]));
  assert.deepEqual(a.files, b.files);
});

test('empty content still gives the home page and data files', () => {
  const { files, errors } = buildSite(input([]));
  assert.deepEqual(errors, []);
  assert.ok(files.has('index.html'));
  assert.ok(files.has('data/nav.json'));
  assert.deepEqual(JSON.parse(files.get('data/search-index.json')), []);
  const sitemap = files.get('sitemap.xml');
  assert.equal(sitemap.match(/<loc>/g).length, 1);
  assert.ok(
    sitemap.includes('<loc>https://vectode.github.io/HTML-Template/</loc>'),
  );
});

test('an unknown demo key is an error and no files come back', () => {
  const topic = makeTopic();
  topic.demos[0].features = ['html.elements.nope'];
  const { files, errors } = buildSite(input([topic]));
  assert.equal(files.size, 0);
  assert.equal(errors.length, 1);
  assert.match(errors[0], /unknown compat key "html\.elements\.nope"/);
});

test('exclusions drop their rows from the topic table', () => {
  const exclusions = [
    { key: 'html.elements.dialog.open', reason: 'test only' },
  ];
  const { files } = buildSite({ ...input([makeTopic()]), exclusions });
  const data = JSON.parse(files.get('data/compat/html/dialog.json'));
  assert.ok(!data.table.some((row) => row.key.endsWith('.open')));
});

// --- main -----------------------------------------------------------------

const topicMd = (nl) =>
  [
    '---',
    'title: Dialog',
    'number: 1',
    'lede: A modal box.',
    'spec: https://html.spec.whatwg.org/#the-dialog-element',
    '---',
    '',
    '## When to use',
    '',
    'Use it for `modal` things.',
    '',
  ].join(nl);

const demoHtml = (key, nl = '\n') =>
  [
    '<script type="application/json" data-demo-meta>',
    '{',
    '  "title": "Modal",',
    '  "summary": "s",',
    '  "fallback": "f",',
    `  "features": ["${key}"],`,
    '  "detect": "true",',
    '  "runsIn": "frame"',
    '}',
    '</script>',
    '<template data-lang="html">',
    '  <dialog>Hi</dialog>',
    '</template>',
    '',
  ].join(nl);

let counter = 0;
async function project(files = {}) {
  const root = join(base, `case-${counter++}`);
  await writeTree(root, {
    'content/coverage/exclusions.json': '[]\n',
    ...files,
  });
  // Brings pending.json and claims.json in line with the content.
  const code = await coverageMain(['--update'], {
    root,
    env: {},
    stdout: sink(),
    stderr: sink(),
    load: async () => fixtureData(),
  });
  assert.equal(code, 0);
  return root;
}

async function run(root, options = {}) {
  const stdout = sink();
  const stderr = sink();
  const code = await main([], {
    root,
    env: {},
    stdout,
    stderr,
    load: async () => fixtureData(),
    ...options,
  });
  return { code, out: stdout.box.text, err: stderr.box.text };
}

const exists = (path) =>
  access(path).then(
    () => true,
    () => false,
  );

const tree = (nl) => ({
  'content/html/dialog/topic.md': topicMd(nl),
  'content/html/dialog/01-modal.demo.html': demoHtml(
    'html.elements.dialog',
    nl,
  ),
});

test('main builds the site into dist/site', async () => {
  const root = await project(tree('\n'));
  const { code, out, err } = await run(root);
  assert.equal(err, '');
  assert.equal(code, 0);
  assert.match(out, /build: 8 files, 1 topics, 1 demos -> dist\/site/);
  const dist = join(root, 'dist/site');
  const page = await readFile(join(dist, 'html/dialog/index.html'), 'utf8');
  assert.ok(page.includes('<h1>Dialog</h1>'));
  const compat = JSON.parse(
    await readFile(join(dist, 'data/compat/html/dialog.json'), 'utf8'),
  );
  assert.equal(compat.demos[0].features[0].key, 'html.elements.dialog');
});

test('main replaces the old output', async () => {
  const root = await project(tree('\n'));
  await writeTree(root, { 'dist/site/stale.txt': 'old' });
  assert.equal((await run(root)).code, 0);
  assert.equal(await exists(join(root, 'dist/site/stale.txt')), false);
});

const OUTPUTS = [
  'index.html',
  'html/dialog/index.html',
  'data/compat/html/dialog.json',
  'data/search-index.json',
  'precache.json',
  'sitemap.xml',
];

const readOutputs = (root) =>
  Promise.all(OUTPUTS.map((f) => readFile(join(root, 'dist/site', f), 'utf8')));

test('CRLF and LF sources give identical output', async () => {
  const lf = await project(tree('\n'));
  const crlf = await project(tree('\r\n'));
  assert.equal((await run(lf)).code, 0);
  assert.equal((await run(crlf)).code, 0);
  assert.deepEqual(await readOutputs(crlf), await readOutputs(lf));
});

test('main with empty content builds the home page only', async () => {
  const root = await project();
  const { code, out } = await run(root);
  assert.equal(code, 0);
  assert.match(out, /build: 6 files, 0 topics, 0 demos/);
});

test('content errors print and exit 1 without touching out', async () => {
  const root = await project();
  await writeTree(root, {
    'dist/site/keep.txt': 'keep',
    'content/html/dialog/topic.md': 'no front matter',
  });
  const { code, err } = await run(root);
  assert.equal(code, 1);
  assert.match(err, /content\/html\/dialog\/topic\.md/);
  assert.equal(
    await readFile(join(root, 'dist/site/keep.txt'), 'utf8'),
    'keep',
  );
});

test('an unknown demo key exits 1 and writes nothing', async () => {
  const root = await project();
  await writeTree(root, {
    'content/html/dialog/topic.md': topicMd('\n'),
    'content/html/dialog/01-modal.demo.html': demoHtml('html.elements.nope'),
    'dist/site/keep.txt': 'keep',
  });
  const { code, err } = await run(root);
  assert.equal(code, 1);
  assert.match(err, /html\.elements\.nope/);
  assert.equal(
    await readFile(join(root, 'dist/site/keep.txt'), 'utf8'),
    'keep',
  );
  assert.equal(await exists(join(root, 'dist/site/index.html')), false);
});

test('a failing coverage gate stops the build', async () => {
  const root = await project(tree('\n'));
  await writeTree(root, { 'content/coverage/pending.json': '["api.Old"]' });
  const { code, err } = await run(root);
  assert.equal(code, 1);
  assert.match(err, /coverage: failed/);
  assert.equal(await exists(join(root, 'dist/site/index.html')), false);
});

test('main refuses out equal to the root and deletes nothing', async () => {
  const root = await project();
  const { code, err } = await run(root, { out: '.' });
  assert.equal(code, 1);
  assert.match(err, /refusing/);
  assert.ok(await exists(join(root, 'content/coverage/exclusions.json')));
});

test('main refuses out outside root/dist and deletes nothing', async () => {
  const root = await project();
  await writeTree(root, { 'other/file.txt': 'x' });
  for (const out of ['other', 'content', '../elsewhere', join(root, 'other')]) {
    const { code, err } = await run(root, { out });
    assert.equal(code, 1, out);
    assert.match(err, /refusing/);
  }
  assert.ok(await exists(join(root, 'other/file.txt')));
  assert.ok(await exists(join(root, 'content/coverage/exclusions.json')));
});

test('main accepts another folder below dist', async () => {
  const root = await project();
  const { code } = await run(root, { out: 'dist/preview' });
  assert.equal(code, 0);
  assert.ok(await exists(join(root, 'dist/preview/index.html')));
});
