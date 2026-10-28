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

test('repository .gitattributes marks common binary formats', async () => {
  const { readFileSync } = await import('node:fs');
  const attrs = readFileSync(
    new URL('../../.gitattributes', import.meta.url),
    'utf8',
  );
  const binary = [
    'woff2',
    'png',
    'ico',
    'jpg',
    'jpeg',
    'webp',
    'avif',
    'gif',
    'svgz',
    'woff',
    'ttf',
    'otf',
    'pdf',
    'mp4',
    'webm',
    'mp3',
    'ogg',
    'wav',
    'wasm',
    'zip',
    'gz',
  ];
  for (const ext of binary) {
    assert.equal(isBinaryPath(`assets/x.${ext}`, attrs), true, ext);
  }
  assert.equal(isBinaryPath('src/a.svg', attrs), false);
  assert.equal(isBinaryPath('src/a.js', attrs), false);
});

test('listTrackedTextFiles skips paths marked binary', async () => {
  const { listTrackedTextFiles } =
    await import('../../scripts/policy/files.mjs');
  const files = listTrackedTextFiles({
    listFiles: () => 'README.md\0assets/a.jpg\0media/b.mp4\0src/c.js\0',
    readAttributes: () => '* text=auto eol=lf\n*.jpg binary\n*.mp4 binary\n',
  });
  assert.deepEqual(files, ['README.md', 'src/c.js']);
});

test('globstar patterns match nested paths', () => {
  const attrs = 'fixtures/**/*.bin binary\n';
  assert.equal(isBinaryPath('fixtures/a/b/c.bin', attrs), true);
  assert.equal(isBinaryPath('other/c.bin', attrs), false);
});
