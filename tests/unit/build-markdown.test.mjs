import { test } from 'node:test';
import assert from 'node:assert/strict';
import { escapeHtml, renderMarkdown } from '../../scripts/build/markdown.mjs';
import { ContentError } from '../../scripts/build/frontmatter.mjs';

const md = (text, first) => renderMarkdown(text, 't.md', first);

test('escapeHtml escapes all five characters', () => {
  assert.equal(escapeHtml(`&<>"'`), '&amp;&lt;&gt;&quot;&#39;');
});

test('inline strong and code', () => {
  assert.equal(
    md('Use **dialog** with `showModal()`.'),
    '<p>Use <strong>dialog</strong> with <code>showModal()</code>.</p>',
  );
});

test('emphasis', () => {
  assert.equal(md('an *odd* word'), '<p>an <em>odd</em> word</p>');
  assert.equal(md('a * b'), '<p>a * b</p>');
});

test('headings two to four', () => {
  assert.equal(md('## When'), '<h2>When</h2>');
  assert.equal(md('### A'), '<h3>A</h3>');
  assert.equal(md('#### B'), '<h4>B</h4>');
});

test('h1 and deeper headings are errors', () => {
  assert.throws(() => md('# Title'), /h1/);
  assert.throws(() => md('##### Deep'), ContentError);
});

test('hash without space is a paragraph', () => {
  assert.equal(md('#hash'), '<p>#hash</p>');
});

test('unordered and ordered lists', () => {
  assert.equal(md('- one\n- two'), '<ul><li>one</li><li>two</li></ul>');
  assert.equal(md('1. one\n2. two'), '<ol><li>one</li><li>two</li></ol>');
  assert.equal(md('- a\n1. b'), '<ul><li>a</li></ul>\n<ol><li>b</li></ol>');
});

test('blocks are joined with newlines', () => {
  assert.equal(
    md('## A\n\ntext\n\n- x'),
    '<h2>A</h2>\n<p>text</p>\n<ul><li>x</li></ul>',
  );
});

test('fenced code is escaped and carries the language', () => {
  assert.equal(
    md('```css\na < b { }\n```'),
    '<pre><code class="language-css">a &lt; b { }</code></pre>',
  );
  assert.equal(md('```\n<p>\n```'), '<pre><code>&lt;p&gt;</code></pre>');
});

test('lines starting with # or < inside a fence stay code', () => {
  assert.equal(
    md('```html\n<script>x</script>\n# c\n```'),
    '<pre><code class="language-html">&lt;script&gt;x&lt;/script&gt;\n# c</code></pre>',
  );
});

test('unclosed fence throws with its line', () => {
  assert.throws(
    () => md('a\n\n```css\nx', 10),
    (e) =>
      e instanceof ContentError && e.line === 12 && /fence/.test(e.message),
  );
});

test('allowed links', () => {
  assert.equal(
    md('[MDN](https://developer.mozilla.org/)'),
    '<p><a href="https://developer.mozilla.org/">MDN</a></p>',
  );
  for (const href of ['http://x.test', '#a', './b/', '../c/']) {
    assert.equal(md(`[t](${href})`), `<p><a href="${href}">t</a></p>`);
  }
});

test('link text may hold inline markup', () => {
  assert.equal(md('[`a`](#x)'), '<p><a href="#x"><code>a</code></a></p>');
});

test('hrefs are attribute-escaped', () => {
  assert.equal(
    md('[t](https://x.test/?a="b"&c=1)'),
    '<p><a href="https://x.test/?a=&quot;b&quot;&amp;c=1">t</a></p>',
  );
});

test('unsafe or site-breaking link targets throw', () => {
  for (const href of [
    'javascript:alert(1)',
    'data:text/html,x',
    'vbscript:x',
    '//evil.example',
    '/x',
    'relative',
    '',
  ]) {
    assert.throws(() => md(`[x](${href})`), /link target/, href);
  }
});

test('unclosed link or emphasis syntax stays literal', () => {
  assert.equal(md('[x] (y)'), '<p>[x] (y)</p>');
  assert.equal(md('[x](y'), '<p>[x](y</p>');
  assert.equal(md('**open'), '<p>**open</p>');
  assert.equal(md('`open'), '<p>`open</p>');
  assert.equal(md('*open'), '<p>*open</p>');
});

test('raw HTML throws with the right line', () => {
  assert.throws(
    () => md('ok\n\n<script>alert(1)</script>', 5),
    (e) => e.line === 7 && /raw HTML/.test(e.message) && e.file === 't.md',
  );
});

test('plain text is escaped', () => {
  assert.equal(md('a < b & "c"'), '<p>a &lt; b &amp; &quot;c&quot;</p>');
});

test('CRLF input renders like LF', () => {
  assert.equal(md('- a\r\n- b\r\n'), '<ul><li>a</li><li>b</li></ul>');
});

test('empty input renders nothing', () => {
  assert.equal(md(''), '');
});
