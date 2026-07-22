/**
 * Vertex AI text embeddings — shared by every content-generation entry point that needs the
 * semantic tier of evaluateTopicNovelty (topic-dedup.js). One source of truth so index.js and
 * pipeline.js don't drift the way the slug-normalization logic did (B5).
 */
async function embedTopicTitle(title, apiKey) {
  const res = await fetch(
    `https://aiplatform.googleapis.com/v1/publishers/google/models/text-embedding-004:predict?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ instances: [{ content: title }] }),
    }
  );
  if (!res.ok) throw new Error(`Embedding API error: ${res.status}`);
  const data = await res.json();
  return data.predictions[0].embeddings.values;
}

module.exports = { embedTopicTitle };
