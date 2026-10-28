import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseReleaseTag } from '../../scripts/release/version.mjs';
import {
  logRange,
  parseCommitLog,
  renderNotes,
} from '../../scripts/release/notes.mjs';

test('parseReleaseTag accepts a prerelease tag', () => {
  assert.deepEqual(parseReleaseTag('v1.0.0-alpha.1'), {
    version: '1.0.0-alpha.1',
    prerelease: true,
  });
});

test('parseReleaseTag accepts a stable tag', () => {
  assert.deepEqual(parseReleaseTag('v1.0.0'), {
    version: '1.0.0',
    prerelease: false,
  });
});

test('parseReleaseTag needs no package.json version', () => {
  assert.equal(
    parseReleaseTag('v1.0.0-beta.3', undefined).version,
    '1.0.0-beta.3',
  );
});

test('parseReleaseTag rejects a tag without v prefix', () => {
  assert.throws(() => parseReleaseTag('1.0.0-alpha.1'), /tag/);
});

test('parseReleaseTag rejects a non-semver tag', () => {
  for (const tag of ['v1.0', 'v01.0.0', 'v1.0.0-', 'v1.0.0-alpha..1', 'v']) {
    assert.throws(() => parseReleaseTag(tag), /tag/, tag);
  }
});

test('parseReleaseTag rejects a missing tag', () => {
  assert.throws(() => parseReleaseTag(undefined), /tag/);
});

test('parseReleaseTag treats a dash in build metadata as stable', () => {
  assert.deepEqual(parseReleaseTag('v1.0.0+build-1'), {
    version: '1.0.0+build-1',
    prerelease: false,
  });
});

test('parseReleaseTag keeps prerelease true when build metadata follows', () => {
  assert.equal(parseReleaseTag('v1.0.0-rc.1+build-1').prerelease, true);
});

test('parseReleaseTag rejects empty build identifiers', () => {
  for (const tag of ['v1.0.0+', 'v1.0.0+a..b', 'v1.0.0+.a', 'v1.0.0+a.']) {
    assert.throws(() => parseReleaseTag(tag), /semver/, tag);
  }
});

test('parseReleaseTag rejects invalid build characters', () => {
  assert.throws(() => parseReleaseTag('v1.0.0+a_b'), /semver/);
});

test('logRange starts at the previous tag in semver order', () => {
  const tags = ['v1.0.0-alpha.1', 'v1.0.0-alpha.10', 'v1.0.0-alpha.2'];
  assert.equal(
    logRange(tags, 'v1.0.0-alpha.10'),
    'v1.0.0-alpha.2..v1.0.0-alpha.10',
  );
  assert.equal(
    logRange(tags, 'v1.0.0-alpha.2'),
    'v1.0.0-alpha.1..v1.0.0-alpha.2',
  );
});

test('logRange ignores newer and unrelated tags', () => {
  const tags = ['latest', 'v1.0', 'v1.0.0-alpha.1', 'v1.0.0-alpha.2'];
  assert.equal(logRange(tags, 'v1.0.0-alpha.1'), 'v1.0.0-alpha.1');
});

test('logRange goes back to the root for the first tag', () => {
  assert.equal(logRange([], 'v1.0.0-alpha.1'), 'v1.0.0-alpha.1');
});

test('parseCommitLog splits git log records', () => {
  const output =
    'aaaaaaaaaa\x1ffeat: one\n\nbody\x1e\nbbbbbbbbbb\x1ffix: two\x1e\n';
  assert.deepEqual(parseCommitLog(output), [
    { sha: 'aaaaaaaaaa', message: 'feat: one\n\nbody' },
    { sha: 'bbbbbbbbbb', message: 'fix: two' },
  ]);
});

test('renderNotes groups commits into Features, Fixes and Other', () => {
  const commits = [
    { sha: '1111111aaaa', message: 'feat(nav): add a search box' },
    { sha: '2222222bbbb', message: 'fix: close the menu on Escape' },
    { sha: '3333333cccc', message: 'docs: describe the release flow' },
    { sha: '4444444dddd', message: 'perf: cache the index' },
    { sha: '5555555eeee', message: 'Update README' },
    { sha: '6666666ffff', message: 'feat!: drop the old URLs' },
  ];
  assert.equal(
    renderNotes(commits),
    [
      '## Features',
      '',
      '- nav: add a search box (1111111)',
      '- **Breaking:** drop the old URLs (6666666)',
      '',
      '## Fixes',
      '',
      '- close the menu on Escape (2222222)',
      '- cache the index (4444444)',
      '',
      '## Other',
      '',
      '- docs: describe the release flow (3333333)',
      '- Update README (5555555)',
    ].join('\n'),
  );
});

test('renderNotes leaves out empty groups', () => {
  assert.equal(
    renderNotes([{ sha: 'abcdef12345', message: 'fix: one' }]),
    '## Fixes\n\n- one (abcdef1)',
  );
});

test('renderNotes marks a BREAKING CHANGE footer', () => {
  const commits = [
    { sha: 'abcdef12345', message: 'fix: rename\n\nBREAKING CHANGE: ids' },
  ];
  assert.equal(
    renderNotes(commits),
    '## Fixes\n\n- **Breaking:** rename (abcdef1)',
  );
});

test('renderNotes prints "No changes." for an empty range', () => {
  assert.equal(renderNotes([]), 'No changes.');
});
