/**
 * Reads a marketing skill (or the KeoLai business-context file) by name from
 * functions/marketing-skills/*.md and caches it in-process — every Cloud
 * Function that builds an LLM prompt in functions/marketing/ calls this
 * instead of duplicating fs.readFileSync calls.
 */
const fs = require('fs');
const path = require('path');

const SKILLS_DIR = path.join(__dirname, '../../marketing-skills');
const cache = new Map();

/**
 * @param {string} name - skill filename without extension, e.g. 'content-strategy'
 *   or 'keolai-business-context'.
 * @returns {string} the skill file's raw markdown content.
 */
function loadSkill(name) {
  if (cache.has(name)) return cache.get(name);

  const filePath = path.join(SKILLS_DIR, `${name}.md`);
  const content = fs.readFileSync(filePath, 'utf8');
  cache.set(name, content);
  return content;
}

/** Test-only: clears the in-process cache so tests don't leak state across runs. */
function _clearCache() {
  cache.clear();
}

module.exports = { loadSkill, _clearCache };
