// Conventional commit parsing with plain string operations.
const TYPE = /^[a-z]+$/;
const SCOPE = /^[\w./-]+$/;
const SEPARATOR = ': ';
const BREAKING_FOOTERS = ['BREAKING CHANGE:', 'BREAKING-CHANGE:'];

// Splits "type(scope)!: description" into its parts, or returns null when the
// first line of the message is not a conventional commit header.
export function parseCommit(message) {
  const lines = String(message).split('\n');
  const header = lines[0].trim();
  const at = header.indexOf(SEPARATOR);
  if (at <= 0) return null;
  let prefix = header.slice(0, at);
  const description = header.slice(at + SEPARATOR.length).trim();
  if (description === '') return null;
  let breaking = prefix.endsWith('!');
  if (breaking) prefix = prefix.slice(0, -1);
  let scope = null;
  if (prefix.endsWith(')')) {
    const open = prefix.indexOf('(');
    if (open <= 0) return null;
    scope = prefix.slice(open + 1, -1);
    prefix = prefix.slice(0, open);
    if (!SCOPE.test(scope)) return null;
  }
  if (!TYPE.test(prefix)) return null;
  breaking ||= lines
    .slice(1)
    .some((line) => BREAKING_FOOTERS.some((footer) => line.startsWith(footer)));
  return { type: prefix, scope, breaking, description };
}
