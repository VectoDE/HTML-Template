import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isAbsolute } from 'node:path';
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

test('gitExecutable resolves to an existing file', async () => {
  const { gitExecutable } = await import('../../scripts/policy/git.mjs');
  const { existsSync } = await import('node:fs');
  assert.ok(existsSync(gitExecutable()));
});

test('resolveGit skips relative PATH entries', async () => {
  const { resolveGit } = await import('../../scripts/policy/git.mjs');
  const seen = [];
  const found = resolveGit({
    platform: 'linux',
    pathEnv: ['.', 'bin', '', '/opt/tools'].join(':'),
    separator: ':',
    exists: (p) => {
      seen.push(p);
      return false;
    },
  });
  assert.equal(found, null);
  assert.ok(seen.every((p) => isAbsolute(p)));
  assert.ok(seen.some((p) => p.includes('opt') && p.includes('tools')));
});

test('resolveGit uses well-formed Windows paths only on win32', async () => {
  const { resolveGit } = await import('../../scripts/policy/git.mjs');
  const win = [];
  resolveGit({
    platform: 'win32',
    pathEnv: '',
    exists: (p) => (win.push(p), false),
  });
  assert.ok(win.some((p) => p.includes('Program Files') && p.includes('Git')));
  assert.ok(win.every((p) => p.endsWith('git.exe')));
  assert.ok(win.every((p) => !p.includes('C:Program') && p.startsWith('C:')));
  const posix = [];
  resolveGit({
    platform: 'linux',
    pathEnv: '',
    exists: (p) => (posix.push(p), false),
  });
  assert.ok(posix.every((p) => !p.includes('Program Files')));
});
