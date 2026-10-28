import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import {
  REQUIRED_WORKFLOWS,
  channelFor,
  failingWorkflows,
} from '../../scripts/release/guards.mjs';
import { checkWorkflow } from '../../scripts/policy/workflows.mjs';

const stages = JSON.parse(
  readFileSync(new URL('../../.github/release-stages.json', import.meta.url)),
);

const HEAD = 'c0ffee0000000000000000000000000000000000';
const CI = '.github/workflows/ci.yml';
const CODEQL = '.github/workflows/codeql.yml';

let nextId = 1;
const wfRun = (path, conclusion, overrides = {}) => ({
  id: nextId++,
  name: path.slice(path.lastIndexOf('/') + 1, -4),
  path,
  head_sha: HEAD,
  head_branch: 'main',
  event: 'push',
  status: conclusion === null ? 'in_progress' : 'completed',
  conclusion,
  created_at: '2026-10-28T10:00:00Z',
  ...overrides,
});
const page = (...runs) => [{ total_count: runs.length, workflow_runs: runs }];

test('release-stages.json maps the stage issues to their channels', () => {
  for (const n of [2, 3, 4, 5, 6, 9, 10, 11, 12, 13, 14]) {
    assert.equal(channelFor(stages, n), 'alpha', `#${n}`);
  }
  assert.equal(channelFor(stages, 7), 'beta');
  assert.equal(channelFor(stages, 8), 'final');
});

test('channelFor returns null for other issues and bad input', () => {
  assert.equal(channelFor(stages, 1), null);
  assert.equal(channelFor(stages, '15'), null);
  assert.equal(channelFor(stages, 'abc'), null);
  assert.equal(channelFor(stages, '__proto__'), null);
});

test('channelFor accepts the number as a string', () => {
  assert.equal(channelFor(stages, '7'), 'beta');
});

test('channelFor rejects an unknown channel in the config', () => {
  assert.throws(() => channelFor({ issues: { 3: 'rc' } }, 3), /channel/);
});

test('REQUIRED_WORKFLOWS names ci.yml and codeql.yml', () => {
  assert.deepEqual(REQUIRED_WORKFLOWS, [CI, CODEQL]);
});

test('failingWorkflows passes when ci and codeql succeeded on main', () => {
  const pages = [
    ...page(wfRun(CI, 'success')),
    ...page(wfRun(CODEQL, 'success')),
  ];
  assert.deepEqual(failingWorkflows(pages, HEAD), []);
});

test('failingWorkflows reports a failing CI run', () => {
  const pages = page(wfRun(CI, 'failure'), wfRun(CODEQL, 'success'));
  assert.deepEqual(failingWorkflows(pages, HEAD), [CI]);
});

test('failingWorkflows reports a run that has not finished', () => {
  const pages = page(wfRun(CI, null), wfRun(CODEQL, 'success'));
  assert.deepEqual(failingWorkflows(pages, HEAD), [CI]);
});

test('failingWorkflows ignores a success from another workflow path', () => {
  // Same name and job names as ci.yml, but defined in a different file.
  const copy = wfRun('.github/workflows/ci-copy.yml', 'success', {
    name: 'ci',
  });
  const pages = page(copy, wfRun(CODEQL, 'success'));
  assert.deepEqual(failingWorkflows(pages, HEAD), [CI]);
});

test('failingWorkflows ignores a push run on another branch', () => {
  const pages = page(
    wfRun(CI, 'success', { head_branch: 'feature' }),
    wfRun(CODEQL, 'success'),
  );
  assert.deepEqual(failingWorkflows(pages, HEAD), [CI]);
});

test('failingWorkflows ignores other events and other commits', () => {
  const pages = page(
    wfRun(CI, 'success', { event: 'pull_request' }),
    wfRun(CODEQL, 'success', { head_sha: 'f'.repeat(40) }),
  );
  assert.deepEqual(failingWorkflows(pages, HEAD), [CI, CODEQL]);
});

test('failingWorkflows uses the newest run of each workflow', () => {
  const failedThenFixed = page(
    wfRun(CI, 'failure', { created_at: '2026-10-28T09:00:00Z' }),
    wfRun(CI, 'success', { created_at: '2026-10-28T09:30:00Z' }),
    wfRun(CODEQL, 'success'),
  );
  assert.deepEqual(failingWorkflows(failedThenFixed, HEAD), []);
  const fixedThenFailed = page(
    wfRun(CI, 'failure', { created_at: '2026-10-28T09:30:00Z' }),
    wfRun(CI, 'success', { created_at: '2026-10-28T09:00:00Z' }),
    wfRun(CODEQL, 'success'),
  );
  assert.deepEqual(failingWorkflows(fixedThenFailed, HEAD), [CI]);
});

test('failingWorkflows treats unreadable input as nothing passed', () => {
  assert.deepEqual(failingWorkflows(null, HEAD), REQUIRED_WORKFLOWS);
  assert.deepEqual(failingWorkflows({}, HEAD), REQUIRED_WORKFLOWS);
});

test('failingWorkflows needs the head commit', () => {
  const pages = page(wfRun(CI, 'success'), wfRun(CODEQL, 'success'));
  assert.throws(() => failingWorkflows(pages), /sha/);
});

test('release.yml lets only the owner or the tag workflow release', () => {
  const text = readFileSync(
    new URL('../../.github/workflows/release.yml', import.meta.url),
    'utf8',
  );
  const guard = text.indexOf('- name: Verify who started the release');
  assert.notEqual(guard, -1);
  assert.ok(
    guard < text.indexOf('- uses: actions/checkout'),
    'guard runs first',
  );
  assert.match(text, /ACTOR: \$\{\{ github\.actor \}\}/);
  assert.match(text, /TRIGGERING_ACTOR: \$\{\{ github\.triggering_actor \}\}/);
  assert.match(text, /OWNER: \$\{\{ github\.repository_owner \}\}/);
  assert.match(text, /EVENT: \$\{\{ github\.event_name \}\}/);
  assert.match(text, /if: startsWith\(github\.ref, 'refs\/tags\/v'\)/);
  assert.match(
    text,
    /git merge-base --is-ancestor "\$GITHUB_SHA" origin\/main/,
  );
});

test('tag.yml and release.yml pass the workflow policy', () => {
  for (const name of ['tag.yml', 'release.yml']) {
    const file = `.github/workflows/${name}`;
    const text = readFileSync(
      new URL(`../../${file}`, import.meta.url),
      'utf8',
    );
    assert.deepEqual(checkWorkflow(text, file), [], name);
  }
});

test('tag.yml keeps expressions out of run blocks', () => {
  const text = readFileSync(
    new URL('../../.github/workflows/tag.yml', import.meta.url),
    'utf8',
  );
  const lines = text.split('\n');
  let inRun = false;
  let runIndent = 0;
  lines.forEach((line, index) => {
    const indent = line.length - line.trimStart().length;
    const body = line.trimStart();
    if (inRun && body !== '' && indent <= runIndent) inRun = false;
    if (body.startsWith('run:') || body.startsWith('- run:')) {
      inRun = true;
      runIndent = indent;
    }
    if (inRun) {
      assert.ok(!line.includes('${{'), `tag.yml:${index + 1} ${line}`);
    }
  });
});

test('tag.yml grants only the job permissions it needs', () => {
  const text = readFileSync(
    new URL('../../.github/workflows/tag.yml', import.meta.url),
    'utf8',
  );
  assert.match(text, /^permissions: \{\}$/m);
  assert.match(text, /^ {2}group: release-tag$/m);
  assert.match(text, /^ {2}cancel-in-progress: false$/m);
  assert.match(text, /persist-credentials: false/);
  const lines = text.split('\n');
  const start = lines.indexOf('    permissions:');
  assert.notEqual(start, -1);
  const granted = [];
  for (const line of lines.slice(start + 1)) {
    if (!line.startsWith('      ') || line.trimStart().startsWith('-')) break;
    granted.push(line.trim());
  }
  assert.deepEqual(granted, [
    'contents: write',
    'actions: write',
    'issues: write',
  ]);
});
