// Loads content/<category>/<topic>/topic.md and the <nn>-<slug>.demo.html files
// next to it. Errors are collected, never thrown one at a time, so a single
// build run reports every problem with "<path>:<line> <message>".

import * as fs from 'node:fs/promises';
import { join } from 'node:path';
import { CATEGORIES } from './config.mjs';
import { parseDemo } from './demo.mjs';
import { ContentError, parseFrontMatter } from './frontmatter.mjs';
import { renderMarkdown } from './markdown.mjs';

const ROOT = 'content';
const SKIPPED = 'coverage';
const TOPIC_FILE = 'topic.md';
const DEMO_SUFFIX = '.demo.html';
const REQUIRED = ['title', 'number', 'lede', 'spec'];
const OPTIONAL = new Set(['interface', 'mdn', 'tables', 'appendix']);
const READ_CODES = new Set(['ENOENT', 'ENOTDIR', 'EACCES']);

// --- small checks ---------------------------------------------------------

function isText(value) {
  return typeof value === 'string' && value.trim() !== '';
}

function isDigit(ch) {
  return ch >= '0' && ch <= '9';
}

function isSlugChar(ch) {
  return (ch >= 'a' && ch <= 'z') || isDigit(ch);
}

// [a-z0-9]+(-[a-z0-9]+)* without a regular expression.
export function isSlug(text) {
  return text
    .split('-')
    .every((part) => part !== '' && [...part].every(isSlugChar));
}

function isHttps(value) {
  return isText(value) && value.startsWith('https://');
}

function parseDemoName(name) {
  const stem = name.slice(0, -DEMO_SUFFIX.length);
  const nn = stem.slice(0, 2);
  const slug = stem.slice(3);
  const shapeOk = [...nn].every(isDigit) && nn.length === 2 && stem[2] === '-';
  const n = Number(nn);
  if (!shapeOk || n < 1 || !isSlug(slug)) {
    return {
      problem: `invalid demo file name "${name}", expected <nn>-<slug>${DEMO_SUFFIX}`,
    };
  }
  return { n, nn, slug };
}

// --- front matter ---------------------------------------------------------

function specProblem(value) {
  const list = Array.isArray(value) ? value : [value];
  if (list.length === 0 || !list.every(isHttps)) {
    return '"spec" must be one or more https:// URLs';
  }
  return null;
}

const CHECKS = {
  title: (v) => (isText(v) ? null : '"title" must be a non-empty string'),
  lede: (v) => (isText(v) ? null : '"lede" must be a non-empty string'),
  interface: (v) =>
    isText(v) ? null : '"interface" must be a non-empty string',
  number: (v) =>
    Number.isInteger(v) && v >= 1
      ? null
      : '"number" must be a positive integer',
  spec: specProblem,
  mdn: (v) => (isHttps(v) ? null : '"mdn" must be an https:// URL'),
  tables: (v) =>
    Array.isArray(v) && v.every(isText)
      ? null
      : '"tables" must be a list of keys',
  appendix: (v) =>
    v === 'deprecated' ? null : '"appendix" must be "deprecated"',
};

function frontProblem(data) {
  const unknown = Object.keys(data).find(
    (k) => !REQUIRED.includes(k) && !OPTIONAL.has(k),
  );
  if (unknown) return `unknown key "${unknown}"`;
  const missing = REQUIRED.find((k) => !Object.hasOwn(data, k));
  if (missing) return `missing key "${missing}"`;
  for (const key of Object.keys(data)) {
    const problem = CHECKS[key](data[key]);
    if (problem) return problem;
  }
  return null;
}

function buildTopic(text, file, category, slug) {
  const { data, body, bodyLine } = parseFrontMatter(text, file);
  const problem = frontProblem(data);
  if (problem) throw new ContentError(file, 1, problem);
  return {
    category,
    slug,
    url: `/${category}/${slug}/`,
    title: data.title,
    number: data.number,
    lede: data.lede,
    interface: data.interface ?? null,
    spec: Array.isArray(data.spec) ? data.spec : [data.spec],
    mdn: data.mdn ?? null,
    tables: data.tables ?? [],
    appendix: data.appendix ?? null,
    bodyHtml: renderMarkdown(body, file, bodyLine),
    demos: [],
    file,
  };
}

// --- reading --------------------------------------------------------------

function createContext(dir, io) {
  const errors = [];
  return {
    errors,
    fail: (file, message, line = 1) =>
      errors.push(`${file}:${line} ${message}`),
    async list(rel) {
      try {
        const where =
          rel === ROOT ? dir : join(dir, rel.slice(ROOT.length + 1));
        const entries = await io.readdir(where, { withFileTypes: true });
        // A link could point outside content/, so it is reported, not read.
        for (const link of entries.filter((e) => e.isSymbolicLink())) {
          errors.push(`${rel}/${link.name}:1 symbolic links are not allowed`);
        }
        return entries
          .filter((e) => !e.isSymbolicLink())
          .sort((a, b) => (a.name < b.name ? -1 : 1));
      } catch (error) {
        if (!READ_CODES.has(error?.code)) throw error;
        errors.push(`${rel}:1 cannot read this folder (${error.code})`);
        return [];
      }
    },
    read: (rel) => io.readFile(join(dir, rel.slice(ROOT.length + 1)), 'utf8'),
    // Runs fn and turns a ContentError into a collected message.
    async attempt(fn) {
      try {
        return await fn();
      } catch (error) {
        if (!(error instanceof ContentError)) throw error;
        errors.push(error.message);
        return null;
      }
    },
  };
}

// Valid demo files with their parsed name; problems are reported here.
function demoFiles(ctx, rel, entries) {
  const found = [];
  const seen = new Set();
  for (const entry of entries.filter((e) => e.name.endsWith(DEMO_SUFFIX))) {
    const file = `${rel}/${entry.name}`;
    const name = parseDemoName(entry.name);
    if (name.problem) {
      ctx.fail(file, name.problem);
    } else if (seen.has(name.nn)) {
      ctx.fail(file, `duplicate demo number ${name.nn} in this topic`);
    } else {
      seen.add(name.nn);
      found.push({ file, name });
    }
  }
  return found;
}

async function loadDemos(ctx, rel, entries) {
  const loaded = await Promise.all(
    demoFiles(ctx, rel, entries).map(async ({ file, name }) => {
      const demo = await ctx.attempt(async () =>
        parseDemo(await ctx.read(file), file),
      );
      if (!demo) return null;
      const { n, slug } = name;
      return { ...demo, n, slug, id: `demo-${n}`, file };
    }),
  );
  return loaded.filter(Boolean).sort((x, y) => x.n - y.n);
}

function reportStray(ctx, rel, entries) {
  for (const entry of entries) {
    const known = entry.name === TOPIC_FILE || entry.name.endsWith(DEMO_SUFFIX);
    if (entry.isDirectory() || !known) {
      ctx.fail(
        `${rel}/${entry.name}`,
        'unexpected file or folder in a topic folder',
      );
    }
  }
}

async function loadTopic(ctx, category, slug) {
  const rel = `${ROOT}/${category}/${slug}`;
  if (!isSlug(slug)) {
    ctx.fail(
      rel,
      `invalid topic slug "${slug}", use lowercase letters, digits and "-"`,
    );
    return null;
  }
  const entries = await ctx.list(rel);
  reportStray(ctx, rel, entries);
  const topicPath = `${rel}/${TOPIC_FILE}`;
  const hasTopic = entries.some(
    (e) => e.name === TOPIC_FILE && !e.isDirectory(),
  );
  if (!hasTopic) ctx.fail(topicPath, `missing ${TOPIC_FILE}`);
  const topic = hasTopic
    ? await ctx.attempt(async () =>
        buildTopic(await ctx.read(topicPath), topicPath, category, slug),
      )
    : null;
  const files = entries.filter((e) => !e.isDirectory());
  const demos = await loadDemos(ctx, rel, files);
  const hasDemoFiles = files.some((e) => e.name.endsWith(DEMO_SUFFIX));
  if (topic && !hasDemoFiles && !topic.appendix) {
    ctx.fail(
      topicPath,
      'a topic needs at least one demo unless it sets appendix',
    );
  }
  if (topic) topic.demos = demos;
  return topic;
}

async function loadCategory(ctx, category) {
  const rel = `${ROOT}/${category}`;
  const entries = await ctx.list(rel);
  for (const entry of entries.filter((e) => !e.isDirectory())) {
    ctx.fail(
      `${rel}/${entry.name}`,
      'unexpected file, expected topic folders only',
    );
  }
  const topics = await Promise.all(
    entries
      .filter((e) => e.isDirectory())
      .map((e) => loadTopic(ctx, category, e.name)),
  );
  return topics.filter(Boolean);
}

function checkNumbers(ctx, topics) {
  const first = new Map();
  for (const topic of topics) {
    const key = `${topic.category}:${topic.number}`;
    const other = first.get(key);
    if (other) {
      ctx.fail(
        topic.file,
        `topic number ${topic.number} in ${topic.category} is also used by ${other.file}`,
      );
    } else {
      first.set(key, topic);
    }
  }
}

function sortTopics(topics) {
  const order = (t) => CATEGORIES.findIndex((c) => c.id === t.category);
  return topics.sort(
    (a, b) =>
      order(a) - order(b) || a.number - b.number || (a.slug < b.slug ? -1 : 1),
  );
}

function compareText(x, y) {
  if (x < y) return -1;
  return x > y ? 1 : 0;
}

// Sorts out the top level: skips coverage/, reports files and unknown folders,
// and returns the known category ids.
function categoryIds(ctx, entries) {
  const ids = [];
  for (const entry of entries) {
    if (entry.name === SKIPPED && entry.isDirectory()) continue;
    const known = CATEGORIES.some((c) => c.id === entry.name);
    if (!entry.isDirectory()) {
      ctx.fail(
        `${ROOT}/${entry.name}`,
        'unexpected file, expected category folders only',
      );
    } else if (known) {
      ids.push(entry.name);
    } else {
      ctx.fail(`${ROOT}/${entry.name}`, `unknown category "${entry.name}"`);
    }
  }
  return ids;
}

// contentDir is the content/ folder itself.
export async function loadContent(contentDir, io = fs) {
  const ctx = createContext(contentDir, io);
  const ids = categoryIds(ctx, await ctx.list(ROOT));
  const topics = (
    await Promise.all(ids.map((id) => loadCategory(ctx, id)))
  ).flat();
  sortTopics(topics);
  checkNumbers(ctx, topics);
  return { topics, errors: ctx.errors.toSorted(compareText) };
}
