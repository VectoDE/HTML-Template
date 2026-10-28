import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  findCrlf,
  isBinaryPath,
  isAttributionExcluded,
  filterAttributionTargets,
} from '../../scripts/policy/files.mjs';

test('findCrlf returns 1-based line numbers', () => {
  assert.deepEqual(findCrlf('a\r\nb\nc\r\n'), [1, 3]);
  assert.deepEqual(findCrlf('a\nb'), []);
});

test('isBinaryPath matches .gitattributes binary patterns', () => {
  const attrs = '* text=auto eol=lf\n*.woff2 binary\n*.png binary\n';
  assert.equal(isBinaryPath('assets/a.png', attrs), true);
  assert.equal(isBinaryPath('fonts/x.woff2', attrs), true);
  assert.equal(isBinaryPath('src/a.js', attrs), false);
});

test('attribution exclusion list holds exactly the two pattern holders', () => {
  assert.equal(isAttributionExcluded('scripts/policy/attribution.mjs'), true);
  assert.equal(
    isAttributionExcluded('tests/unit/policy-attribution.test.mjs'),
    true,
  );
  assert.equal(isAttributionExcluded('scripts/policy/run.mjs'), false);
  assert.equal(isAttributionExcluded('README.md'), false);
});

test('filterAttributionTargets drops excluded files only', () => {
  const files = [
    'README.md',
    'scripts/policy/attribution.mjs',
    'tests/unit/policy-attribution.test.mjs',
  ];
  assert.deepEqual(filterAttributionTargets(files), ['README.md']);
});
