/**
 * Plain assert-based test (no test runner configured) — run with:
 *   node functions/lib/__tests__/slug.test.js
 * Regression guard for B3 (seasonalCampaign slug kept Vietnamese diacritics) and
 * B4/B8 (unvalidated AI-supplied slugs reaching Firestore doc IDs / serveArticle's regex).
 */
const assert = require('assert');
const { normalizeSlug, isValidSlug } = require('../slug');

const cases = [
  ['Tây Nguyên', 'tay-nguyen'],
  ['Đất bazan', 'dat-bazan'],
  ['mua-vu-tây-nguyên-thang-6-2026', 'mua-vu-tay-nguyen-thang-6-2026'], // the actual B3 production bug
  ['Chọn giống keo lai phù hợp vùng Tây Nguyên!', 'chon-giong-keo-lai-phu-hop-vung-tay-nguyen'],
  ['  Khoảng   trắng   thừa  ', 'khoang-trang-thua'],
];

for (const [input, expected] of cases) {
  const got = normalizeSlug(input);
  assert.strictEqual(got, expected, `normalizeSlug(${JSON.stringify(input)}) => ${got}, expected ${expected}`);
}
console.log(`PASS: normalizeSlug — ${cases.length} cases`);

assert.strictEqual(isValidSlug('chon-giong-keo-lai'), true);
assert.strictEqual(isValidSlug('tây-nguyên'), false, 'must reject un-normalized diacritics — this is the B4/B8 guard');
assert.strictEqual(isValidSlug(''), false);
assert.strictEqual(isValidSlug(undefined), false);
assert.strictEqual(isValidSlug('UPPER-CASE'), false);
assert.strictEqual(isValidSlug('has spaces'), false);
console.log('PASS: isValidSlug — accepts normalized slugs, rejects everything else');

console.log('\nAll slug tests passed.');
