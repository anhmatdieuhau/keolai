/**
 * Plain assert-based test — run with:
 *   node functions/marketing/__tests__/claudeClient.test.js
 * Uses a fake SDK client (no network access, no real API key needed).
 */
const assert = require('assert');
const { createClaudeClient, DEFAULT_MODEL } = require('../lib/claudeClient');

(async () => {
  // ── happy path: parses the JSON-schema-shaped text block ──
  let lastRequest = null;
  const fakeClient = {
    messages: {
      async create(request) {
        lastRequest = request;
        return {
          content: [{ type: 'text', text: JSON.stringify({ verdict: 'SUPPORTED', confidence: 0.92, reason: 'matches source' }) }],
        };
      },
    },
  };

  const claude = createClaudeClient('fake-key', { client: fakeClient });
  assert.strictEqual(claude.model, DEFAULT_MODEL, 'defaults to claude-sonnet-5 when no model override given');

  const schema = {
    type: 'object',
    properties: { verdict: { type: 'string' }, confidence: { type: 'number' }, reason: { type: 'string' } },
    required: ['verdict', 'confidence', 'reason'],
  };
  const result = await claude.callJSON({ system: 'you are a verifier', prompt: 'check this claim', schema });

  assert.strictEqual(result.verdict, 'SUPPORTED');
  assert.strictEqual(result.confidence, 0.92);
  assert.deepStrictEqual(lastRequest.output_config, { format: { type: 'json_schema', schema } });
  assert.strictEqual(lastRequest.system, 'you are a verifier');
  console.log('PASS: callJSON sends output_config.format=json_schema and parses the text block');

  // ── thinking param passed through only when provided ──
  await claude.callJSON({ prompt: 'x', schema });
  assert.strictEqual('thinking' in lastRequest, false, 'thinking must be omitted, not set to undefined, when not requested');

  await claude.callJSON({ prompt: 'x', schema, thinking: { type: 'disabled' } });
  assert.deepStrictEqual(lastRequest.thinking, { type: 'disabled' });
  console.log('PASS: thinking is only included in the request when explicitly passed');

  // ── missing text block throws instead of returning null/undefined ──
  const brokenClient = { messages: { async create() { return { content: [] }; } } };
  const brokenClaude = createClaudeClient('fake-key', { client: brokenClient });
  await assert.rejects(
    () => brokenClaude.callJSON({ prompt: 'x', schema }),
    /no text content block/,
    'must throw (fail-closed), not silently return, when the response has no text block'
  );
  console.log('PASS: callJSON throws when the response has no text block (fail-closed)');

  // ── malformed JSON throws instead of returning garbage ──
  const malformedClient = { messages: { async create() { return { content: [{ type: 'text', text: 'not json' }] }; } } };
  const malformedClaude = createClaudeClient('fake-key', { client: malformedClient });
  await assert.rejects(() => malformedClaude.callJSON({ prompt: 'x', schema }));
  console.log('PASS: callJSON throws on malformed JSON in the text block');

  console.log('\nAll claudeClient tests passed.');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
