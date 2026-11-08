import { readFile } from 'node:fs/promises';
import { checkReports } from './budgets.mjs';

const [baseline, candidate, ...extra] = process.argv.slice(2);
if (!baseline || !candidate || extra.length) throw new Error('Usage: node perf/gate.mjs baseline.json candidate.json');
const result = checkReports(JSON.parse(await readFile(baseline, 'utf8')), JSON.parse(await readFile(candidate, 'utf8')));
console.table(result.rows);
if (!result.pass) process.exitCode = 1;
