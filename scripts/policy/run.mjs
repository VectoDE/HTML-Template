import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { checkWorkflow } from './workflows.mjs';
import { findAttribution } from './attribution.mjs';
import {
  filterAttributionTargets,
  findCrlf,
  listTrackedTextFiles,
} from './files.mjs';

const problems = [];

const workflowDir = '.github/workflows';
if (existsSync(workflowDir)) {
  for (const name of readdirSync(workflowDir).filter((n) =>
    /\.ya?ml$/.test(n),
  )) {
    const file = `${workflowDir}/${name}`;
    problems.push(...checkWorkflow(readFileSync(file, 'utf8'), file));
  }
}

const tracked = listTrackedTextFiles().filter((p) => existsSync(p));

for (const file of tracked) {
  const text = readFileSync(file, 'utf8');
  for (const line of findCrlf(text))
    problems.push(`${file}:${line} CRLF line ending`);
}

for (const file of filterAttributionTargets(tracked)) {
  const text = readFileSync(file, 'utf8');
  for (const { line, match } of findAttribution(text)) {
    problems.push(`${file}:${line} forbidden attribution text "${match}"`);
  }
}

if (problems.length > 0) {
  console.error(problems.join('\n'));
  console.error(`\npolicy: ${problems.length} problem(s) found`);
  process.exit(1);
}
console.log(`policy: ok (${tracked.length} text files checked)`);
