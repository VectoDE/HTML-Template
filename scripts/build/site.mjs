// The build orchestrator: content and compat data in, the static site out.
// buildSite is pure (a map of POSIX paths to text); main reads the project,
// and writes the files below dist/. The coverage gate is its own step
// (npm run coverage).

import { lstat, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { indexBaseline, indexCompat } from './compat.mjs';
import { SITE, absoluteUrl } from './config.mjs';
import { loadContent } from './content.mjs';
import { serializeList } from './coverage.mjs';
import { loadCompatData } from './data.mjs';
import {
  buildNav,
  buildPrecache,
  buildSearchIndex,
  buildSitemap,
  buildTopicData,
} from './outputs.mjs';
import { renderHomePage, renderTopicPage } from './render.mjs';
import { referenceTable, tableRootsFor } from './tables.mjs';
import { makeExcluded } from './units.mjs';

const DEFAULT_OUT = 'dist/site';
const DIST = 'dist';

const byPath = ([a], [b]) => {
  if (a < b) return -1;
  return a > b ? 1 : 0;
};

export function buildSite({
  topics,
  index,
  baseline,
  exclusions,
  site = SITE,
}) {
  const excluded = makeExcluded(exclusions);
  const tablesByTopic = new Map(
    topics.map((topic) => [
      topic.url,
      referenceTable(tableRootsFor(topic, index), index, excluded),
    ]),
  );
  const errors = [];
  const built = topics.map((topic) => {
    const table = tablesByTopic.get(topic.url);
    const result = buildTopicData(topic, { index, baseline, table, site });
    errors.push(...result.errors);
    return { topic, data: result.data };
  });
  if (errors.length > 0) return { files: new Map(), errors };

  const nav = buildNav(topics, { site });
  const files = new Map([
    ['index.html', renderHomePage(nav, { site })],
    ['data/nav.json', serializeList(nav)],
    [
      'data/search-index.json',
      serializeList(buildSearchIndex(topics, tablesByTopic, { site })),
    ],
    [
      'sitemap.xml',
      buildSitemap(['/', ...topics.map((topic) => topic.url)], site),
    ],
    [
      'robots.txt',
      `User-agent: *\nAllow: /\n\nSitemap: ${absoluteUrl('sitemap.xml', site)}\n`,
    ],
  ]);
  for (const { topic, data } of built) {
    files.set(
      `${topic.category}/${topic.slug}/index.html`,
      renderTopicPage(topic, data, { site }),
    );
    files.set(
      `data/compat/${topic.category}/${topic.slug}.json`,
      serializeList(data),
    );
  }
  // LF only, so the precache hashes match the bytes that get written.
  const lf = new Map(
    [...files].map(([path, text]) => [path, text.replaceAll('\r\n', '\n')]),
  );
  lf.set('precache.json', serializeList(buildPrecache(lf, { site })));
  return { files: new Map([...lf].toSorted(byPath)), errors };
}

// out must lie strictly below <root>/dist, so a mistaken value can never
// make the build delete the project or anything beside it.
function safeOut(root, out) {
  const target = resolve(root, out);
  const away = relative(resolve(root, DIST), target);
  const inside = away !== '' && !away.startsWith('..') && !isAbsolute(away);
  return inside ? target : null;
}

// True when dist or any folder on the way to out is a link (symlink or
// junction): rm would then follow it out of the project.
async function hasLink(root, target) {
  const dist = resolve(root, DIST);
  const steps = relative(dist, target).split(sep);
  let path = dist;
  for (const step of ['', ...steps]) {
    path = join(path, step);
    try {
      if ((await lstat(path)).isSymbolicLink()) return true;
    } catch (error) {
      if (error?.code === 'ENOENT') return false;
      throw error;
    }
  }
  return false;
}

async function writeFiles(dir, files) {
  await rm(dir, { recursive: true, force: true });
  await Promise.all(
    [...files].map(async ([path, text]) => {
      const target = join(dir, path);
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, text);
    }),
  );
}

async function readExclusions(root) {
  try {
    return JSON.parse(
      await readFile(join(root, 'content/coverage/exclusions.json'), 'utf8'),
    );
  } catch (error) {
    if (error?.code === 'ENOENT') return [];
    throw error;
  }
}

export async function main(
  argv,
  {
    root = process.cwd(),
    out = DEFAULT_OUT,
    stdout,
    stderr,
    load = loadCompatData,
  } = {},
) {
  if (argv.length > 0) {
    stderr.write(`build: unknown option ${argv.join(' ')}. Usage: build.mjs\n`);
    return 1;
  }
  const rootDir = resolve(root);
  const outDir = safeOut(rootDir, out);
  if (outDir === null || (await hasLink(rootDir, outDir))) {
    stderr.write(
      `build: refusing to use "${out}" as the output folder, it must be a real folder below ${DIST}/\n`,
    );
    return 1;
  }
  const content = await loadContent(join(rootDir, 'content'));
  if (content.errors.length > 0) {
    stderr.write(
      `${content.errors.join('\n')}\n\nbuild: failed (${content.errors.length} content problem(s))\n`,
    );
    return 1;
  }
  const data = await load();
  const { files, errors } = buildSite({
    topics: content.topics,
    index: indexCompat(data.bcd),
    baseline: indexBaseline(data.webFeatures),
    exclusions: await readExclusions(rootDir),
  });
  if (errors.length > 0) {
    stderr.write(
      `${errors.join('\n')}\n\nbuild: failed (${errors.length} problem(s))\n`,
    );
    return 1;
  }
  await writeFiles(outDir, files);
  const demos = content.topics.reduce((sum, t) => sum + t.demos.length, 0);
  const shown = relative(rootDir, outDir).replaceAll('\\', '/');
  stdout.write(
    `build: ${files.size} files, ${content.topics.length} topics, ${demos} demos -> ${shown}\n`,
  );
  return 0;
}
