const SHA_USE = /^[\w.-]+\/[\w.-]+(?:\/[\w./-]+)?@[0-9a-f]{40}$/;
const DOCKER_USE = /^docker:\/\/\S+@sha256:[0-9a-f]{64}$/;
const SLSA_USE =
  /^slsa-framework\/slsa-github-generator\/\.github\/workflows\/[\w-]+\.yml@v\d+\.\d+\.\d+$/;
const VERSION_COMMENT = /^\s*#\s*v\d/;
const USES_KEY = 'uses:';

// Split a "uses:" line into the ref and whatever follows it (comment).
function parseUsesLine(line) {
  let text = line.trimStart();
  if (text.startsWith('-')) text = text.slice(1).trimStart();
  if (!text.startsWith(USES_KEY)) return null;
  const value = text.slice(USES_KEY.length).trimStart();
  if (value === '') return null;
  const end = value.search(/\s/);
  return end === -1
    ? { ref: value, rest: '' }
    : { ref: value.slice(0, end), rest: value.slice(end) };
}

function unquote(value) {
  const first = value[0];
  if (
    value.length >= 2 &&
    (first === '"' || first === "'") &&
    value.endsWith(first)
  ) {
    return value.slice(1, -1);
  }
  return value;
}

function checkUses(lines, file) {
  const errors = [];
  lines.forEach((line, index) => {
    const m = parseUsesLine(line);
    if (!m) return;
    const ref = unquote(m.ref);
    const rest = m.rest;
    const where = `${file}:${index + 1}`;
    if (ref.startsWith('./')) return;
    if (SLSA_USE.test(ref)) return;
    if (DOCKER_USE.test(ref)) return;
    if (SHA_USE.test(ref)) {
      if (!VERSION_COMMENT.test(rest)) {
        errors.push(
          `${where} "${ref}" is pinned but lacks a trailing "# v…" version comment`,
        );
      }
      return;
    }
    errors.push(
      `${where} "${ref}" is not pinned to a full 40-character commit SHA`,
    );
  });
  return errors;
}

function checkPermissions(lines, file) {
  const start = lines.findIndex((line) => line.startsWith('permissions:'));
  if (start === -1) {
    return [
      `${file}:1 missing top-level "permissions:" (use "permissions: {}" or read-only)`,
    ];
  }
  const where = `${file}:${start + 1}`;
  const afterKey = lines[start].slice('permissions:'.length);
  const commentAt = afterKey.search(/\s#/);
  const inline = (
    commentAt === -1 ? afterKey : afterKey.slice(0, commentAt)
  ).trim();
  if (inline === '{}' || inline === 'read-all') return [];
  if (inline !== '') {
    return [
      `${where} top-level permissions "${inline}" must be {}, read-all or read/none only`,
    ];
  }
  const errors = [];
  for (let i = start + 1; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim() === '' || /^\s*#/.test(line)) continue;
    if (!/^\s+/.test(line)) break;
    const m = /^\s+([\w-]+):\s*([^\s#]+)/.exec(line);
    const value = m ? unquote(m[2]) : '';
    if (m && value !== 'read' && value !== 'none') {
      errors.push(
        `${file}:${i + 1} top-level permission "${m[1]}: ${m[2]}" must be read or none`,
      );
    }
  }
  return errors;
}

export function checkWorkflow(text, file) {
  const lines = text.split(/\r?\n/);
  return [...checkPermissions(lines, file), ...checkUses(lines, file)];
}
