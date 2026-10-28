// npm run build: writes the static site to dist/site.

import { main } from './build/site.mjs';

process.exitCode = await main(process.argv.slice(2), {
  stdout: process.stdout,
  stderr: process.stderr,
});
