// Reference tables: every sub-entry of what a topic covers, with support,
// so no part of a covered feature goes unmentioned (spec §8.4).

import { byText, extractSupport, statusOf } from './compat.mjs';
import { unitOf } from './units.mjs';

const lastSegment = (key) => key.slice(key.lastIndexOf('.') + 1);

function toRow(key, root, compat) {
  const below = key === root ? '' : key.slice(root.length + 1);
  return {
    key,
    name: below === '' ? lastSegment(root) : below,
    depth: below === '' ? 0 : below.split('.').length,
    support: extractSupport(compat),
    status: statusOf(compat),
  };
}

// Visits root and its descendants, skipping excluded subtrees.
function* walk(root, index, excluded) {
  const stack = [root];
  while (stack.length > 0) {
    const key = stack.pop();
    const node = index.get(key);
    if (!node || excluded(key)) continue;
    yield [key, node];
    stack.push(...node.children);
  }
}

// Roots are visited in key order, so an ancestor root comes before the
// roots below it and names its shared rows.
export function referenceTable(claimRoots, index, excluded) {
  const rows = new Map();
  for (const root of [...new Set(claimRoots)].toSorted(byText)) {
    for (const [key, node] of walk(root, index, excluded)) {
      if (node.compat && !rows.has(key)) {
        rows.set(key, toRow(key, root, node.compat));
      }
    }
  }
  return [...rows.values()].toSorted((a, b) => byText(a.key, b.key));
}

// A demo key in a feature-level namespace stands for its whole unit; table
// keys and keys outside the counted namespaces stay as written.
function demoRoot(key) {
  const found = unitOf(key);
  return found?.level === 'feature' ? found.unit : key;
}

export function tableRootsFor(topic) {
  const roots = new Set(topic.tables);
  for (const demo of topic.demos) {
    for (const key of demo.features) roots.add(demoRoot(key));
  }
  return [...roots].toSorted(byText);
}

export function checkTables(topics, tablesByTopic, index, excluded) {
  const errors = [];
  for (const topic of topics) {
    const listed = new Set(
      (tablesByTopic.get(topic.url) ?? []).map((row) => row.key),
    );
    const wanted = referenceTable(tableRootsFor(topic), index, excluded);
    for (const { key } of wanted) {
      if (!listed.has(key)) {
        errors.push(
          `${topic.url}: sub-entry ${key} missing from the reference table`,
        );
      }
    }
  }
  return errors;
}
