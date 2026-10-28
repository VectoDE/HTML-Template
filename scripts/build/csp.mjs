// The shell's Content-Security-Policy (spec §11) and the hashes of any inline
// <script> or <style> a page carries. Stage 2 pages have none; stage 3 may.
// The scanner works with indexOf and slice, no backtracking expressions.

import { createHash } from 'node:crypto';

const TAGS = ['script', 'style'];
const HASH = /^sha256-[A-Za-z0-9+/]+={0,2}$/;

const isBlank = (ch) =>
  ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r' || ch === '\f';

const sha256 = (text) =>
  `sha256-${createHash('sha256').update(text).digest('base64')}`;

// ASCII only, so every index stays where it was.
const asciiLower = (text) =>
  text.replaceAll(/[A-Z]/g, (ch) => ch.toLowerCase());

// "script" or "style" when a tag of that name starts at `at`.
function tagAt(lower, at) {
  for (const tag of TAGS) {
    const after = lower[at + 1 + tag.length];
    const bounded = after === '>' || after === '/' || isBlank(after);
    if (lower.startsWith(tag, at + 1) && bounded) return tag;
  }
  return null;
}

// Index of the ">" that ends the opening tag, skipping quoted values.
function openTagEnd(html, from) {
  let quote = null;
  for (let i = from; i < html.length; i++) {
    const ch = html[i];
    if (quote !== null) {
      if (ch === quote) quote = null;
    } else if (ch === '"' || ch === "'") {
      quote = ch;
    } else if (ch === '>') {
      return i;
    }
  }
  return -1;
}

function skipValue(text, at) {
  const quote = text[at];
  if (quote === '"' || quote === "'") {
    const end = text.indexOf(quote, at + 1);
    return end === -1 ? text.length : end + 1;
  }
  let i = at;
  while (i < text.length && !isBlank(text[i])) i++;
  return i;
}

// Attribute names of an opening tag's inside, values skipped.
function attributeNames(inner) {
  const names = [];
  let i = 0;
  while (i < inner.length) {
    if (isBlank(inner[i]) || inner[i] === '/') {
      i++;
      continue;
    }
    const start = i;
    while (i < inner.length && !isBlank(inner[i]) && inner[i] !== '=') i++;
    names.push(inner.slice(start, i));
    while (isBlank(inner[i])) i++;
    if (inner[i] === '=') {
      i++;
      while (isBlank(inner[i])) i++;
      i = skipValue(inner, i);
    }
  }
  return names;
}

// The element starting at `at`, or null when it never closes.
function readElement(html, lower, at, tag) {
  const nameEnd = at + 1 + tag.length;
  const open = openTagEnd(html, nameEnd);
  if (open === -1) return null;
  const close = lower.indexOf(`</${tag}`, open + 1);
  if (close === -1) return null;
  return {
    body: html.slice(open + 1, close),
    hasSrc: attributeNames(lower.slice(nameEnd, open)).includes('src'),
    next: close + tag.length + 2,
  };
}

// 'sha256-…' of each inline <script> (no src) and each <style>, in order.
export function hashInline(html) {
  const lower = asciiLower(html);
  const found = { scripts: [], styles: [] };
  let at = lower.indexOf('<');
  while (at !== -1) {
    const tag = tagAt(lower, at);
    let next = at + 1;
    if (tag !== null) {
      const element = readElement(html, lower, at, tag);
      if (element === null) break;
      if (tag === 'style') found.styles.push(sha256(element.body));
      // A data block (type="application/json") never runs, so its hash is
      // not needed; it is hashed anyway because that is harmless.
      else if (!element.hasSrc) found.scripts.push(sha256(element.body));
      next = element.next;
    }
    at = lower.indexOf('<', next);
  }
  return found;
}

// --- policy ---------------------------------------------------------------

function checkOrigin(value) {
  let url = null;
  try {
    url = new URL(value);
  } catch {
    // reported below
  }
  if (url?.protocol !== 'https:' || url.origin !== value) {
    throw new TypeError(
      `previewOrigin must be an https origin without a path, got "${value}"`,
    );
  }
}

function sources(hashes) {
  for (const hash of hashes) {
    if (typeof hash !== 'string' || !HASH.test(hash)) {
      throw new TypeError(`not a sha256 source: "${hash}"`);
    }
  }
  return ["'self'", ...hashes.map((hash) => `'${hash}'`)].join(' ');
}

// Never 'unsafe-inline' or 'unsafe-eval'; frames only the preview origin.
export function buildCsp({ scripts = [], styles = [], previewOrigin } = {}) {
  checkOrigin(previewOrigin);
  return [
    "default-src 'none'",
    `script-src ${sources(scripts)}`,
    `style-src ${sources(styles)}`,
    "img-src 'self' data:",
    "font-src 'self'",
    "connect-src 'self'",
    `frame-src ${previewOrigin}`,
    "manifest-src 'self'",
    "worker-src 'self'",
    "base-uri 'none'",
    "form-action 'none'",
    "object-src 'none'",
  ].join('; ');
}
