import { test } from 'node:test';
import assert from 'node:assert/strict';
import { indexBaseline, indexCompat } from '../../scripts/build/compat.mjs';
import { BROWSER_LABELS, SITE } from '../../scripts/build/config.mjs';
import { buildCsp } from '../../scripts/build/csp.mjs';
import { buildNav, buildTopicData } from '../../scripts/build/outputs.mjs';
import {
  baselineLabel,
  renderHomePage,
  renderTopicPage,
  supportLabel,
} from '../../scripts/build/render.mjs';
import { referenceTable, tableRootsFor } from '../../scripts/build/tables.mjs';
import { makeTopic, miniBcd, miniWebFeatures } from './helpers/fixtures.mjs';

const index = indexCompat(miniBcd());
const baseline = indexBaseline(miniWebFeatures());
const csp = buildCsp({ previewOrigin: SITE.previewOrigin });

function page(topic = makeTopic(), extra = {}) {
  const table = referenceTable(tableRootsFor(topic, index), index, () => false);
  const { data } = buildTopicData(topic, { index, baseline, table });
  return renderTopicPage(topic, { ...data, ...extra }, { csp });
}

const count = (text, part) => text.split(part).length - 1;

test('renderTopicPage escapes titles and code, and adds no script', () => {
  const base = makeTopic();
  const topic = makeTopic({
    title: '<Dialog> & "modal"',
    demos: [
      {
        ...base.demos[0],
        code: {
          html: '</script><img src=x onerror=alert(1)>',
          css: '',
          js: '',
        },
      },
    ],
  });
  const html = page(topic);
  assert.ok(html.includes('&lt;Dialog&gt; &amp; &quot;modal&quot;'));
  assert.ok(html.includes('&lt;/script&gt;&lt;img'));
  assert.ok(!html.includes('<script'));
  assert.ok(!html.includes('<img'));
  assert.ok(!html.includes('<style'));
  assert.ok(!html.includes(' style='));
  assert.ok(html.includes('id="demo-1"'));
  assert.ok(html.includes('<html lang="en">'));
  assert.ok(
    html.includes(
      `<meta http-equiv="Content-Security-Policy" content="${csp.replaceAll("'", '&#39;')}">`,
    ),
  );
  // Empty CSS and JS tabs render no block.
  assert.ok(html.includes('<code class="language-html">'));
  assert.ok(!html.includes('language-css'));
  assert.ok(!html.includes('language-js'));
});

test('renderTopicPage has the document head and page structure', () => {
  const html = page();
  assert.ok(html.startsWith('<!doctype html>\n<html lang="en">'));
  assert.ok(html.includes('<meta charset="utf-8">'));
  assert.ok(
    html.includes(
      '<meta name="viewport" content="width=device-width, initial-scale=1">',
    ),
  );
  assert.ok(html.includes('<title>Dialog · HTML-Template</title>'));
  assert.ok(
    html.includes(
      '<link rel="canonical" href="https://vectode.github.io/HTML-Template/html/dialog/">',
    ),
  );
  assert.ok(html.includes('<meta name="description" content="A modal'));
  assert.equal(count(html, '<main'), 1);
  assert.equal(count(html, '<h1'), 1);
  assert.ok(html.includes('<p class="lede">A modal or non-modal box.</p>'));
  assert.ok(html.includes('<p>Body text.</p>'));
  assert.ok(html.includes('<a href="/HTML-Template/">HTML-Template</a>'));
  assert.ok(html.endsWith('</html>\n'));
});

test('renderTopicPage renders one section per demo with its notes', () => {
  const html = page();
  assert.ok(
    html.includes('<section id="demo-1" aria-labelledby="demo-1-title">'),
  );
  assert.ok(html.includes('<h2 id="demo-1-title">'));
  assert.ok(html.includes('id="demo-2"'));
  assert.ok(html.includes('When to use demo 1.'));
  assert.ok(html.includes('Focus moves into the dialog.'));
  assert.ok(html.includes('Fallback 2.'));
  // Demo 2 has no a11y note, so the page has exactly one.
  assert.equal(count(html, 'class="demo-a11y"'), 1);
  assert.ok(html.includes('<code class="language-css">dialog{}</code>'));
  assert.ok(html.includes('<code class="language-js">d()</code>'));
  // Permission labels come from the PERMISSIONS table.
  assert.ok(html.includes('Camera, Fullscreen'));
});

test('renderTopicPage headings run in order', () => {
  const topic = makeTopic({ bodyHtml: '<h2>Usage</h2><h3>Detail</h3>' });
  const levels = [...page(topic).matchAll(/<h(\d)/g)].map((m) => Number(m[1]));
  for (let i = 1; i < levels.length; i++) {
    assert.ok(
      levels[i] <= levels[i - 1] + 1,
      `h${levels[i]} after h${levels[i - 1]}`,
    );
  }
  assert.equal(levels[0], 1);
});

test('renderTopicPage renders the reference table accessibly', () => {
  const html = page();
  assert.ok(html.includes('<table>'));
  assert.ok(html.includes('<caption>'));
  assert.ok(html.includes('<th scope="col">Feature</th>'));
  for (const label of Object.values(BROWSER_LABELS)) {
    assert.ok(html.includes(`<th scope="col">${label}</th>`), label);
  }
  assert.equal(count(html, '<th scope="row"'), 3);
  assert.ok(html.includes('<code>closedby</code>'));
  assert.ok(html.includes('data-depth="1"'));
  assert.ok(html.includes('<td>15.4</td>'));
});

test('renderTopicPage says so when the table is empty', () => {
  const html = page(makeTopic(), { table: [] });
  assert.ok(!html.includes('<table'));
  assert.ok(html.includes('No reference entries'));
});

test('renderTopicPage spec plate: Baseline, interface, permission, spec', () => {
  const html = page();
  assert.ok(html.includes('Newly available (Baseline 2025)'));
  assert.ok(html.includes('<code>HTMLDialogElement</code>'));
  assert.ok(
    html.includes(
      '<a href="https://html.spec.whatwg.org/multipage/interactive-elements.html">',
    ),
  );
  assert.ok(
    html.includes(
      '<a href="https://developer.mozilla.org/docs/Web/HTML/Element/dialog">',
    ),
  );
  const unknown = page(makeTopic(), { baseline: { status: null, year: null } });
  assert.ok(unknown.includes('Baseline unknown'));
  assert.ok(!unknown.includes('Limited'));
  const bare = page(makeTopic({ interface: null, mdn: null }), {
    permissions: [],
    mdn: null,
    interface: null,
  });
  assert.ok(bare.includes('None'));
  assert.ok(!bare.includes('<dt>MDN</dt>'));
  assert.ok(!bare.includes('MDN Web Docs'));
});

test('renderTopicPage escapes quotes in link targets', () => {
  const html = page(makeTopic(), {
    spec: ['https://x.test/"onmouseover="a'],
  });
  assert.ok(html.includes('href="https://x.test/&quot;onmouseover=&quot;a"'));
  assert.ok(!html.includes('"onmouseover="'));
});

test('renderTopicPage builds its own CSP when none is passed', () => {
  const topic = makeTopic();
  const { data } = buildTopicData(topic, { index, baseline, table: [] });
  const html = renderTopicPage(topic, data, {});
  assert.ok(html.includes('frame-src https://html-template-preview.pages.dev'));
});

test('baselineLabel renders every status, null as unknown', () => {
  assert.equal(
    baselineLabel({ status: 'high', year: 2020 }),
    'Widely available (Baseline 2020)',
  );
  assert.equal(
    baselineLabel({ status: 'high', year: null }),
    'Widely available',
  );
  assert.equal(
    baselineLabel({ status: 'low', year: 2025 }),
    'Newly available (Baseline 2025)',
  );
  assert.equal(baselineLabel({ status: 'low', year: null }), 'Newly available');
  assert.equal(
    baselineLabel({ status: false, year: null }),
    'Limited availability',
  );
  assert.equal(baselineLabel({ status: null, year: null }), 'Baseline unknown');
  assert.equal(baselineLabel(null), 'Baseline unknown');
});

test('supportLabel covers the support shapes compat.mjs returns', () => {
  assert.equal(supportLabel({ added: '37' }), '37');
  assert.equal(supportLabel({ added: '4', approx: true }), '≤4');
  assert.equal(supportLabel({ added: false }), 'No');
  assert.equal(supportLabel({ added: null }), 'Unknown');
  assert.equal(supportLabel({ added: 'preview' }), 'Preview');
  assert.equal(
    supportLabel({ added: '20', removed: '60' }),
    '20, removed in 60',
  );
  assert.equal(
    supportLabel({
      added: '18',
      partial: true,
      prefix: '-webkit-',
      altName: 'webkitZoom',
      flags: true,
    }),
    '18 (partial, prefix -webkit-, as webkitZoom, behind a flag)',
  );
  assert.equal(supportLabel(undefined), 'Unknown');
});

test('reference rows mark status flags', () => {
  const topic = makeTopic({
    category: 'css',
    slug: 'zoom',
    url: '/css/zoom/',
    demos: [{ ...makeTopic().demos[0], features: ['css.properties.zoom'] }],
  });
  const html = page(topic);
  assert.ok(html.includes('Experimental'));
  assert.ok(html.includes('Deprecated'));
  assert.ok(html.includes('Non-standard'));
  assert.ok(html.includes('<td>No</td>'));
  assert.ok(html.includes('<td>Preview</td>'));
});

test('renderHomePage lists categories, counts and topic links', () => {
  const nav = buildNav([makeTopic()]);
  const html = renderHomePage(nav, { site: SITE, csp });
  assert.ok(html.startsWith('<!doctype html>\n<html lang="en">'));
  assert.ok(html.includes('<title>HTML-Template</title>'));
  assert.ok(
    html.includes(
      '<link rel="canonical" href="https://vectode.github.io/HTML-Template/">',
    ),
  );
  assert.equal(count(html, '<h1'), 1);
  assert.equal(count(html, '<h2'), 4);
  assert.ok(html.includes('<a href="/HTML-Template/html/dialog/">'));
  assert.ok(html.includes('2 demos'));
  assert.ok(html.includes('No topics yet.'));
  assert.ok(!html.includes('<script'));
  assert.ok(html.includes('http-equiv="Content-Security-Policy"'));
});

test('renderHomePage escapes nav text and uses defaults', () => {
  const nav = buildNav([
    makeTopic({ title: '<b>"x"</b>', demos: [makeTopic().demos[0]] }),
  ]);
  const html = renderHomePage(nav, {});
  assert.ok(html.includes('&lt;b&gt;&quot;x&quot;&lt;/b&gt;'));
  assert.ok(html.includes('1 demo<'));
  assert.ok(html.includes('frame-src https://html-template-preview.pages.dev'));
});

test('renderTopicPage refuses data that belongs to another topic', () => {
  const topic = makeTopic();
  const { data } = buildTopicData(topic, { index, baseline, table: [] });
  const wrong = [
    { ...data, url: '/HTML-Template/css/grid/' },
    { ...data, url: topic.url },
    { ...data, category: 'css' },
    { ...data, demos: data.demos.slice(1) },
    { ...data, demos: [data.demos[1], data.demos[0]] },
  ];
  for (const other of wrong) {
    assert.throws(
      () => renderTopicPage(topic, other, { csp }),
      /does not belong/,
    );
  }
});

test('renderTopicPage requires https:// spec and MDN links', () => {
  for (const extra of [
    { spec: ['javascript:alert(1)'] },
    { spec: ['http://x.test/'] },
    { mdn: 'data:text/html,x' },
    { mdn: '//x.test/' },
  ]) {
    assert.throws(
      () => page(makeTopic(), extra),
      /must start with https:\/\//,
      JSON.stringify(extra),
    );
  }
});

test('main can take focus from the skip link', () => {
  assert.ok(page().includes('<main id="main" tabindex="-1">'));
});
