const WIKI_LINK = /\[\[([^\]]+)\]\]/g;
const MARKDOWN_LINK = /\]\(([^)\s]+)\)/g;

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
  return withoutAnchor.replaceAll(' ', '-');
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
  for (const match of line.matchAll(WIKI_LINK)) {
    const parts = match[1].split('|');
    found.push(parts.at(-1));
  }
  for (const match of line.matchAll(MARKDOWN_LINK)) {
    if (isInternal(match[1])) found.push(match[1]);
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
