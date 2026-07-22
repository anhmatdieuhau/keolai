/**
 * Plain assert-based test — run with:
 *   node functions/marketing/__tests__/geminiClient.test.js
 */
const assert = require('assert');
const { createGeminiClient, DEFAULT_MODEL } = require('../lib/geminiClient');

(async () => {
  let lastUrl, lastBody;
  const fakeFetch = async (url, init) => {
    lastUrl = url;
    lastBody = JSON.parse(init.body);
    return {
      ok: true,
      status: 200,
      async json() {
        return { candidates: [{ content: { parts: [{ text: JSON.stringify({ is_gap: true, reason: 'test' }) }] } }] };
      },
    };
  };

  const client = createGeminiClient('fake-key', { fetchFn: fakeFetch });
  assert.strictEqual(client.model, DEFAULT_MODEL);

  const schema = { type: 'object', properties: { is_gap: { type: 'boolean' }, reason: { type: 'string' } } };
  const result = await client.callJSON({ prompt: 'test prompt', schema });

  assert.strictEqual(result.is_gap, true);
  assert.ok(lastUrl.includes(DEFAULT_MODEL), 'request URL must target the configured model');
  assert.ok(lastUrl.includes('key=fake-key'), 'request must carry the API key');
  assert.strictEqual(lastBody.generationConfig.responseMimeType, 'application/json');
  assert.deepStrictEqual(lastBody.generationConfig.responseSchema, schema);
  console.log('PASS: callJSON sends responseMimeType/responseSchema and parses the response');

  // ── non-ok response throws ──
  const failingClient = createGeminiClient('fake-key', {
    fetchFn: async () => ({ ok: false, status: 429 }),
  });
  await assert.rejects(() => failingClient.callJSON({ prompt: 'x', schema }), /429/);
  console.log('PASS: callJSON throws on a non-ok HTTP response');

  // ── missing text throws instead of returning undefined ──
  const emptyClient = createGeminiClient('fake-key', {
    fetchFn: async () => ({ ok: true, async json() { return { candidates: [] }; } }),
  });
  await assert.rejects(() => emptyClient.callJSON({ prompt: 'x', schema }), /no text content/);
  console.log('PASS: callJSON throws (fail-closed) when the response has no text content');

  console.log('\nAll geminiClient tests passed.');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
