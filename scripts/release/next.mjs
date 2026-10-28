import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { gitExecutable } from '../policy/git.mjs';
import { parseCommit } from './commits.mjs';
import { compareSemver, parseSemver, versionsFromTags } from './semver.mjs';

export { compareSemver } from './semver.mjs';

const TARGET = '1.0.0';
// Channels in the order a release may move through them.
const CHANNELS = ['alpha', 'beta', 'final'];

function latestVersion(tags) {
  const versions = versionsFromTags(tags).sort(compareSemver);
  return versions.length === 0 ? null : versions.at(-1);
}

function channelOf(version, parsed) {
  const [name, number, ...more] = parsed.prerelease;
  const index = CHANNELS.indexOf(name);
  const counter = Number(number);
  const validCounter = Number.isInteger(counter) && counter > 0;
  if (index === -1 || index === 2 || more.length > 0 || !validCounter) {
    throw new Error(`Last tag v${version} is not on a known release line`);
  }
  return { index, counter };
}

function release(channel, counter) {
  return channel === 'final' ? TARGET : `${TARGET}-${channel}.${counter}`;
}

// Next 1.0.0 pre-release (or 1.0.0 itself) for a stage channel. Throws when
// the channel would go backwards or 1.0.0 already exists.
export function nextVersion({ tags, channel } = {}) {
  if (!Array.isArray(tags)) throw new Error('tags must be an array of strings');
  const wanted = CHANNELS.indexOf(channel);
  if (wanted === -1) {
    throw new Error(
      `Unknown channel "${channel}", expected ${CHANNELS.join(', ')}`,
    );
  }
  const latest = latestVersion(tags);
  if (latest === null || compareSemver(latest, `${TARGET}-0`) < 0) {
    return release(channel, 1);
  }
  const parsed = parseSemver(latest);
  if (parsed.prerelease.length === 0) {
    throw new Error(
      `Channel ${channel} would go backwards: v${latest} is released and the stage map ends at ${TARGET}`,
    );
  }
  if (compareSemver(latest, TARGET) > 0) {
    throw new Error(`Last tag v${latest} is past ${TARGET}`);
  }
  const current = channelOf(latest, parsed);
  if (wanted < current.index) {
    throw new Error(
      `Channel ${channel} would go backwards: last tag is v${latest}`,
    );
  }
  return release(channel, wanted === current.index ? current.counter + 1 : 1);
}

// Semver bump after 1.0.0 from conventional commit messages, or null when
// nothing in the messages calls for a release.
export function bump(version, messages) {
  const parsed = parseSemver(version);
  if (parsed === null) throw new Error(`"${version}" is not semver`);
  const commits = messages.map(parseCommit).filter((c) => c !== null);
  const { major, minor, patch } = parsed;
  if (commits.some((c) => c.breaking)) return `${major + 1}.0.0`;
  if (commits.some((c) => c.type === 'feat')) return `${major}.${minor + 1}.0`;
  if (commits.some((c) => c.type === 'fix' || c.type === 'perf')) {
    return `${major}.${minor}.${patch + 1}`;
  }
  return null;
}

export function listTags() {
  return execFileSync(gitExecutable(), ['tag', '--list', 'v*'], {
    encoding: 'utf8',
  })
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const version = nextVersion({ tags: listTags(), channel: process.argv[2] });
    process.stdout.write(`version=${version}\ntag=v${version}\n`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
