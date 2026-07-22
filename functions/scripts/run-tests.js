#!/usr/bin/env node
/**
 * Zero-dependency test runner. Discovers every `**__tests__/*.test.js` file
 * under functions/, runs each in its own process (so one file's assert
 * failure/exception doesn't stop the rest), and prints a PASS/FAIL table.
 *
 * Usage: node scripts/run-tests.js   (invoked via `npm test`)
 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const IGNORE_DIRS = new Set(['node_modules', '.git']);

function findTestFiles(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (IGNORE_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      findTestFiles(full, out);
    } else if (entry.isFile() && entry.name.endsWith('.test.js')) {
      out.push(full);
    }
  }
  return out;
}

const testFiles = findTestFiles(ROOT).sort();

if (testFiles.length === 0) {
  console.log('No *.test.js files found under functions/.');
  process.exit(1);
}

const results = [];
for (const file of testFiles) {
  const rel = path.relative(ROOT, file);
  const start = Date.now();
  const { status } = spawnSync(process.execPath, [file], {
    stdio: 'inherit',
    cwd: ROOT,
  });
  const ms = Date.now() - start;
  results.push({ rel, status, ms });
}

console.log('\n--- Test summary ---');
let failed = 0;
for (const { rel, status, ms } of results) {
  const ok = status === 0;
  if (!ok) failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${rel}  (${ms}ms)`);
}
console.log(`\n${results.length - failed}/${results.length} test files passed.`);

process.exit(failed > 0 ? 1 : 0);
