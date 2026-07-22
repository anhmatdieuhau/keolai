/**
 * Thin wrapper around the official @anthropic-ai/sdk for the 2 marketing-agent
 * tasks that use Claude instead of Gemini: evidenceVerifier's tier-3 LLM judge
 * and strategistAgent (+ its proposalConsistencyCheck). See the plan's
 * "Chuyên biệt model theo từng tác vụ" section for why these 2 tasks specifically.
 *
 * The API key is passed in by the caller (each Cloud Function resolves its own
 * `defineSecret('ANTHROPIC_API_KEY').value()`, matching how VERTEX_API_KEY etc.
 * are already resolved in index.js) rather than read here — keeps this file a
 * plain, secret-free, easily-testable library.
 *
 * Model ID is a constant, not a "model router" abstraction — matches the
 * one-constant-per-file pattern already used for Gemini calls in pipeline.js.
 */
const Anthropic = require('@anthropic-ai/sdk');

const DEFAULT_MODEL = 'claude-sonnet-5';

/**
 * @param {string} apiKey
 * @param {{model?: string, maxTokens?: number, client?: object}} [opts] -
 *   `opts.client` lets tests inject a fake SDK client instead of a real one.
 */
function createClaudeClient(apiKey, opts = {}) {
  const client = opts.client || new Anthropic({ apiKey });
  const model = opts.model || DEFAULT_MODEL;
  const maxTokens = opts.maxTokens || 2048;

  /**
   * Calls Claude with a JSON-schema-constrained response and returns the
   * already-parsed object. Throws (does not silently return null) if the
   * response has no text block or the text isn't valid JSON — callers in
   * evidenceVerifier/strategistAgent are fail-closed, so a throw here must
   * propagate into their existing reject-on-error path, not disappear.
   *
   * @param {{system?: string, prompt: string, schema: object, thinking?: object}} args
   */
  async function callJSON({ system, prompt, schema, thinking }) {
    const response = await client.messages.create({
      model,
      max_tokens: maxTokens,
      ...(system ? { system } : {}),
      ...(thinking ? { thinking } : {}),
      output_config: { format: { type: 'json_schema', schema } },
      messages: [{ role: 'user', content: prompt }],
    });

    const textBlock = (response.content || []).find((block) => block.type === 'text');
    if (!textBlock) {
      throw new Error('claudeClient.callJSON: response has no text content block');
    }
    return JSON.parse(textBlock.text);
  }

  return { callJSON, model };
}

module.exports = { createClaudeClient, DEFAULT_MODEL };
