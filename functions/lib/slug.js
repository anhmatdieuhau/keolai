/**
 * Single source of truth for slug generation/validation across the content pipeline.
 * Fixes B3 (seasonalCampaign didn't strip Vietnamese diacritics), B4 (autoReplenishTopics
 * used AI-supplied slugs with zero validation), and B5 (this diacritics-strip logic was
 * copy-pasted in pipeline.js at two call sites and drifted out of sync).
 *
 * Uses String.prototype.normalize('NFD') decomposition instead of a hand-maintained regex
 * chain per Vietnamese vowel — that per-vowel chain is exactly how B3 happened (a regex chain
 * has to be kept in sync by hand at every call site; NFD decomposition can't drift).
 */

const COMBINING_DIACRITICS = /[̀-ͯ]/g; // Vietnamese tone/vowel marks after NFD decomposition

function normalizeSlug(text) {
  if (typeof text !== 'string') return '';
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(COMBINING_DIACRITICS, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function isValidSlug(slug) {
  return typeof slug === 'string' && slug.length > 0 && /^[a-z0-9-]+$/.test(slug);
}

module.exports = { normalizeSlug, isValidSlug };
