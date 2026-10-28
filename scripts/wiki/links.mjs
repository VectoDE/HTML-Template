// Collect the text between each "open" and the next "close" on one line.
function between(line, open, close) {
  const found = [];
  let from = 0;
  for (;;) {
    const start = line.indexOf(open, from);
    if (start === -1) return found;
    const end = line.indexOf(close, start + open.length);
    if (end === -1) return found;
    found.push(line.slice(start + open.length, end));
    from = end + close.length;
  }
}

function stripCode(text) {
  const kept = [];
  let fenced = false;
  for (const line of text.split('\n')) {
    if (line.trimStart().startsWith('```')) {
      fenced = !fenced;
      kept.push('');
      continue;
    }
    if (fenced) {
      kept.push('');
      continue;
    }
    kept.push(line.replaceAll(/`[^`]*`/g, ''));
  }
  return kept;
}

function toPageName(target) {
  const withoutAnchor = target.split('#')[0].trim();
  const name = withoutAnchor.replaceAll(' ', '-');
  return name.endsWith('.md') ? name.slice(0, -3) : name;
}

function isInternal(target) {
  return (
    target !== '' &&
    !target.startsWith('#') &&
    !target.includes(':') &&
    !target.includes('/')
  );
}

function linksIn(line) {
  const found = [];
  for (const inner of between(line, '[[', ']]')) {
    found.push(inner.split('|').at(-1));
  }
  for (const target of between(line, '](', ')')) {
    if (isInternal(target.trim()) && !target.includes(' ')) found.push(target);
  }
  return found;
}

// pages: Map of page name (file name without ".md") to its Markdown text.
// Returns one message per link whose target page does not exist.
export function checkWikiLinks(pages) {
  const known = new Set(
    [...pages.keys()].map((name) =>
      name.endsWith('.md') ? name.slice(0, -3) : name,
    ),
  );
  const errors = [];
  for (const [rawName, text] of pages) {
    const name = rawName.endsWith('.md') ? rawName.slice(0, -3) : rawName;
    stripCode(text).forEach((line, index) => {
      for (const target of linksIn(line)) {
        const page = toPageName(target);
        if (page !== '' && !known.has(page)) {
          errors.push(`${name}.md:${index + 1} link to missing page ${page}`);
        }
      }
    });
  }
  return errors;
}
