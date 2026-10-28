// The build orchestrator: content and compat data in, the static site out.
// buildSite is pure (a map of POSIX paths to text); main reads the project,
// runs the coverage gate, and writes the files below dist/.

import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { indexBaseline, indexCompat } from './compat.mjs';
import { SITE, absoluteUrl } from './config.mjs';
import { loadContent } from './content.mjs';
import { main as runCoverage, serializeList } from './coverage.mjs';
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
  files.set('precache.json', serializeList(buildPrecache(files, { site })));
  return { files: new Map([...files].toSorted(byPath)), errors };
}

// out must lie strictly below <root>/dist, so a mistaken value can never
// make the build delete the project or anything beside it.
function safeOut(root, out) {
  const target = resolve(root, out);
  const away = relative(resolve(root, DIST), target);
  const inside = away !== '' && !away.startsWith('..') && !isAbsolute(away);
  return inside ? target : null;
}

async function writeFiles(dir, files) {
  await rm(dir, { recursive: true, force: true });
  await Promise.all(
    [...files].map(async ([path, text]) => {
      const target = join(dir, path);
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, text.replaceAll('\r\n', '\n'));
    }),
  );
}

export async function main(
  argv,
  {
    root = process.cwd(),
    out = DEFAULT_OUT,
    env = process.env,
    stdout,
    stderr,
    load = loadCompatData,
  } = {},
) {
  const rootDir = resolve(root);
  const outDir = safeOut(rootDir, out);
  if (outDir === null) {
    stderr.write(
      `build: refusing to use "${out}" as the output folder, it must be a folder below ${DIST}/\n`,
    );
    return 1;
  }
  const data = await load();
  const content = await loadContent(join(rootDir, 'content'));
  if (content.errors.length > 0) {
    stderr.write(
      `${content.errors.join('\n')}\n\nbuild: failed (${content.errors.length} content problem(s))\n`,
    );
    return 1;
  }
  const gate = await runCoverage([], {
    root: rootDir,
    env,
    stdout,
    stderr,
    load: async () => data,
  });
  if (gate !== 0) return gate;

  const exclusions = JSON.parse(
    await readFile(join(rootDir, 'content/coverage/exclusions.json'), 'utf8'),
  );
  const { files, errors } = buildSite({
    topics: content.topics,
    index: indexCompat(data.bcd),
    baseline: indexBaseline(data.webFeatures),
    exclusions,
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
