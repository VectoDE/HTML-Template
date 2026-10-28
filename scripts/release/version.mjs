import { fileURLToPath } from 'node:url';
import { parseSemver } from './semver.mjs';

// The tag is the source of truth for the version, so only the tag is checked.
export function parseReleaseTag(tag) {
  if (typeof tag !== 'string' || !tag.startsWith('v')) {
    throw new Error(`Invalid tag "${tag}": expected v<semver>`);
  }
  const version = tag.slice(1);
  const parsed = parseSemver(version);
  if (parsed === null) {
    throw new Error(`Invalid tag "${tag}": "${version}" is not a semver`);
  }
  return { version, prerelease: parsed.prerelease.length > 0 };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const { version, prerelease } = parseReleaseTag(process.argv[2] ?? '');
    process.stdout.write(`version=${version}\nprerelease=${prerelease}\n`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
