import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkDco } from '../../scripts/policy/dco.mjs';

const human = {
  sha: 'abcdef1234567890',
  authorName: 'Jane Doe',
  authorEmail: 'jane@example.com',
  message: 'feat: x\n\nSigned-off-by: Jane Doe <jane@example.com>\n',
  parents: 1,
};

test('signed human passes', () => {
  assert.deepEqual(checkDco([human]), []);
});

test('signed human passes with different email case and trailing space', () => {
  const c = {
    ...human,
    message: 'x\n\nSigned-off-by: Jane Doe <JANE@Example.com>  \n',
  };
  assert.deepEqual(checkDco([c]), []);
});

test('unsigned human fails', () => {
  const errors = checkDco([{ ...human, message: 'feat: x\n' }]);
  assert.equal(errors.length, 1);
  assert.ok(errors[0].includes('abcdef1'));
  assert.ok(
    errors[0].includes('missing Signed-off-by: Jane Doe <jane@example.com>'),
  );
});

test('sign-off for a different email fails', () => {
  const c = {
    ...human,
    message: 'x\n\nSigned-off-by: Jane Doe <other@example.com>\n',
  };
  assert.equal(checkDco([c]).length, 1);
});

test('sign-off mentioned only in body prose fails', () => {
  const c = {
    ...human,
    message:
      'x\n\nPlease add Signed-off-by: Jane Doe <jane@example.com> later\n',
  };
  assert.equal(checkDco([c]).length, 1);
});

test('merge commit passes', () => {
  assert.deepEqual(
    checkDco([{ ...human, message: 'Merge branch x\n', parents: 2 }]),
    [],
  );
});

test('dependabot passes', () => {
  const c = {
    sha: '1234567abcdef',
    authorName: 'dependabot[bot]',
    authorEmail: '49699333+dependabot[bot]@users.noreply.github.com',
    message: 'chore: bump\n',
    parents: 1,
  };
  assert.deepEqual(checkDco([c]), []);
});

test('bot name with human email fails', () => {
  const c = {
    sha: '1234567abcdef',
    authorName: 'dependabot[bot]',
    authorEmail: 'evil@example.com',
    message: 'chore: bump\n',
    parents: 1,
  };
  assert.equal(checkDco([c]).length, 1);
});

test('parseGitLog reads real git output with a merge commit and CRLF body', async () => {
  const { parseGitLog } = await import('../../scripts/policy/dco.mjs');
  const a = 'a'.repeat(40);
  const b = 'b'.repeat(40);
  const c = 'c'.repeat(40);
  // Shape of `git log --format=%H%x1f%an%x1f%ae%x1f%P%x1f%B%x1e`: %B ends
  // with a newline and git puts another newline after each record.
  const output =
    `${a}\x1fJane Doe\x1fjane@example.com\x1f${b} ${c}\x1fMerge branch 'x'\n\x1e\n` +
    `${b}\x1fJane Doe\x1fjane@example.com\x1f${c}\x1ffeat: x\r\n\r\nSigned-off-by: Jane Doe <jane@example.com>\r\n\x1e\n`;
  const commits = parseGitLog(output);
  assert.equal(commits.length, 2);
  assert.equal(commits[0].sha, a);
  assert.equal(commits[0].parents, 2);
  assert.equal(commits[1].sha, b);
  assert.equal(commits[1].parents, 1);
  assert.equal(commits[1].authorName, 'Jane Doe');
  assert.deepEqual(checkDco(commits), []);
});

test('verifyCommits fails when no commits were parsed', async () => {
  const { verifyCommits } = await import('../../scripts/policy/dco.mjs');
  const errors = verifyCommits([]);
  assert.equal(errors.length, 1);
  assert.match(errors[0], /no commits/);
});

test('verifyCommits passes signed clean commits', async () => {
  const { verifyCommits } = await import('../../scripts/policy/dco.mjs');
  assert.deepEqual(verifyCommits([human]), []);
});
