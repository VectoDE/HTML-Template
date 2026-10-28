import { test } from 'node:test';
import assert from 'node:assert/strict';
import { UNIT_RULES } from '../../scripts/build/config.mjs';
import { indexCompat, resolveKey } from '../../scripts/build/compat.mjs';
import {
  isDeprecated,
  listUnits,
  makeExcluded,
  unitOf,
} from '../../scripts/build/units.mjs';
import { miniBcd } from './helpers/fixtures.mjs';

const index = indexCompat(miniBcd());

test('UNIT_RULES: one http rule at depth 2, the rest at depth 1', () => {
  const http = UNIT_RULES.filter((r) => r.prefix.startsWith('http'));
  assert.deepEqual(http, [{ prefix: 'http', level: 'table', depth: 2 }]);
  for (const rule of UNIT_RULES) {
    assert.ok(['feature', 'table'].includes(rule.level), rule.prefix);
    assert.ok(rule.prefix === 'http' || rule.depth === undefined, rule.prefix);
  }
  const feature = UNIT_RULES.filter((r) => r.level === 'feature');
  assert.deepEqual(
    feature.map((r) => r.prefix),
    [
      'html.elements',
      'css.properties',
      'css.at-rules',
      'css.selectors',
      'css.types',
      'api',
      'javascript.builtins',
      'svg.elements',
      'mathml.elements',
    ],
  );
  assert.ok(UNIT_RULES.some((r) => r.prefix === 'webassembly.api'));
  assert.ok(Object.isFrozen(UNIT_RULES) && Object.isFrozen(UNIT_RULES[0]));
});

test('unitOf maps keys to their feature or table unit', () => {
  assert.deepEqual(unitOf('css.properties.display.grid'), {
    unit: 'css.properties.display',
    level: 'feature',
  });
  assert.deepEqual(unitOf('api.Element.closest'), {
    unit: 'api.Element',
    level: 'feature',
  });
  assert.deepEqual(unitOf('api.Element'), {
    unit: 'api.Element',
    level: 'feature',
  });
  assert.deepEqual(unitOf('html.global_attributes.inert'), {
    unit: 'html.global_attributes.inert',
    level: 'table',
  });
  assert.deepEqual(unitOf('http.headers.Content-Security-Policy.script-src'), {
    unit: 'http.headers.Content-Security-Policy',
    level: 'table',
  });
  assert.deepEqual(unitOf('http.future-group.thing'), {
    unit: 'http.future-group.thing',
    level: 'table',
  });
  assert.deepEqual(unitOf('webassembly.api.Memory.grow'), {
    unit: 'webassembly.api.Memory',
    level: 'table',
  });
});

test('unitOf returns null outside the counted namespaces', () => {
  assert.equal(unitOf('webassembly.instructions.i32'), null);
  assert.equal(unitOf('manifests.name'), null);
  assert.equal(unitOf('http.headers'), null);
  assert.equal(unitOf('http'), null);
  assert.equal(unitOf('css.properties'), null);
  assert.equal(unitOf('javascript.classes'), null);
  assert.equal(unitOf('apiX.Element'), null);
  assert.equal(unitOf(''), null);
});

test('listUnits is sorted and includes units without __compat', () => {
  assert.deepEqual(listUnits(index), [
    { unit: 'api.Holder', level: 'feature' },
    { unit: 'api.NoIos', level: 'feature' },
    { unit: 'api.Old', level: 'feature' },
    { unit: 'css.properties.zoom', level: 'feature' },
    { unit: 'html.elements.dialog', level: 'feature' },
    { unit: 'http.data-url', level: 'table' },
    { unit: 'http.data-url.css_files', level: 'table' },
    { unit: 'javascript.classes', level: 'table' },
    { unit: 'javascript.classes.private_class_fields', level: 'table' },
  ]);
});

test('a rule node with its own __compat is a table unit', () => {
  const table = (unit) => ({ unit, level: 'table' });
  assert.deepEqual(
    unitOf('javascript.classes', index),
    table('javascript.classes'),
  );
  assert.deepEqual(unitOf('http.data-url', index), table('http.data-url'));
  assert.deepEqual(
    unitOf('javascript.classes.private_class_fields', index),
    table('javascript.classes.private_class_fields'),
  );
  // Without the index, or without __compat, the node stays out of scope.
  assert.equal(unitOf('javascript.classes'), null);
  assert.equal(unitOf('html.elements', index), null);
  assert.equal(unitOf('http.nope', index), null);
  // Outside every rule nothing counts, __compat or not (plan call 6).
  assert.equal(unitOf('webassembly.instructions.i32', index), null);
  assert.equal(unitOf('javascript', index), null);
});

test('a unit with only children resolves without support', () => {
  assert.equal(index.get('api.Holder').compat, null);
  const resolved = resolveKey('api.Holder', index, new Map());
  assert.equal(resolved.support, null);
  assert.deepEqual(isDeprecated('api.Holder', index), {
    deprecated: false,
    removed: false,
  });
});

test('isDeprecated reads status and removal', () => {
  assert.deepEqual(isDeprecated('api.Old', index), {
    deprecated: false,
    removed: true,
  });
  assert.deepEqual(isDeprecated('css.properties.zoom', index), {
    deprecated: true,
    removed: false,
  });
  assert.deepEqual(isDeprecated('html.elements.dialog', index), {
    deprecated: false,
    removed: false,
  });
  // A browser with unknown support (added: null) keeps the key alive.
  assert.deepEqual(isDeprecated('api.NoIos', index), {
    deprecated: false,
    removed: false,
  });
  assert.deepEqual(isDeprecated('api.Missing', index), {
    deprecated: false,
    removed: false,
  });
});

test('makeExcluded covers the key, its descendants and nothing else', () => {
  const excluded = makeExcluded([
    { key: 'api.Old', reason: 'removed everywhere long ago' },
    'css.properties',
  ]);
  assert.equal(excluded('api.Old'), true);
  assert.equal(excluded('api.Old.method'), true);
  assert.equal(excluded('css.properties.zoom'), true);
  assert.equal(excluded('css.properties'), true);
  assert.equal(excluded('api.OldStyle'), false);
  assert.equal(excluded('api'), false);
  assert.equal(excluded('css'), false);
  assert.equal(makeExcluded([])('api.Old'), false);
});
