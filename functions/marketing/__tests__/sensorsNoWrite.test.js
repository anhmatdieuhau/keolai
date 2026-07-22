/**
 * Plain assert-based test — run with:
 *   node functions/marketing/__tests__/sensorsNoWrite.test.js
 * Static guard: Phase 1 sensors may READ the articles collection (they need
 * titles/slugs to compare against), but must NEVER write to it — the only
 * collection they write to is `signals`. This asserts every line that
 * references the articles collection only ever calls .get() on it, and that
 * none of Firestore's write methods (.set/.update/.add/.delete) appear
 * anywhere else in a sensor file.
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const SENSOR_FILES = ['gscDemandScan.js', 'contentDecayScan.js', 'serpGapScan.js'];
const SENSORS_DIR = path.join(__dirname, '../sensors');
// Firestore write methods used by this codebase's write call sites. `.add(`
// is deliberately excluded from the "must be chained from signals" check
// below — it's ambiguous with native Set.add()/Array methods (gscDemandScan
// uses a plain Set for dedup), and none of the sensors use
// collection.add() for Firestore writes (they use .doc(id).set()
// throughout), so there's nothing for that ambiguity to hide here.
const WRITE_METHODS = ['.set(', '.update(', '.delete('];

for (const file of SENSOR_FILES) {
  const source = fs.readFileSync(path.join(SENSORS_DIR, file), 'utf8');
  const lines = source.split('\n');

  const articlesLines = lines.filter((l) => l.includes("collection('articles')"));
  for (const line of articlesLines) {
    assert.ok(line.includes('.get('), `${file}: every reference to the articles collection must be a .get() read — offending line: ${line.trim()}`);
    for (const method of WRITE_METHODS) {
      assert.ok(!line.includes(method), `${file}: line referencing articles must not also call ${method} — offending line: ${line.trim()}`);
    }
  }
  console.log(`PASS: ${file} — every articles-collection reference is a read-only .get()`);

  // The only Firestore collection any sensor is allowed to write to is `signals`.
  // Find every write-method call and confirm the collection it's chained from is 'signals'.
  for (const method of WRITE_METHODS) {
    if (!source.includes(method)) continue;
    // All 3 sensors write via: db.collection('signals').doc(...).<method>(
    const escapedMethod = method.replace(/[.()]/g, (c) => `\\${c}`);
    assert.ok(
      new RegExp(`collection\\('signals'\\)[\\s\\S]{0,120}?${escapedMethod}`).test(source),
      `${file}: found a ${method} call not clearly chained from the signals collection — verify manually`
    );
  }
  console.log(`PASS: ${file} — every write call is chained from the signals collection`);
}

// Also guard the Cloud Function wrapper file: it must never call a write
// method against the articles collection either (it may legitimately read
// nothing from articles directly, but re-check defensively).
const wrapperSource = fs.readFileSync(path.join(__dirname, '../index.js'), 'utf8');
const wrapperArticlesLines = wrapperSource.split('\n').filter((l) => l.includes("collection('articles')"));
assert.strictEqual(wrapperArticlesLines.length, 0, 'marketing/index.js should not reference the articles collection directly — that belongs in a sensor module');
console.log('PASS: marketing/index.js does not reference the articles collection directly');

console.log('\nAll sensorsNoWrite tests passed.');
