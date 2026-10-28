import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ALLOWED_TYPES,
  checkPullRequestTitle,
  main,
} from '../../scripts/policy/pr-title.mjs';

test('accepts conventional titles', () => {
  for (const title of [
    'feat: add the build',
    'feat(build)!: change the output layout',
    'chore(deps): bump the compat-data group with 2 updates',
    'chore(deps): bump actions/checkout from 7.0.1 to 7.0.2',
    '  feat: padded  ',
  ]) {
    assert.deepEqual(checkPullRequestTitle(title), [], title);
  }
});

test('rejects titles that are not conventional', () => {
  const stage = checkPullRequestTitle('Stage 2: build pipeline');
  assert.equal(stage.length, 1);
  assert.match(stage[0], /conventional/);
  assert.equal(checkPullRequestTitle('Update README').length, 1);
  assert.equal(checkPullRequestTitle('feat:').length, 1);
  assert.equal(checkPullRequestTitle('').length, 1);
});

test('rejects unknown types and lists the allowed ones', () => {
  const errors = checkPullRequestTitle('wip: try things');
  assert.equal(errors.length, 1);
  assert.match(errors[0], /type "wip"/);
  assert.match(errors[0], /feat/);
  assert.ok(ALLOWED_TYPES.includes('feat'));
});

function run(env) {
  let out = '';
  let err = '';
  const code = main({
    env,
    stdout: { write: (s) => (out += s) },
    stderr: { write: (s) => (err += s) },
  });
  return { code, out, err };
}

test('main reports ok for a valid title', () => {
  const { code, out } = run({ PR_TITLE: 'fix: x' });
  assert.equal(code, 0);
  assert.match(out, /pr-title: ok/);
});

test('main fails with the title quoted', () => {
  const { code, err } = run({ PR_TITLE: 'bad' });
  assert.equal(code, 1);
  assert.match(err, /"bad"/);
});

test('main treats a missing title as empty', () => {
  assert.equal(run({}).code, 1);
});
