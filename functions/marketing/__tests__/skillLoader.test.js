/**
 * Plain assert-based test — run with:
 *   node functions/marketing/__tests__/skillLoader.test.js
 */
const assert = require('assert');
const { loadSkill, _clearCache } = require('../lib/skillLoader');

// ── loads the custom KeoLai business-context file, has required facts ──
const business = loadSkill('keolai-business-context');
const businessLower = business.toLowerCase();
assert.ok(business.length > 0, 'keolai-business-context.md must not be empty');
for (const keyword of ['chi phí', 'lợi nhuận', '0907282960', 'ngách']) {
  assert.ok(
    businessLower.includes(keyword),
    `keolai-business-context.md must mention "${keyword}"`
  );
}
console.log('PASS: loadSkill("keolai-business-context") — non-empty, contains required facts');

// ── loads a forked upstream skill ──
const contentStrategy = loadSkill('content-strategy');
assert.ok(contentStrategy.length > 0, 'content-strategy.md must not be empty');
assert.ok(
  contentStrategy.includes('coreyhaines31/marketingskills'),
  'forked skill files must carry the source attribution header'
);
console.log('PASS: loadSkill("content-strategy") — non-empty, carries attribution header');

// ── caches after first read ──
_clearCache();
const first = loadSkill('schema');
const second = loadSkill('schema');
assert.strictEqual(first, second, 'repeated loadSkill() calls must return the cached string');
console.log('PASS: loadSkill() caches in-process');

// ── missing skill throws instead of silently returning empty ──
assert.throws(() => loadSkill('does-not-exist'), /ENOENT/);
console.log('PASS: loadSkill() throws for a missing skill file');

console.log('\nAll skillLoader tests passed.');
