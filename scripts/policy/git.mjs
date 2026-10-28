import { existsSync } from 'node:fs';
import { delimiter, join } from 'node:path';

const FIXED_DIRS = [
  '/usr/bin',
  '/usr/local/bin',
  '/opt/homebrew/bin',
  'C:\Program Files\Git\cmd',
  'C:\Program Files (x86)\Git\cmd',
];

let cached;

// Resolve the git executable once to an absolute path. Trusted system
// locations win over whatever the PATH variable happens to contain.
export function gitExecutable() {
  if (cached) return cached;
  const names = process.platform === 'win32' ? ['git.exe'] : ['git'];
  const pathDirs = (process.env.PATH ?? '').split(delimiter).filter(Boolean);
  for (const dir of [...FIXED_DIRS, ...pathDirs]) {
    for (const name of names) {
      const candidate = join(dir, name);
      if (existsSync(candidate)) {
        cached = candidate;
        return cached;
      }
    }
  }
  throw new Error('git executable not found');
}
