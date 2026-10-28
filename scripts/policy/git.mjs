import { existsSync } from 'node:fs';
import { delimiter, isAbsolute, join } from 'node:path';

const FIXED_DIRS = {
  win32: [
    String.raw`C:\Program Files\Git\cmd`,
    String.raw`C:\Program Files (x86)\Git\cmd`,
  ],
  posix: ['/usr/bin', '/usr/local/bin', '/opt/homebrew/bin'],
};

let cached;

// Pure resolver: trusted system locations first, then absolute PATH entries.
// Relative PATH entries (such as ".") are never searched.
export function resolveGit({
  platform = process.platform,
  pathEnv = process.env.PATH ?? '',
  exists = existsSync,
  separator = delimiter,
} = {}) {
  const isWin = platform === 'win32';
  const name = isWin ? 'git.exe' : 'git';
  const fixed = isWin ? FIXED_DIRS.win32 : FIXED_DIRS.posix;
  const fromPath = pathEnv
    .split(separator)
    .filter((dir) => dir !== '' && isAbsolute(dir));
  for (const dir of [...fixed, ...fromPath]) {
    const candidate = join(dir, name);
    if (exists(candidate)) return candidate;
  }
  return null;
}

// Resolve the git executable once to an absolute path.
export function gitExecutable() {
  cached ??= resolveGit();
  if (cached === null) throw new Error('git executable not found');
  return cached;
}
