import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

// Writes { 'a/b.txt': 'text' } below dir, creating folders as needed.
export async function writeTree(dir, files) {
  await Promise.all(
    Object.entries(files).map(async ([rel, text]) => {
      const target = join(dir, rel);
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, text);
    }),
  );
}
