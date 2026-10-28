// The data files the shell reads: per-topic compat JSON, navigation, search
// index, sitemap and the service worker's precache list. Every URL in them
// carries the site base ("/HTML-Template/html/dialog/"), so it resolves
// inside the site and the service worker scope. The sitemap is absolute.

import { createHash } from 'node:crypto';
import { byText, resolveKey, topicBaseline } from './compat.mjs';
import { CATEGORIES, SITE, absoluteUrl, pageUrl } from './config.mjs';
import { escapeHtml } from './markdown.mjs';

const PRECACHE = 'precache.json';
const REFERENCE = '#reference';

const lastSegment = (key) => key.slice(key.lastIndexOf('.') + 1);
const uniqueSorted = (list) => [...new Set(list)].toSorted(byText);
const toPosix = (path) => path.replaceAll('\\', '/');

// --- TopicData ------------------------------------------------------------

function resolveDemo(demo, index, baseline, errors) {
  const features = [];
  for (const key of demo.features) {
    const resolved = resolveKey(key, index, baseline);
    if (resolved) features.push(resolved);
    else errors.push(`${demo.file}:1 unknown compat key "${key}"`);
  }
  return {
    id: demo.id,
    title: demo.title,
    runsIn: demo.runsIn,
    permissions: uniqueSorted(demo.permissions),
    detect: demo.detect,
    features,
  };
}

// The JSON written to data/compat/<category>/<slug>.json. Errors name the
// demo file of every key the compat data does not know.
export function buildTopicData(topic, { index, baseline, table, site = SITE }) {
  const errors = [];
  const demos = topic.demos.map((demo) =>
    resolveDemo(demo, index, baseline, errors),
  );
  const resolved = demos.flatMap((demo) => demo.features);
  const data = {
    url: pageUrl(topic.url, site),
    title: topic.title,
    number: topic.number,
    category: topic.category,
    interface: topic.interface,
    spec: [...topic.spec],
    mdn: topic.mdn,
    permissions: uniqueSorted(demos.flatMap((demo) => demo.permissions)),
    baseline: topicBaseline(resolved),
    demos,
    table,
  };
  return { data, errors };
}

// --- navigation -----------------------------------------------------------

const byNumber = (a, b) => a.number - b.number || byText(a.slug, b.slug);

export function buildNav(topics, { site = SITE } = {}) {
  return {
    categories: CATEGORIES.map(({ id, label }) => {
      const list = topics.filter((t) => t.category === id).toSorted(byNumber);
      return {
        id,
        label,
        count: list.length,
        topics: list.map((t) => ({
          slug: t.slug,
          title: t.title,
          number: t.number,
          url: pageUrl(t.url, site),
          demos: t.demos.length,
        })),
      };
    }),
  };
}

// --- search ---------------------------------------------------------------

const terms = (list) =>
  uniqueSorted(
    list
      .filter((t) => typeof t === 'string' && t !== '')
      .map((t) => t.toLowerCase()),
  );

// A row's depth counts the segments below its unit, so the unit is the key
// without them. That also finds units without a row of their own.
function unitKeys(rows) {
  return uniqueSorted(
    rows.map((row) => {
      const parts = row.key.split('.');
      return parts.slice(0, parts.length - row.depth).join('.');
    }),
  );
}

function topicEntries(topic, rows, site) {
  const url = pageUrl(topic.url, site);
  const label = CATEGORIES.find((c) => c.id === topic.category)?.label;
  const base = { category: topic.category };
  return [
    {
      type: 'topic',
      title: topic.title,
      url,
      ...base,
      terms: terms([topic.slug, topic.category, label, topic.interface]),
    },
    ...topic.demos.map((demo) => ({
      type: 'demo',
      title: demo.title,
      url: `${url}#${demo.id}`,
      ...base,
      terms: terms([demo.slug, ...demo.features]),
    })),
    ...unitKeys(rows).map((key) => ({
      type: 'feature',
      title: lastSegment(key),
      url: url + REFERENCE,
      ...base,
      terms: terms([key]),
    })),
  ];
}

// tablesByTopic is keyed by the topic's own url ("/html/dialog/").
export function buildSearchIndex(topics, tablesByTopic, { site = SITE } = {}) {
  return topics
    .flatMap((topic) =>
      topicEntries(topic, tablesByTopic.get(topic.url) ?? [], site),
    )
    .toSorted(
      (a, b) =>
        byText(a.type, b.type) ||
        byText(a.url, b.url) ||
        byText(a.title, b.title),
    );
}

// --- sitemap --------------------------------------------------------------

export function buildSitemap(urls, site) {
  const locs = uniqueSorted(urls.map((url) => absoluteUrl(toPosix(url), site)));
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...locs.map((loc) => `  <url><loc>${escapeHtml(loc)}</loc></url>`),
    '</urlset>',
    '',
  ].join('\n');
}

// --- precache -------------------------------------------------------------

const hex = (data) => createHash('sha256').update(data).digest('hex');

// "html/dialog/index.html" -> "/HTML-Template/html/dialog/"; other files
// keep their name ("/HTML-Template/data/nav.json").
function siteUrl(path, site) {
  if (path === 'index.html') return pageUrl('/', site);
  const page = path.endsWith('/index.html') ? path.slice(0, -10) : path;
  return pageUrl(page, site);
}

export function buildPrecache(files, { site = SITE } = {}) {
  const entries = [...files]
    .map(([path, content]) => [toPosix(path), content])
    .filter(([path]) => path !== PRECACHE)
    .toSorted(([a], [b]) => byText(a, b));
  const lines = entries.map(([path, content]) => `${path}\0${hex(content)}`);
  return {
    version: hex(lines.join('\n')).slice(0, 16),
    urls: entries.map(([path]) => siteUrl(path, site)).toSorted(byText),
  };
}
