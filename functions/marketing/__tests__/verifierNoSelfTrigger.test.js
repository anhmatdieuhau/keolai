/**
 * Plain assert-based test — run with:
 *   node functions/marketing/__tests__/verifierNoSelfTrigger.test.js
 * Static guard: evidenceVerifier is triggered by onDocumentWritten on
 * signals/{date}. If it ever wrote back to that same collection, it would
 * re-trigger itself — an infinite loop that also burns through costGuard's
 * budget very fast. This asserts the exports.evidenceVerifier block never
 * references the signals collection, and only ever writes to
 * verified_claims (its actual output collection).
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const source = fs.readFileSync(path.join(__dirname, '../index.js'), 'utf8');

const start = source.indexOf('exports.evidenceVerifier');
assert.ok(start !== -1, 'exports.evidenceVerifier must exist in marketing/index.js');
const verifierSource = source.slice(start);

assert.ok(
  !verifierSource.includes("collection('signals')"),
  'evidenceVerifier must never reference the signals collection — writing back to it would re-trigger itself (infinite loop)'
);
console.log('PASS: evidenceVerifier never references the signals collection');

assert.ok(
  verifierSource.includes("collection('verified_claims')"),
  'evidenceVerifier must write its verdicts to verified_claims'
);
console.log('PASS: evidenceVerifier writes to verified_claims');

assert.ok(verifierSource.includes('onDocumentWritten'), 'evidenceVerifier must be triggered by onDocumentWritten, not a cron');
console.log('PASS: evidenceVerifier is event-driven off Firestore writes, not a separate cron job');

console.log('\nAll verifierNoSelfTrigger tests passed.');
