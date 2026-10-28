import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const BOT_NAMES = new Set(['dependabot[bot]', 'github-actions[bot]']);
const BOT_EMAIL_SUFFIX = '[bot]@users.noreply.github.com';

function hasSignOff({ authorName, authorEmail, message }) {
  const wanted = authorEmail.toLowerCase();
  return message.split(/\r?\n/).some((line) => {
    const m = /^Signed-off-by:\s+(.+?)\s+<([^<>]*)>\s*$/.exec(line);
    return m !== null && m[1] === authorName && m[2].toLowerCase() === wanted;
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
    'git',
    ['log', '--format=%H%x1f%an%x1f%ae%x1f%P%x1f%B%x1e', `${base}..${head}`],
    { encoding: 'utf8' },
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

if (import.meta.url === pathToFileURL(process.argv[1]).href) main();
