import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const NUMERIC = /^(?:0|[1-9]\d*)$/;
const IDENTIFIER = /^[0-9A-Za-z-]+$/;

function validIdentifiers(text) {
  return text
    .split('.')
    .every(
      (part) =>
        IDENTIFIER.test(part) && !(/^\d+$/.test(part) && !NUMERIC.test(part)),
    );
}

// Strict semver 2.0.0 check without a single backtracking-prone pattern.
function isSemver(text) {
  const plus = text.indexOf('+');
  const build = plus === -1 ? null : text.slice(plus + 1);
  const rest = plus === -1 ? text : text.slice(0, plus);
  const dash = rest.indexOf('-');
  const pre = dash === -1 ? null : rest.slice(dash + 1);
  const core = (dash === -1 ? rest : rest.slice(0, dash)).split('.');
  if (core.length !== 3 || !core.every((part) => NUMERIC.test(part))) {
    return false;
  }
  if (pre !== null && !validIdentifiers(pre)) return false;
  return (
    build === null || build.split('.').every((part) => IDENTIFIER.test(part))
  );
}

export function parseReleaseTag(tag, pkgVersion) {
  if (typeof tag !== 'string' || !tag.startsWith('v')) {
    throw new Error(`Invalid tag "${tag}": expected v<semver>`);
  }
  const version = tag.slice(1);
  if (!isSemver(version)) {
    throw new Error(`Invalid tag "${tag}": "${version}" is not a semver`);
  }
  if (version !== pkgVersion) {
    throw new Error(
      `Version ${version} from tag "${tag}" does not match package.json (${pkgVersion})`,
    );
  }
  const plus = version.indexOf('+');
  const precedence = plus === -1 ? version : version.slice(0, plus);
  return { version, prerelease: precedence.includes('-') };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const pkgUrl = new URL('../../package.json', import.meta.url);
    const pkg = JSON.parse(readFileSync(pkgUrl, 'utf8'));
    const { version, prerelease } = parseReleaseTag(
      process.argv[2] ?? '',
      pkg.version,
    );
    process.stdout.write(`version=${version}\nprerelease=${prerelease}\n`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
