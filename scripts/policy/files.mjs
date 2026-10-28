import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { gitExecutable } from './git.mjs';

// The only files allowed to contain the attribution patterns.
const ATTRIBUTION_EXCLUDED = new Set([
  'scripts/policy/attribution.mjs',
  'tests/unit/policy-attribution.test.mjs',
]);

export function isAttributionExcluded(path) {
  return ATTRIBUTION_EXCLUDED.has(path);
}

export function filterAttributionTargets(paths) {
  return paths.filter((p) => !isAttributionExcluded(p));
}

export function findCrlf(text) {
  const lines = [];
  text.split('\n').forEach((line, index, all) => {
    if (index < all.length - 1 && line.endsWith('\r')) lines.push(index + 1);
  });
  return lines;
}

// Private-use character that stands in for ** while single * is expanded.
const GLOBSTAR = String.fromCodePoint(0xe000);

function globToRegex(glob) {
  const escaped = glob
    .replaceAll(/[.+^${}()|[\]\\]/g, String.raw`\$&`)
    .replaceAll('**', GLOBSTAR)
    .replaceAll('*', '[^/]*')
    .replaceAll('?', '[^/]')
    .replaceAll(GLOBSTAR, '.*');
  return new RegExp(`^${escaped}$`);
}

export function isBinaryPath(path, gitattributes) {
  for (const raw of gitattributes.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const [pattern, ...attrs] = line.split(/\s+/);
    if (!attrs.includes('binary')) continue;
    const anchored = pattern.replace(/^\//, '');
    const target = pattern.includes('/') ? path : path.split('/').pop();
    if (globToRegex(anchored).test(target)) return true;
  }
  return false;
}

function gitLsFiles() {
  return execFileSync(gitExecutable(), ['ls-files', '-z'], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
}

function readGitattributes() {
  try {
    return readFileSync('.gitattributes', 'utf8');
  } catch {
    return ''; // no .gitattributes: nothing is binary
  }
}

export function listTrackedTextFiles({
  listFiles = gitLsFiles,
  readAttributes = readGitattributes,
} = {}) {
  const attrs = readAttributes();
  return listFiles()
    .split('\0')
    .filter(Boolean)
    .filter((p) => !isBinaryPath(p, attrs));
}
