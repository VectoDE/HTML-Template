import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findAttribution } from '../../scripts/policy/attribution.mjs';

test('detects Co-Authored-By trailer with correct line', () => {
  const r = findAttribution(
    'subject\n\nCo-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>\n',
  );
  assert.ok(r.length >= 1);
  assert.equal(r[0].line, 3);
});

test('detects robot line with Markdown link', () => {
  const r = findAttribution(
    'x\n🤖 Generated with [Claude Code](https://claude.com/claude-code)',
  );
  assert.ok(r.length >= 1);
  assert.ok(r.every((f) => f.line === 2));
});

test('detects plain lowercase variant', () => {
  const r = findAttribution('generated with claude code');
  assert.ok(r.length >= 1);
  assert.equal(r[0].line, 1);
});

test('detects uppercase variants', () => {
  assert.ok(findAttribution('CO-AUTHORED-BY: CLAUDE').length >= 1);
  assert.ok(findAttribution('GENERATED WITH CLAUDE CODE').length >= 1);
  assert.ok(findAttribution('NOREPLY@ANTHROPIC.COM').length >= 1);
});

test('detects Markdown link variant', () => {
  assert.ok(
    findAttribution('see [Claude Code](https://claude.com/claude-code)')
      .length >= 1,
  );
  assert.ok(findAttribution('Generated with [Claude Code](x)').length >= 1);
});

test('ignores human co-authors and unrelated mentions', () => {
  assert.deepEqual(
    findAttribution('Co-Authored-By: Jane Doe <jane@example.org>'),
    [],
  );
  assert.deepEqual(findAttribution('Claude Monet painted water lilies'), []);
});

const signed = {
  sha: 'abcdef1234567890',
  authorName: 'Jane Doe',
  authorEmail: 'jane@example.com',
  parents: 1,
};

test('commit message check flags a trailer with the short sha', async () => {
  const { checkCommitAttribution } =
    await import('../../scripts/policy/dco.mjs');
  const errors = checkCommitAttribution([
    {
      ...signed,
      message:
        'feat: x\n\nSigned-off-by: Jane Doe <jane@example.com>\nCo-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>\n',
    },
  ]);
  assert.ok(errors.length >= 1);
  assert.ok(
    errors.every((e) => e.startsWith('abcdef1: forbidden attribution text')),
  );
  assert.ok(errors.every((e) => e.endsWith('message line 4')));
});

test('commit message check passes a clean commit', async () => {
  const { checkCommitAttribution } =
    await import('../../scripts/policy/dco.mjs');
  assert.deepEqual(
    checkCommitAttribution([
      {
        ...signed,
        message: 'feat: x\n\nSigned-off-by: Jane Doe <jane@example.com>\n',
      },
    ]),
    [],
  );
});

test('verifyCommits reports both sign-off and attribution problems', async () => {
  const { verifyCommits } = await import('../../scripts/policy/dco.mjs');
  const errors = verifyCommits([
    { ...signed, message: 'x\n\n🤖 Generated with [Claude Code](x)\n' },
  ]);
  assert.ok(errors.some((e) => e.includes('missing Signed-off-by')));
  assert.ok(errors.some((e) => e.includes('forbidden attribution text')));
});

test('pull request text check flags title and body separately', async () => {
  const { checkPullRequestText } =
    await import('../../scripts/policy/attribution-cli.mjs');
  const errors = checkPullRequestText({
    title: 'feat: add things',
    body: 'Summary\n\nGenerated with [Claude Code](https://claude.com/claude-code)\n',
  });
  assert.ok(errors.length >= 1);
  assert.ok(errors.every((e) => e.startsWith('pull request body:3')));
  assert.equal(
    checkPullRequestText({ title: 'Co-Authored-By: Claude', body: '' })[0]
      .split(' ')
      .slice(0, 3)
      .join(' '),
    'pull request title:1',
  );
});

test('pull request text check passes clean text and missing body', async () => {
  const { checkPullRequestText } =
    await import('../../scripts/policy/attribution-cli.mjs');
  assert.deepEqual(checkPullRequestText({ title: 'fix: y', body: '' }), []);
  assert.deepEqual(checkPullRequestText({ title: 'fix: y' }), []);
});

test('attribution CLI exits 1 on a forbidden PR body and 0 on clean text', async () => {
  const { spawnSync } = await import('node:child_process');
  const { fileURLToPath } = await import('node:url');
  const cli = fileURLToPath(
    new URL('../../scripts/policy/attribution-cli.mjs', import.meta.url),
  );
  const bad = spawnSync(process.execPath, [cli], {
    env: { PR_TITLE: 'fix: y', PR_BODY: 'x\nnoreply@anthropic.com\n' },
    encoding: 'utf8',
  });
  assert.equal(bad.status, 1);
  assert.match(bad.stderr, /pull request body:2/);
  const good = spawnSync(process.execPath, [cli], {
    env: { PR_TITLE: 'fix: y', PR_BODY: 'plain text' },
    encoding: 'utf8',
  });
  assert.equal(good.status, 0);
});
