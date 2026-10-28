import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkWikiLinks } from '../../scripts/wiki/links.mjs';

const pages = (obj) => new Map(Object.entries(obj));

test('wiki link to an existing page passes', () => {
  const result = checkWikiLinks(
    pages({ Home: 'See [[Getting started]].', 'Getting-started': 'Hi' }),
  );
  assert.deepEqual(result, []);
});

test('wiki link to a missing page names the file name', () => {
  const result = checkWikiLinks(pages({ Home: 'See [[Missing page]].' }));
  assert.equal(result.length, 1);
  assert.match(result[0], /Missing-page/);
  assert.match(result[0], /Home/);
});

test('Markdown link to an existing page passes', () => {
  const result = checkWikiLinks(
    pages({ Home: 'Read [x](Release-process).', 'Release-process': '' }),
  );
  assert.deepEqual(result, []);
});

test('Markdown link to a missing page is reported', () => {
  const result = checkWikiLinks(pages({ Home: '[x](Nowhere)' }));
  assert.equal(result.length, 1);
  assert.match(result[0], /Nowhere/);
});

test('external links, anchors and mailto are ignored', () => {
  const text = '[a](https://example.com) [b](#top) [c](mailto:a@b.c)';
  assert.deepEqual(checkWikiLinks(pages({ Home: text })), []);
});

test('page anchors are stripped before lookup', () => {
  const result = checkWikiLinks(
    pages({ Home: '[x](FAQ#why) [[FAQ#why]]', FAQ: '' }),
  );
  assert.deepEqual(result, []);
});

test('[[Label|Page]] resolves the page part', () => {
  const result = checkWikiLinks(pages({ Home: '[[the faq|FAQ]]', FAQ: '' }));
  assert.deepEqual(result, []);
});

test('links inside code are ignored', () => {
  const text = 'Use `[[Nope]]`.\n\n```\n[[Also nope]]\n[x](Gone)\n```\n';
  assert.deepEqual(checkWikiLinks(pages({ Home: text })), []);
});

test('keys with a .md suffix are accepted', () => {
  const result = checkWikiLinks(pages({ 'Home.md': '[[FAQ]]', 'FAQ.md': '' }));
  assert.deepEqual(result, []);
});

test('Markdown link with a .md suffix resolves the page', () => {
  const result = checkWikiLinks(pages({ Home: '[y](FAQ.md)', FAQ: '' }));
  assert.deepEqual(result, []);
});
