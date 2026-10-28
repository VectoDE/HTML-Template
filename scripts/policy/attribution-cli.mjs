import { pathToFileURL } from 'node:url';
import { findAttribution } from './attribution.mjs';

// Checks pull request title and body. The workflow hands both over through
// env (PR_TITLE, PR_BODY), never through expressions inside run:.
export function checkPullRequestText({ title = '', body = '' } = {}) {
  const errors = [];
  for (const [label, text] of [
    ['title', title],
    ['body', body],
  ]) {
    for (const { line, match } of findAttribution(text)) {
      errors.push(
        `pull request ${label}:${line} forbidden attribution text "${match}"`,
      );
    }
  }
  return errors;
}

function main() {
  const errors = checkPullRequestText({
    title: process.env.PR_TITLE ?? '',
    body: process.env.PR_BODY ?? '',
  });
  if (errors.length > 0) {
    console.error(errors.join('\n'));
    console.error(`\nattribution: ${errors.length} problem(s) found`);
    process.exit(1);
  }
  console.log('attribution: ok (pull request title and body checked)');
}

const entry = process.argv[1];
if (entry && import.meta.url === pathToFileURL(entry).href) main();
