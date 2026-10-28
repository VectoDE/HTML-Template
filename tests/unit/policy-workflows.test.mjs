import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkWorkflow } from '../../scripts/policy/workflows.mjs';

const sha = 'a'.repeat(40);
const wf = (uses, permissions = 'permissions: {}') =>
  `${permissions}\njobs:\n  a:\n    steps:\n      - uses: ${uses}\n`;

test('pinned SHA with comment passes', () => {
  assert.deepEqual(
    checkWorkflow(wf(`actions/checkout@${sha} # v5.0.0`), 'x.yml'),
    [],
  );
});

test('tag ref fails', () => {
  const errors = checkWorkflow(wf('actions/checkout@v5'), 'x.yml');
  assert.equal(errors.length, 1);
  assert.match(errors[0], /x\.yml:5/);
  assert.match(errors[0], /not pinned/);
});

test('short sha fails', () => {
  assert.equal(
    checkWorkflow(wf('actions/checkout@abc1234 # v5'), 'x.yml').length,
    1,
  );
});

test('pinned SHA without version comment fails', () => {
  assert.equal(checkWorkflow(wf(`actions/checkout@${sha}`), 'x.yml').length, 1);
});

test('local and docker refs pass', () => {
  assert.deepEqual(checkWorkflow(wf('./.github/actions/setup'), 'x.yml'), []);
  assert.deepEqual(
    checkWorkflow(
      wf(`docker://rhysd/actionlint@sha256:${'b'.repeat(64)}`),
      'x.yml',
    ),
    [],
  );
});

test('slsa generator by tag passes, other ref fails', () => {
  const p =
    'slsa-framework/slsa-github-generator/.github/workflows/generator_generic_slsa3.yml';
  assert.deepEqual(checkWorkflow(wf(`${p}@v2.1.0`), 'x.yml'), []);
  assert.equal(checkWorkflow(wf(`${p}@main`), 'x.yml').length, 1);
});

test('missing top-level permissions fails', () => {
  const text = `jobs:\n  a:\n    steps:\n      - uses: actions/checkout@${sha} # v5\n`;
  assert.equal(checkWorkflow(text, 'x.yml').length, 1);
});

test('top-level write fails', () => {
  const text = wf(
    `actions/checkout@${sha} # v5`,
    'permissions:\n  contents: write',
  );
  assert.equal(checkWorkflow(text, 'x.yml').length, 1);
});

test('top-level read block, read-all and {} pass', () => {
  const u = `actions/checkout@${sha} # v5`;
  assert.deepEqual(
    checkWorkflow(
      wf(u, 'permissions:\n  contents: read\n  id-token: none'),
      'x.yml',
    ),
    [],
  );
  assert.deepEqual(checkWorkflow(wf(u, 'permissions: read-all'), 'x.yml'), []);
});

test('write-all fails', () => {
  const text = wf(`actions/checkout@${sha} # v5`, 'permissions: write-all');
  assert.equal(checkWorkflow(text, 'x.yml').length, 1);
});

test('job-level write passes when top-level is {}', () => {
  const text = `permissions: {}\njobs:\n  a:\n    permissions:\n      contents: write\n    steps:\n      - uses: actions/checkout@${sha} # v5\n`;
  assert.deepEqual(checkWorkflow(text, 'x.yml'), []);
});
