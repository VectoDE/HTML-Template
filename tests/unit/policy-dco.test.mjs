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
