import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseReleaseTag } from '../../scripts/release/version.mjs';
import {
  extractNotes,
  assertReleaseDate,
} from '../../scripts/release/notes.mjs';

const CHANGELOG = `# Changelog

## [Unreleased]

## [1.0.0-alpha.2] - 2026-11-01

### Added

- Second thing.

## [1.0.0-alpha.1] - 2026-10-30

### Added

- First thing.

## [0.9.0] - 2026-01-01
`;

test('parseReleaseTag accepts a prerelease tag', () => {
  assert.deepEqual(parseReleaseTag('v1.0.0-alpha.1', '1.0.0-alpha.1'), {
    version: '1.0.0-alpha.1',
    prerelease: true,
  });
});

test('parseReleaseTag accepts a stable tag', () => {
  assert.deepEqual(parseReleaseTag('v1.0.0', '1.0.0'), {
    version: '1.0.0',
    prerelease: false,
  });
});

test('parseReleaseTag rejects a tag without v prefix', () => {
  assert.throws(() => parseReleaseTag('1.0.0-alpha.1', '1.0.0-alpha.1'), /tag/);
});

test('parseReleaseTag rejects a non-semver tag', () => {
  assert.throws(() => parseReleaseTag('v1.0', '1.0'), /tag/);
});

test('parseReleaseTag rejects a version differing from package.json', () => {
  assert.throws(
    () => parseReleaseTag('v1.0.0-alpha.2', '1.0.0-alpha.1'),
    /package\.json/,
  );
});

test('extractNotes returns only the requested section', () => {
  const notes = extractNotes(CHANGELOG, '1.0.0-alpha.1');
  assert.equal(notes, '### Added\n\n- First thing.');
});

test('extractNotes accepts a placeholder date', () => {
  const log = '## [1.0.0] - YYYY-MM-DD\n\n- Thing.\n';
  assert.equal(extractNotes(log, '1.0.0'), '- Thing.');
});

test('extractNotes throws for a missing section', () => {
  assert.throws(
    () => extractNotes(CHANGELOG, '1.0.0-alpha.9'),
    /1\.0\.0-alpha\.9/,
  );
});

test('extractNotes throws for an empty section', () => {
  const log = '## [1.0.0] - 2026-01-01\n\n## [0.9.0] - 2025-01-01\n\n- x\n';
  assert.throws(() => extractNotes(log, '1.0.0'), /empty/);
});

test('assertReleaseDate accepts a real ISO date', () => {
  assert.doesNotThrow(() => assertReleaseDate(CHANGELOG, '1.0.0-alpha.1'));
});

test('assertReleaseDate rejects the placeholder date', () => {
  const log = '## [1.0.0] - YYYY-MM-DD\n\n- Thing.\n';
  assert.throws(() => assertReleaseDate(log, '1.0.0'), /date/);
});

test('assertReleaseDate rejects an impossible date', () => {
  const log = '## [1.0.0] - 2026-13-45\n\n- Thing.\n';
  assert.throws(() => assertReleaseDate(log, '1.0.0'), /date/);
});
