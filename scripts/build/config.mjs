// Shared build constants, plus two helpers that turn site paths into URLs.

export const CATEGORIES = Object.freeze([
  { id: 'html', label: 'HTML' },
  { id: 'css', label: 'CSS' },
  { id: 'js', label: 'JS APIs' },
  { id: 'recipes', label: 'Recipes' },
]);

// First segment of a browser-compat-data key. Demos may also list http and
// webassembly keys; whether a key exists is checked against the data later.
export const NAMESPACES = Object.freeze([
  'html',
  'css',
  'api',
  'javascript',
  'svg',
  'mathml',
  'http',
  'webassembly',
]);

// Permissions-Policy tokens a demo may request. `allow` is the iframe allow
// token, or null when no such token exists (the API needs no delegation).
const SAME = (label) => ({ allow: undefined, label });
const NONE = (label) => ({ allow: null, label });

const RAW = {
  camera: SAME('Camera'),
  microphone: SAME('Microphone'),
  geolocation: SAME('Location'),
  notifications: NONE('Notifications'),
  push: NONE('Push messages'),
  'clipboard-read': SAME('Clipboard read'),
  'clipboard-write': SAME('Clipboard write'),
  'display-capture': SAME('Screen capture'),
  fullscreen: SAME('Fullscreen'),
  bluetooth: SAME('Bluetooth'),
  usb: SAME('USB'),
  serial: SAME('Serial ports'),
  hid: SAME('HID devices'),
  payment: SAME('Payment'),
  'publickey-credentials-get': SAME('Passkey sign-in'),
  'publickey-credentials-create': SAME('Passkey creation'),
  'screen-wake-lock': SAME('Screen wake lock'),
  'web-share': SAME('Web Share'),
  accelerometer: SAME('Accelerometer'),
  gyroscope: SAME('Gyroscope'),
  magnetometer: SAME('Magnetometer'),
  'ambient-light-sensor': SAME('Ambient light'),
  'idle-detection': SAME('Idle detection'),
  midi: SAME('MIDI'),
  'local-fonts': SAME('Local fonts'),
  'picture-in-picture': SAME('Picture-in-picture'),
  'storage-access': SAME('Storage access'),
  'compute-pressure': SAME('Compute pressure'),
  nfc: NONE('NFC'),
  'persistent-storage': NONE('Persistent storage'),
};

export const PERMISSIONS = Object.freeze(
  Object.fromEntries(
    Object.entries(RAW).map(([name, p]) => [
      name,
      Object.freeze({
        allow: p.allow === undefined ? name : p.allow,
        label: p.label,
      }),
    ]),
  ),
);

// Browsers the reference tracks, as named in browser-compat-data.
export const BROWSERS = Object.freeze([
  'chrome',
  'chrome_android',
  'edge',
  'firefox',
  'firefox_android',
  'safari',
  'safari_ios',
]);

export const BROWSER_LABELS = Object.freeze({
  chrome: 'Chrome',
  chrome_android: 'Chrome Android',
  edge: 'Edge',
  firefox: 'Firefox',
  firefox_android: 'Firefox for Android',
  safari: 'Safari',
  safari_ios: 'Safari on iOS',
});

// Which browser-compat-data keys count for coverage (spec §8.4, plan calls 5
// and 6). Keys `depth` segments below `prefix` are units (depth defaults to
// 1). Feature units need a demo; table units are claimed by a topic's
// `tables:` list. Every http.<group>.<name> counts, so a new http group is
// picked up without a new rule. Of webassembly only the JavaScript API counts.
const rule = (prefix, level, depth) =>
  Object.freeze(
    depth === undefined ? { prefix, level } : { prefix, level, depth },
  );

export const UNIT_RULES = Object.freeze([
  rule('html.elements', 'feature'),
  rule('css.properties', 'feature'),
  rule('css.at-rules', 'feature'),
  rule('css.selectors', 'feature'),
  rule('css.types', 'feature'),
  rule('api', 'feature'),
  rule('javascript.builtins', 'feature'),
  rule('svg.elements', 'feature'),
  rule('mathml.elements', 'feature'),
  rule('html.global_attributes', 'table'),
  rule('svg.global_attributes', 'table'),
  rule('mathml.global_attributes', 'table'),
  rule('mathml.attribute_values', 'table'),
  rule('javascript.classes', 'table'),
  rule('javascript.functions', 'table'),
  rule('javascript.grammar', 'table'),
  rule('javascript.operators', 'table'),
  rule('javascript.regular_expressions', 'table'),
  rule('javascript.statements', 'table'),
  rule('http', 'table', 2),
  rule('webassembly.api', 'table'),
]);

// Where the shell is served. The preview origin is confirmed in stage 4.
export const SITE = Object.freeze({
  origin: 'https://vectode.github.io',
  base: '/HTML-Template/',
  name: 'HTML-Template',
  previewOrigin: 'https://html-template-preview.pages.dev',
});

// "/html/dialog/" -> "/HTML-Template/html/dialog/". Backslashes from a
// Windows path become "/", so a URL never carries one.
export function pageUrl(path, site = SITE) {
  let rel = path.replaceAll('\\', '/');
  while (rel.startsWith('/')) rel = rel.slice(1);
  return site.base + rel;
}

export function absoluteUrl(path, site = SITE) {
  return site.origin + pageUrl(path, site);
}
