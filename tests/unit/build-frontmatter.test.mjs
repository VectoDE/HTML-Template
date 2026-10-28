import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ContentError,
  parseFrontMatter,
} from '../../scripts/build/frontmatter.mjs';

const SAMPLE = [
  '---',
  'title: Dialog',
  'number: 17',
  'lede: "Modal: and non-modal"',
  "alt: 'single quoted'",
  'tables: [html.global_attributes.inert, api.CloseWatcher]',
  'none: []',
  'spec:',
  '  - https://html.spec.whatwg.org/multipage/interactive-elements.html',
  '  - https://example.org/two',
  '---',
  'Body line one.',
  '',
  'Body line two.',
  '',
].join('\n');

const EXPECTED = {
  title: 'Dialog',
  number: 17,
  lede: 'Modal: and non-modal',
  alt: 'single quoted',
  tables: ['html.global_attributes.inert', 'api.CloseWatcher'],
  none: [],
  spec: [
    'https://html.spec.whatwg.org/multipage/interactive-elements.html',
    'https://example.org/two',
  ],
};

test('parses bare, quoted, number, flow and block values', () => {
  const r = parseFrontMatter(SAMPLE, 'a.md');
  assert.deepEqual(r.data, EXPECTED);
  assert.equal(r.bodyLine, 12);
  assert.equal(r.body, 'Body line one.\n\nBody line two.\n');
});

test('CRLF input gives the same result with an LF body', () => {
  const r = parseFrontMatter(SAMPLE.replaceAll('\n', '\r\n'), 'a.md');
  assert.deepEqual(r.data, EXPECTED);
  assert.equal(r.bodyLine, 12);
  assert.equal(r.body, 'Body line one.\n\nBody line two.\n');
});

test('ContentError carries file, line and a prefixed message', () => {
  const e = new ContentError('x.md', 4, 'boom');
  assert.ok(e instanceof Error);
  assert.equal(e.file, 'x.md');
  assert.equal(e.line, 4);
  assert.equal(e.message, 'x.md:4 boom');
});

test('missing opening marker fails on line 1', () => {
  assert.throws(
    () => parseFrontMatter('title: x\n---\n', 'a.md'),
    (e) => e instanceof ContentError && e.line === 1,
  );
});

test('missing closing marker fails', () => {
  assert.throws(() => parseFrontMatter('---\ntitle: x\n', 'a.md'), /closing/);
});

test('duplicate key names its line', () => {
  assert.throws(
    () => parseFrontMatter('---\ntitle: a\ntitle: b\n---\n', 'a.md'),
    (e) => e instanceof ContentError && e.line === 3,
  );
});

test('nested maps are rejected', () => {
  assert.throws(
    () => parseFrontMatter('---\n  nested:\n    a: b\n---\n', 'a.md'),
    ContentError,
  );
  assert.throws(
    () => parseFrontMatter('---\nnested:\n    a: b\n---\n', 'a.md'),
    (e) => e instanceof ContentError && e.line === 3,
  );
});

test('tab indentation is rejected', () => {
  assert.throws(
    () => parseFrontMatter('---\nspec:\n\t- x\n---\n', 'a.md'),
    (e) => e instanceof ContentError && e.line === 3,
  );
});

test('malformed lines are rejected', () => {
  for (const bad of [
    'no colon here',
    ': value',
    'k: "open',
    "k: 'open",
    'k: [a, b',
    'k:',
  ]) {
    assert.throws(
      () => parseFrontMatter(`---\n${bad}\n---\n`, 'a.md'),
      ContentError,
      bad,
    );
  }
});

test('blank lines inside the block are ignored and empty body works', () => {
  const r = parseFrontMatter('---\n\ntitle: x\n---', 'a.md');
  assert.deepEqual(r.data, { title: 'x' });
  assert.equal(r.body, '');
  assert.equal(r.bodyLine, 5);
});
