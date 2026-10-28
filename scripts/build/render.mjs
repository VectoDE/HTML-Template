// Stage-2 pages: plain semantic HTML with no script and no style, so the
// CSP needs no hashes. Stage 3 replaces renderTopicPage and renderHomePage
// with the real shell and keeps their signatures. Every text is escaped;
// bodyHtml comes from renderMarkdown, which escapes on its own.

import {
  BROWSERS,
  BROWSER_LABELS,
  CATEGORIES,
  PERMISSIONS,
  SITE,
  absoluteUrl,
  pageUrl,
} from './config.mjs';
import { byText } from './compat.mjs';
import { buildCsp } from './csp.mjs';
import { escapeHtml } from './markdown.mjs';

const LANGS = [
  ['html', 'HTML'],
  ['css', 'CSS'],
  ['js', 'JS'],
];
const DESCRIPTION = 'An interactive reference for HTML, CSS and JavaScript.';

const link = (href, text) =>
  `<a href="${escapeHtml(href)}">${escapeHtml(text)}</a>`;
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

// --- labels ---------------------------------------------------------------

const BASELINE = { high: 'Widely available', low: 'Newly available' };

// null means the data has no Baseline for some key: unknown, never limited.
export function baselineLabel(baseline) {
  const status = baseline?.status ?? null;
  if (status === null) return 'Baseline unknown';
  if (status === false) return 'Limited availability';
  const year = baseline.year;
  return year === null
    ? BASELINE[status]
    : `${BASELINE[status]} (Baseline ${year})`;
}

function addedText(support) {
  const added = support?.added;
  if (added === false) return 'No';
  if (typeof added !== 'string') return 'Unknown';
  if (added === 'preview') return 'Preview';
  return support.approx ? `≤${added}` : added;
}

export function supportLabel(support) {
  let text = addedText(support);
  if (typeof support?.removed === 'string') {
    text += `, removed in ${support.removed}`;
  }
  const notes = [
    support?.partial && 'partial',
    support?.prefix && `prefix ${support.prefix}`,
    support?.altName && `as ${support.altName}`,
    support?.flags && 'behind a flag',
  ].filter(Boolean);
  return notes.length === 0 ? text : `${text} (${notes.join(', ')})`;
}

function permissionText(names) {
  if (names.length === 0) return 'None';
  return [...new Set(names)]
    .toSorted(byText)
    .map((name) => PERMISSIONS[name]?.label ?? name)
    .join(', ');
}

// --- document -------------------------------------------------------------

function documentHtml({ site, csp, title, description, path, main }) {
  return [
    '<!doctype html>',
    '<html lang="en">',
    '<head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<meta http-equiv="Content-Security-Policy" content="${escapeHtml(csp)}">`,
    `<title>${escapeHtml(title)}</title>`,
    `<meta name="description" content="${escapeHtml(description)}">`,
    `<link rel="canonical" href="${escapeHtml(absoluteUrl(path, site))}">`,
    '</head>',
    '<body>',
    '<a href="#main">Skip to content</a>',
    `<header>${link(pageUrl('/', site), site.name)}</header>`,
    '<main id="main">',
    main,
    '</main>',
    '</body>',
    '</html>',
    '',
  ].join('\n');
}

const cspFor = (site, csp) =>
  csp ?? buildCsp({ previewOrigin: site.previewOrigin });

// --- topic page -----------------------------------------------------------

function breadcrumb(topic, site) {
  const label = CATEGORIES.find((c) => c.id === topic.category)?.label;
  return [
    '<nav aria-label="Breadcrumb"><ol>',
    `<li>${link(pageUrl('/', site), 'Home')}</li>`,
    `<li>${escapeHtml(label ?? topic.category)}</li>`,
    `<li aria-current="page">${escapeHtml(topic.title)}</li>`,
    '</ol></nav>',
  ].join('');
}

function plateRow(term, html) {
  return `<dt>${term}</dt><dd>${html}</dd>`;
}

function specPlate(topic, data) {
  const iface = data.interface
    ? `<code>${escapeHtml(data.interface)}</code>`
    : 'None';
  const specs = data.spec.map((url) => link(url, url)).join(', ');
  return [
    '<dl class="spec-plate">',
    plateRow('Topic', escapeHtml(`${data.number}. ${topic.title}`)),
    plateRow('Baseline', escapeHtml(baselineLabel(data.baseline))),
    plateRow('Interface', iface),
    plateRow('Permission', escapeHtml(permissionText(data.permissions))),
    plateRow('Demos', String(topic.demos.length)),
    plateRow('Spec', specs),
    data.mdn ? plateRow('MDN', link(data.mdn, 'MDN Web Docs')) : '',
    '</dl>',
  ].join('');
}

function note(cls, label, text) {
  return `<p class="${cls}"><strong>${label}:</strong> ${escapeHtml(text)}</p>`;
}

function codeBlocks(code) {
  return LANGS.filter(([lang]) => code[lang] !== '').map(
    ([lang, label]) =>
      `<figure><figcaption>${label}</figcaption><pre><code class="language-${lang}">${escapeHtml(code[lang])}</code></pre></figure>`,
  );
}

function demoSection(demo) {
  const heading = `${demo.id}-title`;
  const title = escapeHtml(`${demo.n}. ${demo.title}`);
  return [
    `<section id="${demo.id}" aria-labelledby="${heading}">`,
    `<h2 id="${heading}">${title}</h2>`,
    `<p class="demo-summary">${escapeHtml(demo.summary)}</p>`,
    demo.a11y ? note('demo-a11y', 'Accessibility', demo.a11y) : '',
    note('demo-fallback', 'Fallback', demo.fallback),
    demo.permissions.length > 0
      ? note('demo-permission', 'Permission', permissionText(demo.permissions))
      : '',
    ...codeBlocks(demo.code),
    '</section>',
  ]
    .filter(Boolean)
    .join('\n');
}

function rowStatus(status) {
  const marks = [
    status.experimental && 'Experimental',
    status.deprecated && 'Deprecated',
    !status.standard && 'Non-standard',
  ].filter(Boolean);
  return marks.length === 0
    ? ''
    : ` <span class="row-status">${marks.join(', ')}</span>`;
}

function tableRow(row) {
  const cells = BROWSERS.map(
    (browser) => `<td>${escapeHtml(supportLabel(row.support[browser]))}</td>`,
  );
  return [
    `<tr data-depth="${row.depth}">`,
    `<th scope="row"><code>${escapeHtml(row.name)}</code>${rowStatus(row.status)}</th>`,
    ...cells,
    '</tr>',
  ].join('');
}

function referenceTable(topic, rows) {
  if (rows.length === 0) {
    return '<p>No reference entries for this topic.</p>';
  }
  const heads = BROWSERS.map(
    (browser) => `<th scope="col">${escapeHtml(BROWSER_LABELS[browser])}</th>`,
  );
  return [
    '<table>',
    `<caption>Browser support for each part of ${escapeHtml(topic.title)}</caption>`,
    `<thead><tr><th scope="col">Feature</th>${heads.join('')}</tr></thead>`,
    '<tbody>',
    ...rows.map(tableRow),
    '</tbody>',
    '</table>',
  ].join('\n');
}

export function renderTopicPage(topic, data, { site = SITE, csp } = {}) {
  const main = [
    breadcrumb(topic, site),
    `<h1>${escapeHtml(topic.title)}</h1>`,
    `<p class="lede">${escapeHtml(topic.lede)}</p>`,
    specPlate(topic, data),
    topic.bodyHtml,
    ...topic.demos.map(demoSection),
    '<section id="reference" aria-labelledby="reference-title">',
    '<h2 id="reference-title">Browser support</h2>',
    referenceTable(topic, data.table),
    '</section>',
  ]
    .filter(Boolean)
    .join('\n');
  return documentHtml({
    site,
    csp: cspFor(site, csp),
    title: `${topic.title} · ${site.name}`,
    description: topic.lede,
    path: topic.url,
    main,
  });
}

// --- home page ------------------------------------------------------------

function topicItem(topic, site) {
  const text = `${topic.number}. ${topic.title}`;
  const demos = plural(topic.demos, 'demo');
  return `<li>${link(pageUrl(topic.url, site), text)} <span class="demo-count">${demos}</span></li>`;
}

function categorySection(category, site) {
  const heading = `category-${category.id}`;
  const list =
    category.topics.length === 0
      ? '<p>No topics yet.</p>'
      : `<ul>${category.topics.map((t) => topicItem(t, site)).join('')}</ul>`;
  return [
    `<section aria-labelledby="${escapeHtml(heading)}">`,
    `<h2 id="${escapeHtml(heading)}">${escapeHtml(category.label)} <span class="count">(${category.count})</span></h2>`,
    list,
    '</section>',
  ].join('\n');
}

export function renderHomePage(nav, { site = SITE, csp } = {}) {
  const main = [
    `<h1>${escapeHtml(site.name)}</h1>`,
    `<p class="lede">${escapeHtml(DESCRIPTION)}</p>`,
    ...nav.categories.map((c) => categorySection(c, site)),
  ].join('\n');
  return documentHtml({
    site,
    csp: cspFor(site, csp),
    title: site.name,
    description: DESCRIPTION,
    path: '/',
    main,
  });
}
