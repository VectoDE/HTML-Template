// Reader for <nn>-<slug>.demo.html: one JSON meta script followed by up to
// three <template data-lang="html|css|js"> blocks. The scanner works with
// indexOf and slice, no backtracking regular expressions.

import { ContentError } from './frontmatter.mjs';
import { NAMESPACES, PERMISSIONS } from './config.mjs';

const META_OPEN = '<script type="application/json" data-demo-meta>';
const SCRIPT_CLOSE = '</script>';
const TEMPLATE_OPEN = '<template data-lang="';
const LANGS = ['html', 'css', 'js'];
const REQUIRED = [
  'title',
  'summary',
  'fallback',
  'features',
  'detect',
  'runsIn',
];
const OPTIONAL = ['a11y', 'permissions'];
const RUNS_IN = ['frame', 'window'];
const DETECT_MAX = 200;

function isBlank(ch) {
  return ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r';
}

function hasWhitespace(text) {
  for (const ch of text) if (isBlank(ch)) return true;
  return false;
}

function skipBlanks(text, at) {
  let i = at;
  while (i < text.length && isBlank(text[i])) i++;
  return i;
}

function lineAt(text, pos) {
  let line = 1;
  for (
    let i = text.indexOf('\n');
    i !== -1 && i < pos;
    i = text.indexOf('\n', i + 1)
  ) {
    line++;
  }
  return line;
}

// --- meta -----------------------------------------------------------------

function isText(value) {
  return typeof value === 'string' && value.trim() !== '';
}

function featureProblem(key) {
  if (!isText(key)) return 'feature keys must be non-empty strings';
  const parts = key.split('.');
  const ok =
    parts.length >= 2 &&
    parts.every((p) => p !== '') &&
    !hasWhitespace(key) &&
    NAMESPACES.includes(parts[0]);
  return ok ? null : `malformed feature key "${key}"`;
}

function checkFeatures(value) {
  if (!Array.isArray(value) || value.length === 0) {
    return '"features" must be a non-empty list';
  }
  const seen = new Set();
  for (const key of value) {
    const problem = featureProblem(key);
    if (problem) return problem;
    if (seen.has(key)) return `duplicate feature "${key}"`;
    seen.add(key);
  }
  return null;
}

function checkPermissions(value) {
  if (!Array.isArray(value)) return '"permissions" must be a list';
  const bad = value.find((p) => !Object.hasOwn(PERMISSIONS, p));
  return bad === undefined ? null : `unknown permission "${bad}"`;
}

function checkDetect(value) {
  if (!isText(value)) return '"detect" must be a non-empty string';
  if (value.includes('\n') || value.length > DETECT_MAX) {
    return `"detect" must be one line of at most ${DETECT_MAX} characters`;
  }
  return null;
}

function checkRunsIn(value) {
  return RUNS_IN.includes(value)
    ? null
    : '"runsIn" must be "frame" or "window"';
}

const SPECIAL = {
  features: checkFeatures,
  permissions: checkPermissions,
  detect: checkDetect,
  runsIn: checkRunsIn,
};

function keyProblem(meta, key) {
  if (!Object.hasOwn(meta, key)) return null;
  const check = SPECIAL[key];
  if (check) return check(meta[key]);
  return isText(meta[key]) ? null : `"${key}" must be a non-empty string`;
}

function metaProblem(meta) {
  for (const key of Object.keys(meta)) {
    if (!REQUIRED.includes(key) && !OPTIONAL.includes(key)) {
      return `unknown key "${key}"`;
    }
  }
  const missing = REQUIRED.find((k) => !Object.hasOwn(meta, k));
  if (missing) return `missing key "${missing}"`;
  for (const key of [...REQUIRED, ...OPTIONAL]) {
    const problem = keyProblem(meta, key);
    if (problem) return problem;
  }
  return null;
}

function readMeta(text, file) {
  const start = skipBlanks(text, 0);
  if (!text.startsWith(META_OPEN, start)) {
    throw new ContentError(
      file,
      lineAt(text, start),
      `file must start with ${META_OPEN}`,
    );
  }
  const line = lineAt(text, start);
  const from = start + META_OPEN.length;
  const end = text.indexOf(SCRIPT_CLOSE, from);
  if (end === -1)
    throw new ContentError(file, line, 'unclosed <script> in meta block');
  let meta;
  try {
    meta = JSON.parse(text.slice(from, end));
  } catch {
    throw new ContentError(file, line, 'meta block is not valid JSON');
  }
  if (meta === null || typeof meta !== 'object' || Array.isArray(meta)) {
    throw new ContentError(file, line, 'meta block must be a JSON object');
  }
  const problem = metaProblem(meta);
  if (problem) throw new ContentError(file, line, problem);
  return { meta, next: end + SCRIPT_CLOSE.length };
}

// --- templates ------------------------------------------------------------

// Boundary rules: "<template" counts when followed by whitespace, ">" or "/";
// "</template" counts when followed by ">" or whitespace.
function tagAt(text, at) {
  const lower = text.slice(at, at + 11).toLowerCase();
  if (lower.startsWith('</template')) {
    const after = lower[10];
    return after === '>' || isBlank(after ?? 'x') ? 'close' : null;
  }
  if (lower.startsWith('<template')) {
    const after = lower[9];
    return after === '>' || after === '/' || isBlank(after ?? 'x')
      ? 'open'
      : null;
  }
  return null;
}

// Returns the index of the "<" of the matching </template>.
function findBlockEnd(text, from, file, openLine) {
  let depth = 1;
  let at = text.indexOf('<', from);
  while (at !== -1) {
    const kind = tagAt(text, at);
    if (kind === 'open') depth++;
    if (kind === 'close' && --depth === 0) return at;
    at = text.indexOf('<', at + 1);
  }
  throw new ContentError(file, openLine, 'unclosed <template>');
}

function readLangName(text, at, file) {
  const line = lineAt(text, at);
  if (!text.startsWith(TEMPLATE_OPEN, at)) {
    throw new ContentError(
      file,
      line,
      'unexpected text outside blocks, expected <template data-lang="...">',
    );
  }
  const from = at + TEMPLATE_OPEN.length;
  const quote = text.indexOf('"', from);
  if (quote === -1 || text[quote + 1] !== '>') {
    throw new ContentError(
      file,
      line,
      'malformed <template data-lang="..."> tag',
    );
  }
  const lang = text.slice(from, quote);
  if (!LANGS.includes(lang)) {
    throw new ContentError(file, line, `unknown data-lang "${lang}"`);
  }
  return { lang, bodyStart: quote + 2, line };
}

export function dedent(raw) {
  const lines = raw.split('\n');
  while (lines.length > 0 && lines[0].trim() === '') lines.shift();
  while (lines.length > 0 && lines.at(-1).trim() === '') lines.pop();
  const indents = lines
    .filter((l) => l.trim() !== '')
    .map((l) => l.length - l.trimStart().length);
  const cut = indents.length === 0 ? 0 : Math.min(...indents);
  return lines.map((l) => l.slice(cut)).join('\n');
}

function readTemplates(text, from, file) {
  const code = { html: '', css: '', js: '' };
  const seen = new Set();
  let at = skipBlanks(text, from);
  while (at < text.length) {
    const head = readLangName(text, at, file);
    if (seen.has(head.lang)) {
      throw new ContentError(
        file,
        head.line,
        `duplicate data-lang "${head.lang}"`,
      );
    }
    seen.add(head.lang);
    const end = findBlockEnd(text, head.bodyStart, file, head.line);
    code[head.lang] = dedent(text.slice(head.bodyStart, end));
    const close = text.indexOf('>', end);
    if (close === -1) {
      throw new ContentError(file, head.line, 'unclosed <template>');
    }
    at = skipBlanks(text, close + 1);
  }
  if (seen.size === 0) {
    throw new ContentError(
      file,
      lineAt(text, from),
      'no <template data-lang> block found',
    );
  }
  return code;
}

export function parseDemo(input, file) {
  const text = input.replaceAll('\r\n', '\n');
  const { meta, next } = readMeta(text, file);
  const code = readTemplates(text, next, file);
  return {
    title: meta.title,
    summary: meta.summary,
    a11y: meta.a11y ?? null,
    fallback: meta.fallback,
    features: [...meta.features],
    detect: meta.detect,
    runsIn: meta.runsIn,
    permissions: [...(meta.permissions ?? [])],
    code,
  };
}
