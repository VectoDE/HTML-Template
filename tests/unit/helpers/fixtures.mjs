import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

// Writes { 'a/b.txt': 'text' } below dir, creating folders as needed.
export async function writeTree(dir, files) {
  await Promise.all(
    Object.entries(files).map(async ([rel, text]) => {
      const target = join(dir, rel);
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, text);
    }),
  );
}

const TRACKED = [
  'chrome',
  'chrome_android',
  'edge',
  'firefox',
  'firefox_android',
  'safari',
  'safari_ios',
];

// One statement per tracked browser, each added in the given version.
function everywhere(version, overrides = {}) {
  const support = {};
  for (const browser of TRACKED) support[browser] = { version_added: version };
  return { ...support, ...overrides };
}

function compat(support, extra = {}) {
  return {
    __compat: {
      mdn_url: 'https://developer.mozilla.org/docs/Web/Test',
      spec_url: 'https://example.test/spec',
      status: { experimental: false, deprecated: false, standard_track: true },
      support,
      ...extra,
    },
  };
}

// A hand-built slice of @mdn/browser-compat-data.
export function miniBcd() {
  const noIos = everywhere('10');
  delete noIos.safari_ios;
  return {
    __meta: { version: '0.0.0-test' },
    browsers: { chrome: { name: 'Chrome' } },
    html: {
      elements: {
        dialog: {
          ...compat(everywhere('37', { safari: { version_added: '15.4' } })),
          closedby: compat(everywhere('134')),
          open: compat(
            everywhere('37', {
              chrome: { version_added: '37', partial_implementation: true },
            }),
          ),
        },
      },
    },
    css: {
      properties: {
        zoom: compat(
          everywhere('1', {
            chrome: [
              { prefix: '-webkit-', version_added: '18' },
              {
                version_added: '30',
                flags: [{ type: 'preference', name: 'zoom' }],
              },
              { version_added: '42' },
            ],
            edge: [{ prefix: '-webkit-', version_added: '18' }],
            firefox: [
              {
                version_added: '55',
                flags: [{ type: 'preference', name: 'zoom' }],
              },
            ],
            firefox_android: { version_added: false },
            safari: { version_added: 'preview' },
          }),
          {
            spec_url: ['https://example.test/a', 'https://example.test/b'],
            status: {
              experimental: true,
              deprecated: true,
              standard_track: false,
            },
          },
        ),
      },
    },
    api: {
      Old: compat({
        chrome: [{ version_added: '20', version_removed: '60' }],
        chrome_android: { version_added: false },
        edge: { version_added: false },
        firefox: { version_added: false },
        firefox_android: { version_added: false },
        safari: { version_added: '≤4', version_removed: '12' },
        safari_ios: { version_added: false },
      }),
      NoIos: compat(noIos),
    },
  };
}

// A hand-built slice of web-features/data.json.
export function miniWebFeatures() {
  return {
    features: {
      dialog: {
        kind: 'feature',
        compat_features: [
          'html.elements.dialog',
          'html.elements.dialog.closedby',
          'html.elements.dialog.open',
        ],
        status: {
          baseline: 'high',
          baseline_low_date: '2022-03-14',
          baseline_high_date: '2024-09-14',
          by_compat_key: {
            'html.elements.dialog.closedby': {
              baseline: 'low',
              baseline_low_date: '2025-05-01',
            },
          },
        },
      },
      zoom: {
        kind: 'feature',
        compat_features: ['css.properties.zoom'],
        status: {
          baseline: 'high',
          baseline_low_date: '≤2020-03-24',
          baseline_high_date: '≤2022-09-24',
        },
      },
      'no-baseline': {
        kind: 'feature',
        compat_features: ['api.NoIos'],
        status: { baseline: false },
      },
      'old-name': {
        kind: 'moved',
        redirect_target: 'dialog',
        compat_features: ['api.Old'],
      },
    },
  };
}
