import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Check runs that must have succeeded on the head commit of main.
export const REQUIRED_CHECKS = [
  'lint',
  'test',
  'actionlint',
  'analyze (javascript-typescript)',
  'analyze (actions)',
];

const CHANNELS = new Set(['alpha', 'beta', 'final']);
const ISSUE_NUMBER = /^[1-9]\d*$/;

// Release channel of a stage issue from release-stages.json, or null.
export function channelFor(config, number) {
  const key = String(number);
  if (!ISSUE_NUMBER.test(key)) return null;
  const issues = config?.issues ?? {};
  if (!Object.hasOwn(issues, key)) return null;
  const channel = issues[key];
  if (!CHANNELS.has(channel)) {
    throw new Error(
      `release-stages.json: issue ${key} has unknown channel "${channel}"`,
    );
  }
  return channel;
}

// Only check runs created by GitHub Actions count. Any other app could post
// a check run with the same name.
const TRUSTED_APP = 'github-actions';

// Required checks whose latest GitHub Actions run on `sha` did not succeed.
// Takes the pages of `gh api --paginate --slurp .../commits/<sha>/check-runs`.
export function missingChecks(pages, sha) {
  if (typeof sha !== 'string' || sha === '') {
    throw new Error('missingChecks needs the head sha of main');
  }
  const list = Array.isArray(pages) ? pages : [];
  const runs = list
    .flatMap((page) => page?.check_runs ?? [])
    .filter((run) => run?.app?.slug === TRUSTED_APP && run.head_sha === sha);
  const latest = new Map();
  for (const run of runs) {
    const seen = latest.get(run.name);
    if (!seen || String(run.started_at) > String(seen.started_at)) {
      latest.set(run.name, run);
    }
  }
  return REQUIRED_CHECKS.filter(
    (name) => latest.get(name)?.conclusion !== 'success',
  );
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

// CLI for tag.yml:
//   guards.mjs channel <config> <issue>  prints the channel or nothing
//   guards.mjs checks <check-runs.json> <sha>  prints the failing checks
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const [command, ...args] = process.argv.slice(2);
    if (command === 'channel') {
      const channel = channelFor(readJson(args[0]), args[1]);
      if (channel !== null) process.stdout.write(`${channel}\n`);
    } else if (command === 'checks') {
      const missing = missingChecks(readJson(args[0]), args[1]);
      if (missing.length > 0) process.stdout.write(`${missing.join(', ')}\n`);
    } else {
      throw new Error(
        'usage: guards.mjs channel <config> <issue> | checks <file> <sha>',
      );
    }
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
