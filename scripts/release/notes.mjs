import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { gitExecutable } from '../policy/git.mjs';
import { parseCommit } from './commits.mjs';
import { listTags } from './next.mjs';
import { compareSemver, versionsFromTags } from './semver.mjs';
import { parseReleaseTag } from './version.mjs';

const RECORD = '\x1e';
const FIELD = '\x1f';
const GROUPS = [
  { title: 'Features', types: new Set(['feat']) },
  { title: 'Fixes', types: new Set(['fix', 'perf']) },
  { title: 'Other', types: null },
];

// git log range from the previous v* tag in semver order to this tag. The
// first tag has no previous one, so its range reaches back to the root.
export function logRange(tags, tag) {
  const { version } = parseReleaseTag(tag);
  const older = versionsFromTags(tags)
    .filter((v) => compareSemver(v, version) < 0)
    .sort(compareSemver);
  return older.length === 0 ? tag : `v${older.at(-1)}..${tag}`;
}

// Parses `git log --format=%H%x1f%B%x1e` output.
export function parseCommitLog(output) {
  return output
    .split(RECORD)
    .map((record) => record.trim())
    .filter((record) => record !== '')
    .map((record) => {
      const at = record.indexOf(FIELD);
      return { sha: record.slice(0, at), message: record.slice(at + 1).trim() };
    });
}

function entry({ sha, message }) {
  const commit = parseCommit(message);
  const short = sha.slice(0, 7);
  if (commit === null) {
    return {
      group: 'Other',
      line: `- ${message.split('\n')[0].trim()} (${short})`,
    };
  }
  const group = GROUPS.find(
    (g) => g.types === null || g.types.has(commit.type),
  );
  let text = commit.description;
  if (group.title === 'Other') text = `${commit.type}: ${text}`;
  else if (commit.scope !== null) text = `${commit.scope}: ${text}`;
  if (commit.breaking) text = `**Breaking:** ${text}`;
  return { group: group.title, line: `- ${text} (${short})` };
}

// Markdown release notes grouped into Features, Fixes and Other.
export function renderNotes(commits) {
  if (commits.length === 0) return 'No changes.';
  const entries = commits.map(entry);
  return GROUPS.map(({ title }) => {
    const lines = entries.filter((e) => e.group === title).map((e) => e.line);
    return lines.length === 0 ? null : [`## ${title}`, '', ...lines].join('\n');
  })
    .filter((section) => section !== null)
    .join('\n\n');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    // Use the tag name as git reports it, never the raw argument.
    const tags = listTags();
    const wanted = process.argv[2] ?? '';
    const tag = tags.find((name) => name === wanted);
    if (tag === undefined) throw new Error(`Tag "${wanted}" does not exist`);
    const range = logRange(tags, tag);
    const output = execFileSync(
      gitExecutable(),
      [
        'log',
        '--no-merges',
        `--format=%H${FIELD}%B${RECORD}`,
        '--end-of-options',
        range,
      ],
      { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
    );
    process.stdout.write(`${renderNotes(parseCommitLog(output))}\n`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
