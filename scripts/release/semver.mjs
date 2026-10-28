// Semver 2.0.0 parsing and precedence, written without backtracking-prone
// patterns: every regex is a single anchored character class.
const NUMERIC = /^(?:0|[1-9]\d*)$/;
const DIGITS = /^\d+$/;
const IDENTIFIER = /^[0-9A-Za-z-]+$/;

function validPrerelease(text) {
  return text
    .split('.')
    .every(
      (part) =>
        IDENTIFIER.test(part) && !(DIGITS.test(part) && !NUMERIC.test(part)),
    );
}

// Returns { major, minor, patch, prerelease: string[] } or null.
export function parseSemver(text) {
  if (typeof text !== 'string') return null;
  const plus = text.indexOf('+');
  const build = plus === -1 ? null : text.slice(plus + 1);
  const rest = plus === -1 ? text : text.slice(0, plus);
  const dash = rest.indexOf('-');
  const pre = dash === -1 ? null : rest.slice(dash + 1);
  const core = (dash === -1 ? rest : rest.slice(0, dash)).split('.');
  if (core.length !== 3 || !core.every((part) => NUMERIC.test(part))) {
    return null;
  }
  if (pre !== null && !validPrerelease(pre)) return null;
  if (build !== null && !build.split('.').every((p) => IDENTIFIER.test(p))) {
    return null;
  }
  const [major, minor, patch] = core.map(Number);
  return {
    major,
    minor,
    patch,
    prerelease: pre === null ? [] : pre.split('.'),
  };
}

export function isSemver(text) {
  return parseSemver(text) !== null;
}

function compareIdentifier(a, b) {
  const aNum = DIGITS.test(a);
  const bNum = DIGITS.test(b);
  if (aNum && bNum) return Math.sign(Number(a) - Number(b));
  if (aNum) return -1;
  if (bNum) return 1;
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

function comparePrerelease(a, b) {
  if (a.length === 0 || b.length === 0) {
    return Math.sign(b.length - a.length);
  }
  const length = Math.min(a.length, b.length);
  for (let i = 0; i < length; i++) {
    const order = compareIdentifier(a[i], b[i]);
    if (order !== 0) return order;
  }
  return Math.sign(a.length - b.length);
}

// Sort comparator by semver precedence. Build metadata is ignored.
export function compareSemver(a, b) {
  const left = parseSemver(a);
  const right = parseSemver(b);
  if (left === null || right === null) {
    throw new Error(`Cannot compare "${a}" and "${b}": not semver`);
  }
  for (const key of ['major', 'minor', 'patch']) {
    if (left[key] !== right[key]) return Math.sign(left[key] - right[key]);
  }
  return comparePrerelease(left.prerelease, right.prerelease);
}

// The semver versions behind the tags of the form v<semver>, others dropped.
export function versionsFromTags(tags) {
  return tags
    .filter((tag) => typeof tag === 'string' && tag.startsWith('v'))
    .map((tag) => tag.slice(1))
    .filter(isSemver);
}
