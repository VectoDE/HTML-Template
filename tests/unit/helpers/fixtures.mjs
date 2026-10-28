import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

// Writes { 'a/b.txt': 'text' } below dir, creating folders as needed.
export async function writeTree(dir, files) {
  for (const [rel, text] of Object.entries(files)) {
    const target = join(dir, rel);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, text);
  }
}
