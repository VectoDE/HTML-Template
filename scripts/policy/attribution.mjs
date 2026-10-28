// Holds the forbidden patterns, so run.mjs excludes this file from its own scan.
const PATTERNS = [
  /co-authored-by:\s*claude/i,
  /generated with \[?claude code/i,
  /🤖\s*generated/i,
  /claude\.com\/claude-code/i,
  /noreply@anthropic\.com/i,
];

export function findAttribution(text) {
  const findings = [];
  text.split(/\r?\n/).forEach((line, index) => {
    for (const pattern of PATTERNS) {
      const m = pattern.exec(line);
      if (m) findings.push({ line: index + 1, match: m[0] });
    }
  });
  return findings;
}
