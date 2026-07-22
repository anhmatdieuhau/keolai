/**
 * Plain assert-based test — run with:
 *   node functions/lib/__tests__/nurtureTemplates.test.js
 * Regression guard for the fabricated-testimonial issue: the old
 * generateNurtureEmail() prompt explicitly instructed an LLM to invent 2 fake
 * customer stories (named provinces, specific yields) and sent the result
 * straight to real leads with no review step. These tests assert the
 * replacement is fully static (no network calls possible — no fetch/apiKey
 * in the module at all) and that no fabricated customer names/provinces
 * appear in any template output.
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { NURTURE_TEMPLATES, buildNurtureEmail, buildReengagementEmail } = require('../nurtureTemplates');

// ── module is fully static: no fetch/network call possible ──
const source = fs.readFileSync(path.join(__dirname, '../nurtureTemplates.js'), 'utf8');
assert.ok(!source.includes('fetch('), 'nurtureTemplates.js must not call fetch() — no LLM/network dependency');
assert.ok(!source.includes('apiKey'), 'nurtureTemplates.js must not reference an API key — it has no external call to authenticate');
console.log('PASS: nurtureTemplates.js is fully static (no fetch, no apiKey)');

// ── every step in the real NURTURE_STEPS sequence has a matching template ──
const REAL_STEP_TEMPLATE_NAMES = ['welcome', 'technical', 'pricing', 'testimonial', 'final_offer'];
for (const name of REAL_STEP_TEMPLATE_NAMES) {
  assert.ok(typeof NURTURE_TEMPLATES[name] === 'function', `NURTURE_TEMPLATES must define "${name}"`);
}
console.log('PASS: all 5 nurture step templates are defined');

// ── the fabricated-testimonial regression guard ──
const FABRICATED_STRINGS = ['Quảng Ngãi', 'Bình Định', '10 vạn cây', 'tỉ lệ sống 95%', 'thu hoạch sau 5 năm'];
const lead = { name: 'Chị Lan', province: 'Đắk Lắk', quantity: 3 };
for (const templateName of Object.keys(NURTURE_TEMPLATES)) {
  const output = NURTURE_TEMPLATES[templateName](lead);
  for (const fabricated of FABRICATED_STRINGS) {
    assert.ok(
      !output.includes(fabricated),
      `${templateName} template must not contain the old fabricated testimonial detail "${fabricated}"`
    );
  }
}
console.log('PASS: no template output contains the old fabricated customer-testimonial details');

// ── variable substitution works, and degrades gracefully without them ──
const withLead = buildNurtureEmail({ template: 'welcome' }, { name: 'Anh Minh', province: 'Gia Lai' });
assert.ok(withLead.includes('Gia Lai'), 'welcome template should include the lead province when present');

const withoutOptional = buildNurtureEmail({ template: 'welcome' }, { name: 'Anh Minh' });
assert.ok(!withoutOptional.includes('undefined'), 'missing optional lead fields must not leak "undefined" into email text');
console.log('PASS: variable substitution — includes lead data when present, no "undefined" leakage when absent');

// ── unknown step name falls back to welcome instead of throwing ──
const fallback = buildNurtureEmail({ template: 'does-not-exist' }, { name: 'Anh Minh' });
assert.strictEqual(fallback, NURTURE_TEMPLATES.welcome({ name: 'Anh Minh' }));
console.log('PASS: unknown template name falls back to "welcome" instead of throwing');

// ── buildReengagementEmail: with and without a seasonal offer line ──
const withSeason = buildReengagementEmail({ name: 'Chị Hoa', province: 'Kon Tum' }, 'Đang mùa vụ xuân.');
assert.ok(withSeason.includes('Đang mùa vụ xuân.'), 'seasonal offer text should be included when provided');
assert.ok(withSeason.includes('Kon Tum'));

const withoutSeason = buildReengagementEmail({ name: 'Chị Hoa' }, '');
assert.ok(!withoutSeason.includes('undefined'), 'empty seasonOffer must not leak "undefined" into the email');
console.log('PASS: buildReengagementEmail handles both a seasonal offer and no offer cleanly');

console.log('\nAll nurtureTemplates tests passed.');
