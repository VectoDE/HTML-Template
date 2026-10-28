import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { logRange, notesBase } from '../../scripts/release/notes.mjs';

const read = (path) =>
  readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
const BASE = '91af7c218c9220bf5c252fa4bca1888d9997315b';

test('release-stages.json names the last commit before the rebuild', () => {
  const config = JSON.parse(read('.github/release-stages.json'));
  assert.equal(config.notesBase, BASE);
  assert.equal(notesBase(config), BASE);
});

test('notesBase accepts only a full commit sha', () => {
  assert.equal(notesBase({}), null);
  assert.equal(notesBase(null), null);
  for (const bad of ['91af7c2', 'HEAD', `--${BASE.slice(2)}`, 42]) {
    assert.throws(() => notesBase({ notesBase: bad }), /notesBase/, bad);
  }
});

test('logRange starts the first release at the notes base', () => {
  assert.equal(logRange([], 'v1.0.0-alpha.1', BASE), `${BASE}..v1.0.0-alpha.1`);
  assert.equal(logRange([], 'v1.0.0-alpha.1', null), 'v1.0.0-alpha.1');
});

test('logRange prefers the previous tag over the notes base', () => {
  const tags = ['v1.0.0-alpha.1', 'v1.0.0-alpha.2'];
  assert.equal(
    logRange(tags, 'v1.0.0-alpha.2', BASE),
    'v1.0.0-alpha.1..v1.0.0-alpha.2',
  );
});

test('release.yml accepts an owner re-run of a bot-started release', () => {
  const text = read('.github/workflows/release.yml');
  assert.match(
    text,
    /\[ "\$ACTOR" = "\$bot" \] && \[ "\$TRIGGERING_ACTOR" = "\$OWNER" \] && \[ "\$EVENT" = "workflow_dispatch" \]/,
  );
  assert.match(
    text,
    /\[ "\$ACTOR" = "\$bot" \] && \[ "\$TRIGGERING_ACTOR" = "\$bot" \] && \[ "\$EVENT" = "workflow_dispatch" \]/,
  );
});

test('release.yml stamps package.json and the lockfile into the archive', () => {
  const text = read('.github/workflows/release.yml');
  assert.match(
    text,
    /npm version "\$VERSION" --no-git-tag-version --allow-same-version --ignore-scripts/,
  );
  assert.doesNotMatch(text, /npm pkg set version/);
  assert.match(
    text,
    /cp package\.json package-lock\.json "\$stage\/\$\{name\}\/"/,
  );
});

test('tag.yml filters closed issues at the job level', () => {
  const text = read('.github/workflows/tag.yml');
  assert.match(
    text,
    /^ {4}if: github\.event\.issue\.state_reason == 'completed' && github\.event\.issue\.user\.login == github\.repository_owner$/m,
  );
});

test('tag.yml skips a main commit that already has a v* tag', () => {
  const text = read('.github/workflows/tag.yml');
  const points = text.indexOf(`git tag --points-at "$sha" --list 'v*'`);
  assert.notEqual(points, -1);
  assert.ok(points < text.indexOf('node scripts/release/next.mjs'));
});
