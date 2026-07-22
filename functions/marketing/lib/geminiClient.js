/**
 * Thin wrapper around the Vertex AI REST endpoint for marketing/ sensors that
 * need Gemini with a JSON-schema-constrained response (serpGapScan's gap
 * judge). Matches the plain-fetch call pattern already used throughout
 * pipeline.js/index.js — no SDK, just REST — for consistency with the rest
 * of this codebase's Gemini call sites.
 *
 * Gemini's structured-output mechanism is generationConfig.responseSchema +
 * responseMimeType: 'application/json' — different from Claude's
 * output_config.format (see functions/marketing/lib/claudeClient.js). Do not
 * conflate the two when adding a new call site.
 */

const DEFAULT_MODEL = 'gemini-3.6-flash';

/**
 * @param {string} apiKey
 * @param {{model?: string, maxOutputTokens?: number, fetchFn?: typeof fetch}} [opts] -
 *   `opts.fetchFn` lets tests inject a fake fetch instead of a real network call.
 */
function createGeminiClient(apiKey, opts = {}) {
  const model = opts.model || DEFAULT_MODEL;
  const maxOutputTokens = opts.maxOutputTokens || 1024;
  const fetchFn = opts.fetchFn || fetch;

  /**
   * @param {{prompt: string, schema: object, temperature?: number}} args
   */
  async function callJSON({ prompt, schema, temperature = 0.2 }) {
    const response = await fetchFn(
      `https://aiplatform.googleapis.com/v1/publishers/google/models/${model}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: {
            temperature,
            maxOutputTokens,
            responseMimeType: 'application/json',
            responseSchema: schema,
          },
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`geminiClient.callJSON: Vertex AI returned ${response.status}`);
    }
    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      throw new Error('geminiClient.callJSON: response has no text content');
    }
    return JSON.parse(text);
  }

  return { callJSON, model };
}

module.exports = { createGeminiClient, DEFAULT_MODEL };
