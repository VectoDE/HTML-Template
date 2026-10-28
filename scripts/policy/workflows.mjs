const SHA_USE = /^[\w.-]+\/[\w.-]+(?:\/[\w./-]+)?@[0-9a-f]{40}$/;
const DOCKER_USE = /^docker:\/\/\S+@sha256:[0-9a-f]{64}$/;
const SLSA_USE =
  /^slsa-framework\/slsa-github-generator\/\.github\/workflows\/[\w-]+\.yml@v\d+\.\d+\.\d+$/;
const VERSION_COMMENT = /^\s*#\s*v\d/;
const USES_LINE = /^\s*(?:-\s*)?uses:\s*(\S+)(.*)$/;

function unquote(value) {
  return value.replace(/^(['"])(.*)\1$/, '$2');
}

function checkUses(lines, file) {
  const errors = [];
  lines.forEach((line, index) => {
    const m = USES_LINE.exec(line);
    if (!m) return;
    const ref = unquote(m[1]);
    const rest = m[2];
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
  const start = lines.findIndex((line) => /^permissions:/.test(line));
  if (start === -1) {
    return [
      `${file}:1 missing top-level "permissions:" (use "permissions: {}" or read-only)`,
    ];
  }
  const where = `${file}:${start + 1}`;
  const inline = lines[start]
    .replace(/^permissions:/, '')
    .replace(/\s+#.*$/, '')
    .trim();
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
    if (m && m[2] !== 'read' && m[2] !== 'none') {
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
