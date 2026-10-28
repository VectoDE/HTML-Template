// A small, safe Markdown subset for topic bodies. It is a line scanner with
// indexOf/slice, no regular expressions with backtracking. Anything outside the
// subset (raw HTML, h1, unsafe links) is a ContentError.

import { ContentError } from './frontmatter.mjs';

const ESCAPES = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

export function escapeHtml(text) {
  let out = '';
  for (const ch of text) out += ESCAPES[ch] ?? ch;
  return out;
}

// The site is served under /HTML-Template/, so rooted links would break.
const LINK_PREFIXES = ['https://', 'http://', '#', './', '../'];

function checkHref(href, file, line) {
  if (!LINK_PREFIXES.some((p) => href.startsWith(p))) {
    throw new ContentError(
      file,
      line,
      `link target "${href}" is not allowed, use https://, http://, #, ./ or ../`,
    );
  }
}

function isSpace(ch) {
  return ch === ' ' || ch === '\t';
}

// Each reader returns { html, next } or null when the syntax is not closed,
// in which case the opening character is emitted as text.
function readCode(text, at) {
  const end = text.indexOf('`', at + 1);
  if (end === -1) return null;
  return {
    html: `<code>${escapeHtml(text.slice(at + 1, end))}</code>`,
    next: end + 1,
  };
}

function readStrong(text, at, file, line) {
  const end = text.indexOf('**', at + 2);
  if (end === -1 || end === at + 2) return null;
  const inner = renderInline(text.slice(at + 2, end), file, line);
  return { html: `<strong>${inner}</strong>`, next: end + 2 };
}

function readEm(text, at, file, line) {
  if (at + 1 >= text.length || isSpace(text[at + 1])) return null;
  const end = text.indexOf('*', at + 1);
  if (end === -1) return null;
  const inner = renderInline(text.slice(at + 1, end), file, line);
  return { html: `<em>${inner}</em>`, next: end + 1 };
}

function hasWhitespace(text) {
  for (const ch of text) if (ch === ' ' || ch === '	') return true;
  return false;
}

function checkLinkParts(label, href, file, line) {
  if (label.includes('[')) {
    throw new ContentError(
      file,
      line,
      'a link inside a link label is not allowed',
    );
  }
  if (hasWhitespace(href)) {
    throw new ContentError(
      file,
      line,
      'link target must not contain whitespace (link titles are unsupported)',
    );
  }
  if (href.includes('(')) {
    throw new ContentError(
      file,
      line,
      'parentheses inside a link target are unsupported',
    );
  }
  checkHref(href, file, line);
}

// The target ends at the first ")", so parentheses inside hrefs are
// unsupported and rejected instead of being cut off silently.
function readLink(text, at, file, line) {
  const close = text.indexOf(']', at + 1);
  if (close === -1 || text[close + 1] !== '(') return null;
  const end = text.indexOf(')', close + 2);
  if (end === -1) return null;
  const href = text.slice(close + 2, end).trim();
  const rawLabel = text.slice(at + 1, close);
  checkLinkParts(rawLabel, href, file, line);
  const label = renderInline(rawLabel, file, line);
  return {
    html: `<a href="${escapeHtml(href)}">${label}</a>`,
    next: end + 1,
  };
}

function readInline(text, at, file, line) {
  const ch = text[at];
  if (ch === '`') return readCode(text, at);
  if (ch === '[') return readLink(text, at, file, line);
  if (ch === '*') {
    return text[at + 1] === '*'
      ? readStrong(text, at, file, line)
      : readEm(text, at, file, line);
  }
  return null;
}

function renderInline(text, file, line) {
  let out = '';
  let at = 0;
  while (at < text.length) {
    const found = readInline(text, at, file, line);
    if (found) {
      out += found.html;
      at = found.next;
    } else {
      out += escapeHtml(text[at]);
      at++;
    }
  }
  return out;
}

function headingLevel(line) {
  let n = 0;
  while (line[n] === '#') n++;
  return n > 0 && line[n] === ' ' ? n : 0;
}

function orderedPrefix(line) {
  let n = 0;
  while (line[n] >= '0' && line[n] <= '9') n++;
  return n > 0 && line.startsWith('. ', n) ? n + 2 : 0;
}

function readFence(lines, start, file, firstLine) {
  const lang = lines[start].trim().slice(3).trim();
  const body = [];
  for (let i = start + 1; i < lines.length; i++) {
    if (lines[i].trim() === '```') {
      const cls = lang === '' ? '' : ` class="language-${escapeHtml(lang)}"`;
      return {
        html: `<pre><code${cls}>${escapeHtml(body.join('\n'))}</code></pre>`,
        next: i + 1,
      };
    }
    body.push(lines[i]);
  }
  throw new ContentError(file, firstLine + start, 'unclosed code fence');
}

// The page owns the h1, so the body starts at h2 and never skips a level.
function checkLevelStep(level, last, file, line) {
  if (level > last + 1) {
    throw new ContentError(
      file,
      line,
      `heading h${level} after h${last} skips a level`,
    );
  }
}

function renderHeading(trimmed, level, file, line) {
  if (level === 1) {
    throw new ContentError(
      file,
      line,
      'h1 is not allowed, the page owns the h1',
    );
  }
  if (level > 4) {
    throw new ContentError(file, line, 'headings go from ## to ####');
  }
  const inner = renderInline(trimmed.slice(level + 1), file, line);
  return `<h${level}>${inner}</h${level}>`;
}

// Returns { tag, text } for a list line, or null.
function listLine(trimmed) {
  if (trimmed.startsWith('- ')) return { tag: 'ul', text: trimmed.slice(2) };
  const ordered = orderedPrefix(trimmed);
  return ordered > 0 ? { tag: 'ol', text: trimmed.slice(ordered) } : null;
}

export function renderMarkdown(text, file, firstLine = 1) {
  const lines = text.replaceAll('\r\n', '\n').split('\n');
  const blocks = [];
  let paragraph = [];
  let list = null;
  let lastLevel = 1;

  const flush = () => {
    if (paragraph.length > 0) {
      blocks.push(`<p>${paragraph.join('\n')}</p>`);
      paragraph = [];
    }
    if (list) {
      blocks.push(`<${list.tag}>${list.items.join('')}</${list.tag}>`);
      list = null;
    }
  };

  const addItem = (tag, html) => {
    if (list?.tag !== tag) {
      flush();
      list = { tag, items: [] };
    }
    list.items.push(`<li>${html}</li>`);
  };

  let i = 0;
  while (i < lines.length) {
    const line = firstLine + i;
    const raw = lines[i];
    const trimmed = raw.trim();
    if (trimmed.startsWith('```')) {
      flush();
      const fence = readFence(lines, i, file, firstLine);
      blocks.push(fence.html);
      i = fence.next;
      continue;
    }
    i++;
    if (trimmed === '') {
      flush();
      continue;
    }
    if (trimmed.startsWith('<')) {
      throw new ContentError(file, line, 'raw HTML is not allowed');
    }
    const level = headingLevel(trimmed);
    if (level > 0) {
      const html = renderHeading(trimmed, level, file, line);
      checkLevelStep(level, lastLevel, file, line);
      lastLevel = level;
      flush();
      blocks.push(html);
      continue;
    }
    const item = listLine(trimmed);
    if (item) {
      addItem(item.tag, renderInline(item.text, file, line));
    } else {
      if (list) flush();
      paragraph.push(renderInline(trimmed, file, line));
    }
  }
  flush();
  return blocks.join('\n');
}
