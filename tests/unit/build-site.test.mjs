import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import {
  access,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  symlink,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { indexBaseline, indexCompat } from '../../scripts/build/compat.mjs';
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

test('buildSite turns CRLF into LF before it hashes the precache', () => {
  const lf = buildSite(input([makeTopic({ bodyHtml: '<p>a\nb</p>' })]));
  const crlf = buildSite(input([makeTopic({ bodyHtml: '<p>a\r\nb</p>' })]));
  assert.deepEqual(crlf.files, lf.files);
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
  return root;
}

async function run(root, options = {}) {
  const stdout = sink();
  const stderr = sink();
  const code = await main([], {
    root,
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

const unreachable = async () => {
  throw new Error('reached');
};

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

// Every file below dir, as Map<posix path, Buffer>.
async function readTree(dir) {
  const names = await readdir(dir, { recursive: true, withFileTypes: true });
  const entries = await Promise.all(
    names
      .filter((e) => e.isFile())
      .map(async (e) => {
        const full = join(e.parentPath, e.name);
        const key = full.slice(dir.length + 1).replaceAll('\\', '/');
        return [key, await readFile(full)];
      }),
  );
  return new Map(entries.toSorted(([x], [y]) => (x < y ? -1 : 1)));
}

test('CRLF and LF sources give identical output trees', async () => {
  const lf = await project(tree('\n'));
  const crlf = await project(tree('\r\n'));
  assert.equal((await run(lf)).code, 0);
  assert.equal((await run(crlf)).code, 0);
  const a = await readTree(join(lf, 'dist/site'));
  const b = await readTree(join(crlf, 'dist/site'));
  assert.ok(a.has('data/nav.json') && a.has('robots.txt'));
  assert.deepEqual([...b.keys()], [...a.keys()]);
  for (const [path, bytes] of a) {
    assert.ok(bytes.equals(b.get(path)), path);
    assert.ok(!bytes.includes(13), `${path} has CR`);
  }
});

test('main with empty content builds the home page only', async () => {
  const root = await project();
  const { code, out } = await run(root);
  assert.equal(code, 0);
  assert.match(out, /build: 6 files, 0 topics, 0 demos/);
});

test('main builds without an exclusions file', async () => {
  const root = await project();
  await rm(join(root, 'content/coverage/exclusions.json'));
  await mkdir(join(root, 'content/coverage'), { recursive: true });
  assert.equal((await run(root)).code, 0);
});

test('content errors print and exit 1 without touching out', async () => {
  const root = await project();
  await writeTree(root, {
    'dist/site/keep.txt': 'keep',
    'content/html/dialog/topic.md': 'no front matter',
  });
  const { code, err } = await run(root, { load: unreachable });
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

test('main refuses out equal to the root and deletes nothing', async () => {
  const root = await project();
  const { code, err } = await run(root, { out: '.', load: unreachable });
  assert.equal(code, 1);
  assert.match(err, /refusing/);
  assert.ok(await exists(join(root, 'content/coverage/exclusions.json')));
});

test('main refuses out outside root/dist and deletes nothing', async () => {
  const root = await project();
  await writeTree(root, {
    'other/file.txt': 'x',
    '../sibling-of-root/file.txt': 'x',
  });
  const outs = [
    'other',
    'content',
    '..',
    '../sibling-of-root',
    'dist',
    'dist/',
    join(root, 'other'),
  ];
  for (const out of outs) {
    const { code, err } = await run(root, { out, load: unreachable });
    assert.equal(code, 1, out);
    assert.match(err, /refusing/, out);
  }
  assert.ok(await exists(join(root, 'other/file.txt')));
  assert.ok(await exists(join(root, '../sibling-of-root/file.txt')));
  assert.ok(await exists(join(root, 'content/coverage/exclusions.json')));
  await rm(join(root, '../sibling-of-root'), { recursive: true });
});

test('main refuses when dist is a link and deletes nothing', async (t) => {
  const root = await project();
  const elsewhere = join(base, `target-${counter++}`);
  await writeTree(elsewhere, { 'site/file.txt': 'keep' });
  try {
    await symlink(elsewhere, join(root, 'dist'), 'junction');
  } catch {
    t.skip('this platform cannot create a directory link here');
    return;
  }
  const { code, err } = await run(root, { load: unreachable });
  assert.equal(code, 1);
  assert.match(err, /refusing/);
  assert.ok(await exists(join(elsewhere, 'site/file.txt')));
});

test('main refuses when a folder below dist is a link', async (t) => {
  const root = await project();
  const elsewhere = join(base, `target-${counter++}`);
  await writeTree(elsewhere, { 'file.txt': 'keep' });
  await mkdir(join(root, 'dist'), { recursive: true });
  try {
    await symlink(elsewhere, join(root, 'dist/site'), 'junction');
  } catch {
    t.skip('this platform cannot create a directory link here');
    return;
  }
  const { code, err } = await run(root, { load: unreachable });
  assert.equal(code, 1);
  assert.match(err, /refusing/);
  assert.ok(await exists(join(elsewhere, 'file.txt')));
});

test('main rejects unknown arguments', async () => {
  const root = await project();
  const stderr = sink();
  const code = await main(['--strict'], {
    root,
    stdout: sink(),
    stderr,
    load: unreachable,
  });
  assert.equal(code, 1);
  assert.match(stderr.box.text, /unknown option --strict/);
});

test('main accepts another folder below dist', async () => {
  const root = await project();
  const { code } = await run(root, { out: 'dist/preview' });
  assert.equal(code, 0);
  assert.ok(await exists(join(root, 'dist/preview/index.html')));
});

test('a demo key above unit level exits 1 and names file and key', async () => {
  const root = await project();
  await writeTree(root, {
    'content/html/dialog/topic.md': topicMd('\n'),
    'content/html/dialog/01-modal.demo.html': demoHtml('css.properties'),
  });
  const { code, err } = await run(root);
  assert.equal(code, 1);
  assert.match(
    err,
    /content\/html\/dialog\/01-modal\.demo\.html:1 key css\.properties is above unit level; list a unit such as css\.properties\.<name>/,
  );
  assert.ok(!err.includes('    at '));
});

test('a broken exclusions file exits 1 with file and line, no stack', async () => {
  for (const text of ['{ nope', '{"key": "x"}']) {
    const root = await project({ 'content/coverage/exclusions.json': text });
    const { code, err } = await run(root);
    assert.equal(code, 1);
    assert.match(err, /^content\/coverage\/exclusions\.json:1 /);
    assert.ok(!err.includes('    at '));
  }
});
