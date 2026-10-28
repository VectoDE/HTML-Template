import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const HEADING = '## [';
// Keep a Changelog puts link reference definitions such as
// [1.0.0]: https://... at the bottom; they never belong to a section.
const LINK_REFERENCE = '[';

function findSection(changelog, version) {
  const lines = changelog.split(/\r?\n/);
  const prefix = `${HEADING}${version}] - `;
  const start = lines.findIndex((line) => line.startsWith(prefix));
  if (start === -1) {
    throw new Error(`CHANGELOG.md has no section for version ${version}`);
  }
  const date = lines[start].slice(prefix.length).trim();
  let end = lines.findIndex(
    (line, index) =>
      index > start &&
      (line.startsWith(HEADING) || line.startsWith(LINK_REFERENCE)),
  );
  if (end === -1) end = lines.length;
  return {
    date,
    body: lines
      .slice(start + 1, end)
      .join('\n')
      .trim(),
  };
}

export function extractNotes(changelog, version) {
  const { body } = findSection(changelog, version);
  if (body === '') {
    throw new Error(`CHANGELOG.md section for ${version} is empty`);
  }
  return body;
}

// The section date must be a real calendar date, never the placeholder.
export function assertReleaseDate(changelog, version) {
  const { date } = findSection(changelog, version);
  const parsed = new Date(`${date}T00:00:00Z`);
  const valid =
    date.length === 10 &&
    !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().startsWith(date);
  if (!valid) {
    throw new Error(
      `CHANGELOG.md section for ${version} has no real release date ("${date}"), expected YYYY-MM-DD`,
    );
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const version = process.argv[2] ?? '';
    const changelog = readFileSync(
      new URL('../../CHANGELOG.md', import.meta.url),
      'utf8',
    );
    assertReleaseDate(changelog, version);
    process.stdout.write(`${extractNotes(changelog, version)}\n`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
