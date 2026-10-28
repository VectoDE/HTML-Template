// Reads the two build-time data packages. Their exports maps block deep
// imports, so the files are found with require.resolve and read directly.

import { createRequire } from 'node:module';
import { readFile as nodeReadFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);

export async function loadCompatData({
  resolve = (name) => require.resolve(name),
  readFile = nodeReadFile,
} = {}) {
  const read = async (path) => JSON.parse(await readFile(path, 'utf8'));
  const featuresPath = resolve('web-features/data.json');
  const [bcd, webFeatures, pkg] = await Promise.all([
    read(resolve('@mdn/browser-compat-data')),
    read(featuresPath),
    read(join(dirname(featuresPath), 'package.json')),
  ]);
  return {
    bcd,
    webFeatures,
    versions: { bcd: bcd.__meta.version, webFeatures: pkg.version },
  };
}
