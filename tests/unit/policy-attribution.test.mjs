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
