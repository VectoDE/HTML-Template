// Front matter reader for the content files. Deliberately small: flat keys,
// scalars, flow lists and block lists. Everything else is a ContentError so a
// typo fails the build with a file and line instead of silently changing data.

export class ContentError extends Error {
  constructor(file, line, message) {
    super(`${file}:${line} ${message}`);
    this.name = 'ContentError';
    this.file = file;
    this.line = line;
  }
}

const MARKER = '---';
const TAB = String.fromCharCode(9);

function isDigit(ch) {
  return ch >= '0' && ch <= '9';
}

function isInteger(text) {
  const start = text.startsWith('-') ? 1 : 0;
  if (text.length === start) return false;
  for (let i = start; i < text.length; i++) {
    if (!isDigit(text[i])) return false;
  }
  return true;
}

function isIndented(text) {
  return text.startsWith(' ') || text.startsWith(TAB);
}

function isQuote(ch) {
  return ch === '"' || ch === "'";
}

function parseScalar(raw, file, line) {
  const text = raw.trim();
  if (isQuote(text[0])) {
    if (text.length < 2 || text.at(-1) !== text[0]) {
      throw new ContentError(file, line, 'unterminated quoted string');
    }
    return text.slice(1, -1);
  }
  if (isInteger(text)) return Number(text);
  return text;
}

function parseFlowList(text, file, line) {
  if (!text.endsWith(']')) {
    throw new ContentError(file, line, 'unterminated list, expected "]"');
  }
  const inner = text.slice(1, -1).trim();
  if (inner === '') return [];
  return inner.split(',').map((part) => {
    const item = parseScalar(part, file, line);
    return typeof item === 'number' ? String(item) : item;
  });
}

function parseBlockItems(lines, start, file, firstLine) {
  const items = [];
  let i = start;
  while (i < lines.length && isIndented(lines[i])) {
    const line = firstLine + i;
    if (lines[i].includes(TAB)) {
      throw new ContentError(file, line, 'tabs are not allowed, use spaces');
    }
    const trimmed = lines[i].trim();
    if (!trimmed.startsWith('- ')) {
      throw new ContentError(
        file,
        line,
        'nested maps are not supported, expected "- item"',
      );
    }
    const item = parseScalar(trimmed.slice(2), file, line);
    items.push(typeof item === 'number' ? String(item) : item);
    i++;
  }
  return { items, next: i };
}

function parseBlock(lines, file, firstLine) {
  const data = {};
  let i = 0;
  while (i < lines.length) {
    const line = firstLine + i;
    const text = lines[i];
    if (text.includes('\t')) {
      throw new ContentError(file, line, 'tabs are not allowed, use spaces');
    }
    if (text.trim() === '') {
      i++;
      continue;
    }
    if (text.startsWith(' ')) {
      throw new ContentError(
        file,
        line,
        'unexpected indentation, nested maps are not supported',
      );
    }
    const colon = text.indexOf(':');
    const key = colon === -1 ? '' : text.slice(0, colon).trim();
    if (key === '') {
      throw new ContentError(file, line, 'expected "key: value"');
    }
    if (Object.hasOwn(data, key)) {
      throw new ContentError(file, line, `duplicate key "${key}"`);
    }
    const value = text.slice(colon + 1).trim();
    if (value === '') {
      const { items, next } = parseBlockItems(lines, i + 1, file, firstLine);
      if (items.length === 0) {
        throw new ContentError(file, line, `key "${key}" has no value`);
      }
      data[key] = items;
      i = next;
      continue;
    }
    data[key] = value.startsWith('[')
      ? parseFlowList(value, file, line)
      : parseScalar(value, file, line);
    i++;
  }
  return data;
}

export function parseFrontMatter(text, file) {
  const lines = text.replaceAll('\r\n', '\n').split('\n');
  if (lines[0].trimEnd() !== MARKER) {
    throw new ContentError(file, 1, 'file must start with a "---" line');
  }
  const close = lines.findIndex((l, i) => i > 0 && l.trimEnd() === MARKER);
  if (close === -1) {
    throw new ContentError(file, 1, 'missing closing "---" line');
  }
  return {
    data: parseBlock(lines.slice(1, close), file, 2),
    body: lines.slice(close + 1).join('\n'),
    bodyLine: close + 2,
  };
}
