import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseDemo } from '../../scripts/build/demo.mjs';
import { ContentError } from '../../scripts/build/frontmatter.mjs';
import {
  CATEGORIES,
  NAMESPACES,
  PERMISSIONS,
} from '../../scripts/build/config.mjs';

const META = {
  title: 'Modal dialog',
  summary: 'Opens a dialog with showModal().',
  fallback: 'Shows the dialog inline.',
  features: ['html.elements.dialog', 'api.HTMLDialogElement.showModal'],
  detect: "typeof HTMLDialogElement === 'function'",
  runsIn: 'frame',
};

const SCRIPT_OPEN = '<script type="application/json" data-demo-meta>';

const meta = (extra = {}) =>
  `${SCRIPT_OPEN}\n${JSON.stringify({ ...META, ...extra }, null, 2)}\n</script>\n`;

const tpl = (lang, body) =>
  `<template data-lang="${lang}">\n${body}\n</template>\n`;

const FULL =
  meta() +
  tpl('html', '  <dialog id="d">\n    <p>Hi</p>\n  </dialog>') +
  tpl('css', '  dialog { padding: 1rem; }') +
  tpl('js', '\n  d.showModal();\n\n');

const parse = (text) => parseDemo(text, 'd.demo.html');
const fails = (text, re) =>
  assert.throws(
    () => parse(text),
    (e) => e instanceof ContentError && re.test(e.message),
  );

test('config constants', () => {
  assert.deepEqual(
    CATEGORIES.map((c) => c.id),
    ['html', 'css', 'js', 'recipes'],
  );
  assert.ok(NAMESPACES.includes('http') && NAMESPACES.includes('webassembly'));
  assert.equal(PERMISSIONS.camera.allow, 'camera');
  assert.equal(PERMISSIONS.notifications.allow, null);
  assert.ok(Object.isFrozen(PERMISSIONS));
});

test('a full demo is parsed and de-indented', () => {
  const demo = parse(FULL);
  assert.equal(demo.title, 'Modal dialog');
  assert.equal(demo.a11y, null);
  assert.deepEqual(demo.permissions, []);
  assert.deepEqual(demo.features, META.features);
  assert.equal(demo.runsIn, 'frame');
  assert.deepEqual(demo.code, {
    html: '<dialog id="d">\n  <p>Hi</p>\n</dialog>',
    css: 'dialog { padding: 1rem; }',
    js: 'd.showModal();',
  });
});

test('nested templates in html code stay intact', () => {
  const code =
    '<my-el><template shadowrootmode="open"><slot></slot></template></my-el>';
  assert.equal(parse(meta() + tpl('html', code)).code.html, code);
});

test('a JS-only demo has empty html and css', () => {
  const demo = parse(meta() + tpl('js', 'run();'));
  assert.equal(demo.code.html, '');
  assert.equal(demo.code.css, '');
  assert.equal(demo.code.js, 'run();');
});

test('CRLF gives the same demo', () => {
  assert.deepEqual(parse(FULL.replaceAll('\n', '\r\n')), parse(FULL));
});

test('optional meta keys are read', () => {
  const demo = parse(
    meta({
      a11y: 'Focus returns.',
      permissions: ['camera'],
      runsIn: 'window',
    }) + tpl('js', 'x();'),
  );
  assert.equal(demo.a11y, 'Focus returns.');
  assert.deepEqual(demo.permissions, ['camera']);
  assert.equal(demo.runsIn, 'window');
});

test('http and webassembly feature keys are accepted', () => {
  const features = ['http.headers.Accept', 'webassembly.api.compile'];
  const demo = parse(meta({ features }) + tpl('js', 'x();'));
  assert.deepEqual(demo.features, features);
});

test('<template-x> and <templates> are not template tags', () => {
  const code = '<template-x>a</template-x><templates>b</templates>';
  assert.equal(parse(meta() + tpl('html', code)).code.html, code);
});

test('template tags match case-insensitively with a valid boundary', () => {
  const upper = '<TEMPLATE\n>a</TEMPLATE\t>';
  assert.equal(parse(meta() + tpl('html', upper)).code.html, upper);
  const slash = '<template/>x</template >';
  assert.equal(parse(meta() + tpl('html', slash)).code.html, slash);
});

test('extra </template> at the end is an error with a line', () => {
  fails(FULL + '</template>\n', /d\.demo\.html:\d+ unexpected text/);
});

test('a missing close names the opening line', () => {
  const text = meta() + '<template data-lang="html">\n<p>x</p>\n';
  const line =
    text.split('\n').findIndex((l) => l.startsWith('<template data-lang')) + 1;
  fails(text, new RegExp(`:${line} unclosed <template>`));
});

test('an unclosed nested template is reported', () => {
  fails(meta() + tpl('html', '<template>x'), /unclosed <template>/);
});

test('meta errors', () => {
  const js = tpl('js', 'x');
  fails(meta({ color: 1 }) + js, /unknown key "color"/);
  fails(meta({ features: [] }) + js, /features/);
  fails(meta({ runsIn: 'tab' }) + js, /runsIn/);
  fails(meta({ permissions: ['telepathy'] }) + js, /telepathy/);
  fails(meta({ title: '' }) + js, /title/);
  fails(meta({ title: 3 }) + js, /title/);
  fails(meta({ a11y: '' }) + js, /a11y/);
  fails(meta({ detect: 'a\nb' }) + js, /detect/);
  fails(meta({ detect: 'x'.repeat(201) }) + js, /detect/);
  fails(meta({ permissions: 'camera' }) + js, /permissions/);
  fails(meta({ features: 'html.a' }) + js, /features/);
});

test('missing meta keys are errors', () => {
  const body = { ...META };
  delete body.fallback;
  const text =
    `${SCRIPT_OPEN}${JSON.stringify(body)}</script>` + tpl('js', 'x');
  fails(text, /missing key "fallback"/);
});

test('feature key rules', () => {
  const js = tpl('js', 'x');
  const bad = (key) => fails(meta({ features: [key] }) + js, /feature/);
  bad('html');
  bad('html..a');
  bad('html.a b');
  bad('nope.a');
  bad('');
  bad(3);
  fails(meta({ features: ['html.a', 'html.a'] }) + js, /duplicate feature/);
});

test('structure errors', () => {
  fails('', /meta/);
  fails('<script>x</script>', /meta/);
  fails(`${SCRIPT_OPEN}{}`, /unclosed <script>/);
  fails(`${SCRIPT_OPEN}{</script>`, /JSON/);
  fails(`${SCRIPT_OPEN}[]</script>`, /object/);
  fails(meta(), /template/);
  fails(meta() + tpl('js', 'a') + tpl('js', 'b'), /duplicate data-lang "js"/);
  fails(meta() + tpl('ts', 'a'), /unknown data-lang "ts"/);
  fails(meta() + '<template>a</template>', /data-lang/);
  fails(meta() + 'stray' + tpl('js', 'a'), /unexpected text/);
  fails(meta() + tpl('js', 'a') + 'tail', /unexpected text/);
});
