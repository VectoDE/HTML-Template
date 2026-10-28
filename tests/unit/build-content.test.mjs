import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadContent } from '../../scripts/build/content.mjs';
import { writeTree } from './helpers/fixtures.mjs';

let base;
before(async () => {
  base = await mkdtemp(join(tmpdir(), 'html-template-content-'));
});
after(async () => {
  await rm(base, { recursive: true, force: true });
});

let counter = 0;
async function load(files, { empty = [] } = {}) {
  const dir = join(base, `case-${counter++}`);
  await mkdir(dir, { recursive: true });
  for (const sub of empty) await mkdir(join(dir, sub), { recursive: true });
  await writeTree(dir, files);
  return loadContent(dir);
}

const topicMd = (extra = {}) => {
  const data = {
    title: 'Dialog',
    number: '1',
    lede: 'A modal box.',
    spec: 'https://html.spec.whatwg.org/#the-dialog-element',
    ...extra,
  };
  const lines = Object.entries(data)
    .filter(([, v]) => v !== null)
    .map(([k, v]) => `${k}: ${v}`);
  return `---\n${lines.join('\n')}\n---\n\n## When to use\n\nUse it.\n`;
};

const demoHtml = (title = 'Modal') =>
  `<script type="application/json" data-demo-meta>
{
  "title": "${title}",
  "summary": "s",
  "fallback": "f",
  "features": ["html.elements.dialog"],
  "detect": "true",
  "runsIn": "frame"
}
</script>
<template data-lang="js">
  run();
</template>
`;

const OK = {
  'html/dialog/topic.md': topicMd(),
  'html/dialog/02-light-dismiss.demo.html': demoHtml('Light'),
  'html/dialog/01-modal.demo.html': demoHtml('Modal'),
};

test('one topic with two demos in order', async () => {
  const { topics, errors } = await load(OK);
  assert.deepEqual(errors, []);
  assert.equal(topics.length, 1);
  const [t] = topics;
  assert.equal(t.category, 'html');
  assert.equal(t.slug, 'dialog');
  assert.equal(t.url, '/html/dialog/');
  assert.equal(t.title, 'Dialog');
  assert.equal(t.number, 1);
  assert.equal(t.interface, null);
  assert.equal(t.mdn, null);
  assert.equal(t.appendix, null);
  assert.deepEqual(t.tables, []);
  assert.deepEqual(t.spec, [
    'https://html.spec.whatwg.org/#the-dialog-element',
  ]);
  assert.match(t.bodyHtml, /<h2>When to use<\/h2>/);
  assert.deepEqual(
    t.demos.map((d) => [d.n, d.slug, d.id, d.title]),
    [
      [1, 'modal', 'demo-1', 'Modal'],
      [2, 'light-dismiss', 'demo-2', 'Light'],
    ],
  );
  assert.equal(t.demos[0].file, 'content/html/dialog/01-modal.demo.html');
  assert.equal(t.demos[0].code.js, 'run();');
});

test('an empty content dir with only coverage/ gives nothing', async () => {
  const out = await load({}, { empty: ['coverage'] });
  assert.deepEqual(out, { topics: [], errors: [] });
});

test('coverage/ is skipped even with files in it', async () => {
  const out = await load({ 'coverage/exclusions.json': '{}' });
  assert.deepEqual(out, { topics: [], errors: [] });
});

test('optional front matter keys and a spec list', async () => {
  const { topics, errors } = await load({
    'css/grid/topic.md': topicMd({
      interface: 'CSSGridValue',
      mdn: 'https://developer.mozilla.org/docs/Web/CSS/grid',
      tables: '[css.properties.grid]',
      appendix: 'deprecated',
      spec: '[https://www.w3.org/TR/css-grid-2/, https://www.w3.org/TR/css-grid-3/]',
    }),
  });
  assert.deepEqual(errors, []);
  const [t] = topics;
  assert.equal(t.interface, 'CSSGridValue');
  assert.equal(t.appendix, 'deprecated');
  assert.deepEqual(t.tables, ['css.properties.grid']);
  assert.equal(t.spec.length, 2);
  assert.equal(t.demos.length, 0);
});

test('unknown category is one error', async () => {
  const { errors } = await load({ 'xml/thing/topic.md': topicMd() });
  assert.equal(errors.length, 1);
  assert.match(errors[0], /^content\/xml:1 unknown category "xml"/);
});

test('two demos with the same number are an error', async () => {
  const { errors } = await load({
    ...OK,
    'html/dialog/01-other.demo.html': demoHtml(),
  });
  assert.equal(errors.length, 1);
  assert.match(errors[0], /duplicate demo number 01/);
});

test('duplicate topic number in one category names both paths', async () => {
  const { errors } = await load({
    'css/a/topic.md': topicMd(),
    'css/a/01-x.demo.html': demoHtml(),
    'css/b/topic.md': topicMd(),
    'css/b/01-x.demo.html': demoHtml(),
  });
  assert.equal(errors.length, 1);
  assert.match(errors[0], /css\/b\/topic\.md/);
  assert.match(errors[0], /css\/a\/topic\.md/);
});

test('same number in different categories is fine', async () => {
  const { errors } = await load({
    'css/a/topic.md': topicMd(),
    'css/a/01-x.demo.html': demoHtml(),
    'html/b/topic.md': topicMd(),
    'html/b/01-x.demo.html': demoHtml(),
  });
  assert.deepEqual(errors, []);
});

test('a topic without demos needs the appendix key', async () => {
  const { errors } = await load({ 'html/empty/topic.md': topicMd() });
  assert.equal(errors.length, 1);
  assert.match(errors[0], /needs at least one demo/);
});

test('independent errors in two files are all reported, sorted', async () => {
  const { errors } = await load({
    'html/b/topic.md': topicMd({ lede: null }),
    'html/b/01-x.demo.html': demoHtml(),
    'html/a/topic.md': topicMd(),
    'html/a/01-x.demo.html': 'nonsense',
  });
  assert.equal(errors.length, 2);
  assert.match(errors[0], /^content\/html\/a\/01-x\.demo\.html:/);
  assert.match(errors[1], /^content\/html\/b\/topic\.md:.*lede/);
  assert.deepEqual(errors, [...errors].sort());
});

test('stray files inside a topic are errors', async () => {
  const { errors } = await load({ ...OK, 'html/dialog/README.txt': 'hi' });
  assert.equal(errors.length, 1);
  assert.match(errors[0], /html\/dialog\/README\.txt:1 unexpected file/);
});

test('stray file at category level and content root are errors', async () => {
  const { errors } = await load({
    ...OK,
    'html/notes.txt': 'x',
    'top.txt': 'x',
  });
  assert.equal(errors.length, 2);
});

test('bad slugs and demo file names are errors', async () => {
  const { errors } = await load({
    'html/Bad_Slug/topic.md': topicMd(),
    'html/ok/topic.md': topicMd({ number: '2' }),
    'html/ok/1-x.demo.html': demoHtml(),
    'html/ok/00-x.demo.html': demoHtml(),
    'html/ok/03-Bad.demo.html': demoHtml(),
    'html/ok/04-.demo.html': demoHtml(),
    'html/ok/05-x.demo.html': demoHtml(),
  });
  assert.equal(errors.length, 5);
  assert.ok(errors.some((e) => /Bad_Slug.*invalid topic slug/.test(e)));
});

test('a topic folder without topic.md is an error', async () => {
  const { errors } = await load({
    'html/x/01-a.demo.html': demoHtml(),
  });
  assert.equal(errors.length, 1);
  assert.match(errors[0], /missing topic\.md/);
});

test('front matter validation', async () => {
  const bad = async (extra, re) => {
    const { errors } = await load({
      'html/x/topic.md': topicMd(extra),
      'html/x/01-a.demo.html': demoHtml(),
    });
    assert.equal(errors.length, 1, JSON.stringify(extra));
    assert.match(errors[0], re);
  };
  await bad({ color: 'red' }, /unknown key "color"/);
  await bad({ title: null }, /missing key "title"/);
  await bad({ title: '"  "' }, /title/);
  await bad({ title: '5' }, /"title" must be a non-empty string/);
  await bad({ lede: '7' }, /"lede" must be a non-empty string/);
  await bad({ number: '"one"' }, /number/);
  await bad({ number: '0' }, /number/);
  await bad({ spec: 'http://x.test/' }, /spec/);
  await bad({ spec: '[]' }, /spec/);
  await bad({ mdn: 'nope' }, /mdn/);
  await bad({ tables: '"x"' }, /tables/);
  await bad({ appendix: 'old' }, /appendix/);
  await bad({ interface: '""' }, /interface/);
});

test('markdown and demo errors carry their file and line', async () => {
  const { errors } = await load({
    'html/x/topic.md': topicMd().replace('Use it.', '<div>raw</div>'),
    'html/x/01-a.demo.html': demoHtml(),
  });
  assert.equal(errors.length, 1);
  assert.match(errors[0], /^content\/html\/x\/topic\.md:\d+ raw HTML/);
});

test('front matter that cannot be parsed is an error', async () => {
  const { errors } = await load({
    'html/x/topic.md': 'no front matter',
    'html/x/01-a.demo.html': demoHtml(),
  });
  assert.equal(errors.length, 1);
  assert.match(errors[0], /topic\.md:1/);
});

test('topics are ordered by category, then number', async () => {
  const mk = (cat, slug, number) => ({
    [`${cat}/${slug}/topic.md`]: topicMd({ number: String(number) }),
    [`${cat}/${slug}/01-x.demo.html`]: demoHtml(),
  });
  const { topics } = await load({
    ...mk('recipes', 'r', 1),
    ...mk('css', 'c2', 2),
    ...mk('html', 'h', 5),
    ...mk('css', 'c1', 1),
  });
  assert.deepEqual(
    topics.map((t) => t.url),
    ['/html/h/', '/css/c1/', '/css/c2/', '/recipes/r/'],
  );
});

test('an unreadable dir is reported, other errors are rethrown', async () => {
  const boom = Object.assign(new Error('nope'), { code: 'ENOENT' });
  const missing = await loadContent('x', {
    readdir: async () => {
      throw boom;
    },
    readFile: async () => '',
  });
  assert.equal(missing.errors.length, 1);
  assert.match(missing.errors[0], /^content:1 cannot read/);
  await assert.rejects(
    loadContent('x', {
      readdir: async () => {
        throw new TypeError('bug');
      },
      readFile: async () => '',
    }),
    TypeError,
  );
});
