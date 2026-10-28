import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { buildCsp, hashInline } from '../../scripts/build/csp.mjs';
import { SITE, absoluteUrl, pageUrl } from '../../scripts/build/config.mjs';

const sha = (text) =>
  'sha256-' + createHash('sha256').update(text).digest('base64');

test('SITE and the URL helpers', () => {
  assert.deepEqual(SITE, {
    origin: 'https://vectode.github.io',
    base: '/HTML-Template/',
    name: 'HTML-Template',
    previewOrigin: 'https://html-template-preview.pages.dev',
  });
  assert.ok(Object.isFrozen(SITE));
  assert.equal(pageUrl('/'), '/HTML-Template/');
  assert.equal(pageUrl('/html/dialog/'), '/HTML-Template/html/dialog/');
  assert.equal(pageUrl('html/dialog/'), '/HTML-Template/html/dialog/');
  assert.equal(pageUrl('\\html\\dialog\\'), '/HTML-Template/html/dialog/');
  assert.equal(
    absoluteUrl('/html/dialog/'),
    'https://vectode.github.io/HTML-Template/html/dialog/',
  );
  const other = { ...SITE, origin: 'https://x.test', base: '/' };
  assert.equal(absoluteUrl('/a/', other), 'https://x.test/a/');
});

test('hashInline hashes inline scripts and styles, skips src scripts', () => {
  const found = hashInline(
    '<script>a()</script><script src="x.js"></script><style>p{}</style>',
  );
  assert.deepEqual(found, { scripts: [sha('a()')], styles: [sha('p{}')] });
});

test('hashInline keeps document order and reads attributes with care', () => {
  const html = [
    '<SCRIPT type="module">b()</SCRIPT>',
    '<script data-x="a src=b">c()</script>',
    "<script data-y='>'>d()</script>",
    '<script\nsrc=y.js></script>',
    '<scripts>no</scripts><styles>no</styles>',
    '<style media="print">q{}</style>',
    '<script async src></script>',
  ].join('\n');
  assert.deepEqual(hashInline(html), {
    scripts: [sha('b()'), sha('c()'), sha('d()')],
    styles: [sha('q{}')],
  });
});

test('hashInline ignores unclosed tags and finds nothing in plain text', () => {
  assert.deepEqual(hashInline('<p>no code</p>'), { scripts: [], styles: [] });
  assert.deepEqual(hashInline('<script>a()'), { scripts: [], styles: [] });
  assert.deepEqual(hashInline('<script'), { scripts: [], styles: [] });
  assert.deepEqual(hashInline('<style x="'), { scripts: [], styles: [] });
});

test('buildCsp without hashes is strict and frames only the preview', () => {
  const csp = buildCsp({ previewOrigin: 'https://p.example' });
  assert.equal(
    csp,
    "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-src https://p.example; manifest-src 'self'; worker-src 'self'; base-uri 'none'; form-action 'none'; object-src 'none'",
  );
  assert.ok(csp.includes('frame-src https://p.example'));
  assert.ok(csp.includes("connect-src 'self'"));
  assert.ok(!csp.includes('unsafe-inline'));
  assert.ok(!csp.includes('unsafe-eval'));
});

test('buildCsp quotes hashes', () => {
  const csp = buildCsp({
    scripts: [sha('a()')],
    styles: [sha('p{}'), sha('q{}')],
    previewOrigin: SITE.previewOrigin,
  });
  assert.ok(csp.includes(`script-src 'self' '${sha('a()')}';`));
  assert.ok(csp.includes(`style-src 'self' '${sha('p{}')}' '${sha('q{}')}';`));
});

test('buildCsp rejects values that could widen the policy', () => {
  for (const previewOrigin of [
    undefined,
    'http://p.example',
    'https://p.example/path',
    'https://p.example; script-src *',
    'https://p .example',
    'https://',
  ]) {
    assert.throws(() => buildCsp({ previewOrigin }), TypeError, previewOrigin);
  }
  for (const bad of [
    "'unsafe-inline'",
    'sha256-a b',
    'sha384-abc',
    'sha256-',
  ]) {
    assert.throws(
      () => buildCsp({ scripts: [bad], previewOrigin: 'https://p.example' }),
      TypeError,
    );
    assert.throws(
      () => buildCsp({ styles: [bad], previewOrigin: 'https://p.example' }),
      TypeError,
    );
  }
});
