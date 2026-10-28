import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { gitExecutable } from './git.mjs';

const BOT_NAMES = new Set(['dependabot[bot]', 'github-actions[bot]']);
const BOT_EMAIL_SUFFIX = '[bot]@users.noreply.github.com';

const SIGN_OFF_PREFIX = 'Signed-off-by:';

function parseSignOff(line) {
  if (!line.startsWith(SIGN_OFF_PREFIX)) return null;
  const rest = line.slice(SIGN_OFF_PREFIX.length).trimEnd();
  if (rest.trimStart() === rest || !rest.endsWith('>')) return null;
  const open = rest.lastIndexOf('<');
  if (open < 2 || rest.slice(open + 1, -1).includes('>')) return null;
  if (rest[open - 1].trim() !== '') return null;
  const name = rest.slice(0, open).trim();
  if (name === '') return null;
  return { name, email: rest.slice(open + 1, -1) };
}

function hasSignOff({ authorName, authorEmail, message }) {
  const wanted = authorEmail.toLowerCase();
  return message.split(/\r?\n/).some((line) => {
    const parsed = parseSignOff(line);
    return (
      parsed !== null &&
      parsed.name === authorName &&
      parsed.email.toLowerCase() === wanted
    );
  });
}

function isTrustedBot({ authorName, authorEmail }) {
  return (
    BOT_NAMES.has(authorName) &&
    authorEmail.toLowerCase().endsWith(BOT_EMAIL_SUFFIX)
  );
}

export function checkDco(commits) {
  const errors = [];
  for (const commit of commits) {
    if (commit.parents > 1) continue;
    if (isTrustedBot(commit)) continue;
    if (hasSignOff(commit)) continue;
    errors.push(
      `${commit.sha.slice(0, 7)}: missing Signed-off-by: ${commit.authorName} <${commit.authorEmail}>`,
    );
  }
  return errors;
}

export function parseGitLog(output) {
  return output
    .split('\x1e')
    .map((record) => record.replace(/^\r?\n/, ''))
    .filter((record) => record.trim() !== '')
    .map((record) => {
      const [sha, authorName, authorEmail, parents, message] =
        record.split('\x1f');
      return {
        sha,
        authorName,
        authorEmail,
        message: message ?? '',
        parents: parents.trim() === '' ? 0 : parents.trim().split(' ').length,
      };
    });
}

function main() {
  const [base, head] = process.argv.slice(2);
  if (!base || !head) {
    console.error('usage: node scripts/policy/dco.mjs <base> <head>');
    process.exit(2);
  }
  const output = execFileSync(
    gitExecutable(),
    ['log', '--format=%H%x1f%an%x1f%ae%x1f%P%x1f%B%x1e', `${base}..${head}`],
    { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
  );
  const commits = parseGitLog(output);
  const errors = checkDco(commits);
  if (errors.length > 0) {
    console.error(errors.join('\n'));
    console.error(`\ndco: ${errors.length} commit(s) without sign-off`);
    process.exit(1);
  }
  console.log(`dco: ok (${commits.length} commits checked)`);
}

const entry = process.argv[1];
if (entry && import.meta.url === pathToFileURL(entry).href) main();
