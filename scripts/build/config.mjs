// Shared build constants. Everything here is data, no behaviour.

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
