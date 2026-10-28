import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Workflows that must have succeeded on a push to main for the head commit.
// They are matched by file path, so a run of another workflow with the same
// name or the same job names does not count.
export const REQUIRED_WORKFLOWS = [
  '.github/workflows/ci.yml',
  '.github/workflows/codeql.yml',
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

function newer(a, b) {
  const at = String(a.created_at);
  const bt = String(b.created_at);
  if (at !== bt) return at > bt;
  return Number(a.id) > Number(b.id);
}

// Required workflows whose newest push run on main for `sha` is not a
// completed success. Takes the pages of
// `gh api --paginate --slurp .../actions/runs?head_sha=<sha>&branch=main&event=push`.
export function failingWorkflows(pages, sha) {
  if (typeof sha !== 'string' || sha === '') {
    throw new Error('failingWorkflows needs the head sha of main');
  }
  const list = Array.isArray(pages) ? pages : [];
  const runs = list
    .flatMap((page) => page?.workflow_runs ?? [])
    .filter(
      (run) =>
        run?.head_sha === sha &&
        run.head_branch === 'main' &&
        run.event === 'push',
    );
  const newest = new Map();
  for (const run of runs) {
    const seen = newest.get(run.path);
    if (!seen || newer(run, seen)) newest.set(run.path, run);
  }
  return REQUIRED_WORKFLOWS.filter((path) => {
    const run = newest.get(path);
    return run?.status !== 'completed' || run.conclusion !== 'success';
  });
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

// CLI for tag.yml:
//   guards.mjs channel <config> <issue>  prints the channel or nothing
//   guards.mjs runs <runs.json> <sha>    prints the failing workflows
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const [command, ...args] = process.argv.slice(2);
    if (command === 'channel') {
      const channel = channelFor(readJson(args[0]), args[1]);
      if (channel !== null) process.stdout.write(`${channel}\n`);
    } else if (command === 'runs') {
      const failing = failingWorkflows(readJson(args[0]), args[1]);
      if (failing.length > 0) process.stdout.write(`${failing.join(', ')}\n`);
    } else {
      throw new Error(
        'usage: guards.mjs channel <config> <issue> | runs <file> <sha>',
      );
    }
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
