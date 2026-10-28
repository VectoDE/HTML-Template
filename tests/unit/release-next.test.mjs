import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  bump,
  compareSemver,
  nextVersion,
} from '../../scripts/release/next.mjs';

test('nextVersion starts the alpha channel at 1.0.0-alpha.1', () => {
  assert.equal(nextVersion({ tags: [], channel: 'alpha' }), '1.0.0-alpha.1');
});

test('nextVersion orders prerelease numbers numerically', () => {
  const tags = ['v1.0.0-alpha.1', 'v1.0.0-alpha.10', 'v1.0.0-alpha.2'];
  assert.equal(nextVersion({ tags, channel: 'alpha' }), '1.0.0-alpha.11');
});

test('nextVersion moves from alpha to beta.1', () => {
  const tags = ['v1.0.0-alpha.1', 'v1.0.0-alpha.2', 'v1.0.0-alpha.3'];
  assert.equal(nextVersion({ tags, channel: 'beta' }), '1.0.0-beta.1');
});

test('nextVersion counts up within beta', () => {
  const tags = ['v1.0.0-alpha.3', 'v1.0.0-beta.1'];
  assert.equal(nextVersion({ tags, channel: 'beta' }), '1.0.0-beta.2');
});

test('nextVersion refuses alpha after beta', () => {
  const tags = ['v1.0.0-alpha.3', 'v1.0.0-beta.1'];
  assert.throws(() => nextVersion({ tags, channel: 'alpha' }), /backwards/);
});

test('nextVersion moves from beta to 1.0.0', () => {
  const tags = ['v1.0.0-beta.1', 'v1.0.0-beta.2'];
  assert.equal(nextVersion({ tags, channel: 'final' }), '1.0.0');
});

test('nextVersion refuses every channel after 1.0.0', () => {
  for (const channel of ['alpha', 'beta', 'final']) {
    assert.throws(
      () => nextVersion({ tags: ['v1.0.0-beta.2', 'v1.0.0'], channel }),
      /backwards|1\.0\.0/,
      channel,
    );
  }
});

test('nextVersion ignores tags that are not v plus semver', () => {
  const tags = ['1.0', 'latest', 'v1.0', 'v1.0.0-beta.x.', '1.0.0-beta.4'];
  assert.equal(nextVersion({ tags, channel: 'alpha' }), '1.0.0-alpha.1');
});

test('nextVersion rejects an unknown channel and bad input', () => {
  assert.throws(() => nextVersion({ tags: [], channel: 'rc' }), /channel/);
  assert.throws(
    () => nextVersion({ tags: 'v1.0.0', channel: 'alpha' }),
    /tags/,
  );
});

test('nextVersion refuses a prerelease line it does not know', () => {
  assert.throws(
    () => nextVersion({ tags: ['v1.0.0-rc.1'], channel: 'final' }),
    /rc\.1/,
  );
});

test('compareSemver follows semver precedence', () => {
  const sorted = [
    '1.0.0',
    '1.0.0-alpha.10',
    '1.0.0-beta.1',
    '1.0.0-alpha.2',
    '1.0.0-alpha',
    '0.9.0',
    '1.0.0-alpha.beta',
    '1.0.0-beta.11',
  ].sort(compareSemver);
  assert.deepEqual(sorted, [
    '0.9.0',
    '1.0.0-alpha',
    '1.0.0-alpha.2',
    '1.0.0-alpha.10',
    '1.0.0-alpha.beta',
    '1.0.0-beta.1',
    '1.0.0-beta.11',
    '1.0.0',
  ]);
  assert.equal(compareSemver('1.0.0+build.1', '1.0.0'), 0);
});

test('bump returns minor for a feature', () => {
  assert.equal(bump('1.2.3', ['feat: add a demo', 'docs: typo']), '1.3.0');
});

test('bump returns patch for a fix', () => {
  assert.equal(bump('1.2.3', ['fix(nav): close the menu']), '1.2.4');
});

test('bump returns patch for perf', () => {
  assert.equal(bump('1.2.3', ['perf: cache the index']), '1.2.4');
});

test('bump returns major for a bang after the type', () => {
  assert.equal(bump('1.2.3', ['feat!: drop old URLs']), '2.0.0');
  assert.equal(bump('1.2.3', ['fix(api)!: rename a field']), '2.0.0');
});

test('bump returns major for a BREAKING CHANGE footer', () => {
  const message = 'feat: new layout\n\nBREAKING CHANGE: old anchors are gone';
  assert.equal(bump('1.2.3', [message]), '2.0.0');
});

test('bump returns null when only docs and chores changed', () => {
  assert.equal(bump('1.2.3', ['docs: fix a link', 'chore: tidy']), null);
  assert.equal(bump('1.2.3', []), null);
});

test('bump rejects a version that is not semver', () => {
  assert.throws(() => bump('1.2', ['fix: x']), /semver/);
});
