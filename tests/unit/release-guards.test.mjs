import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import {
  REQUIRED_CHECKS,
  channelFor,
  missingChecks,
} from '../../scripts/release/guards.mjs';
import { checkWorkflow } from '../../scripts/policy/workflows.mjs';

const stages = JSON.parse(
  readFileSync(new URL('../../.github/release-stages.json', import.meta.url)),
);

const run = (name, conclusion, startedAt = '2026-10-28T10:00:00Z') => ({
  name,
  conclusion,
  started_at: startedAt,
});

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

test('missingChecks is empty when every required check succeeded', () => {
  const pages = [
    { check_runs: REQUIRED_CHECKS.slice(0, 2).map((n) => run(n, 'success')) },
    { check_runs: REQUIRED_CHECKS.slice(2).map((n) => run(n, 'success')) },
  ];
  assert.deepEqual(missingChecks(pages), []);
});

test('missingChecks names absent and failed checks', () => {
  const pages = [
    {
      check_runs: [
        run('lint', 'success'),
        run('test', 'failure'),
        run('actionlint', null),
        run('analyze (actions)', 'success'),
      ],
    },
  ];
  assert.deepEqual(missingChecks(pages), [
    'test',
    'actionlint',
    'analyze (javascript-typescript)',
  ]);
});

test('missingChecks uses the latest run of a check', () => {
  const others = REQUIRED_CHECKS.slice(1).map((n) => run(n, 'success'));
  const failedThenFixed = [
    run('lint', 'failure', '2026-10-28T09:00:00Z'),
    run('lint', 'success', '2026-10-28T09:30:00Z'),
  ];
  assert.deepEqual(
    missingChecks([{ check_runs: [...failedThenFixed, ...others] }]),
    [],
  );
  const fixedThenFailed = [
    run('lint', 'success', '2026-10-28T09:00:00Z'),
    run('lint', 'failure', '2026-10-28T09:30:00Z'),
  ];
  assert.deepEqual(
    missingChecks([{ check_runs: [...fixedThenFailed, ...others] }]),
    ['lint'],
  );
});

test('missingChecks treats unreadable input as nothing passed', () => {
  assert.deepEqual(missingChecks(null), REQUIRED_CHECKS);
  assert.deepEqual(missingChecks({ check_runs: [] }), REQUIRED_CHECKS);
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
    'checks: read',
  ]);
});
