import { pathToFileURL } from 'node:url';
import { parseCommit } from '../release/commits.mjs';

export const ALLOWED_TYPES = [
  'build',
  'chore',
  'ci',
  'docs',
  'feat',
  'fix',
  'perf',
  'refactor',
  'revert',
  'style',
  'test',
];

// Returns a list of problems with the pull request title (empty = OK).
export function checkPullRequestTitle(title) {
  const text = String(title ?? '').trim();
  const parsed = parseCommit(text);
  if (parsed === null) {
    return [
      `pull request title "${text}" is not a conventional commit header. Use "type(scope): summary" with one of: ${ALLOWED_TYPES.join(', ')}, for example "feat(build): add the coverage check".`,
    ];
  }
  if (!ALLOWED_TYPES.includes(parsed.type)) {
    return [
      `pull request title "${text}" uses type "${parsed.type}". Use one of: ${ALLOWED_TYPES.join(', ')}.`,
    ];
  }
  return [];
}

// The workflow hands the title over through env (PR_TITLE).
export function main({ env, stdout, stderr }) {
  const errors = checkPullRequestTitle(env.PR_TITLE ?? '');
  if (errors.length > 0) {
    stderr.write(`${errors.join('\n')}\n\npr-title: failed\n`);
    return 1;
  }
  stdout.write('pr-title: ok (pull request title checked)\n');
  return 0;
}

const entry = process.argv[1];
if (entry && import.meta.url === pathToFileURL(entry).href) {
  process.exitCode = main({
    env: process.env,
    stdout: process.stdout,
    stderr: process.stderr,
  });
}
