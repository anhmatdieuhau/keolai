/**
 * Marketing-agent Cloud Functions (Phase 1: sensors). Aggregated here and
 * merged into the main exports from functions/index.js via
 * Object.assign(exports, require('./marketing')) — same pattern already
 * used for functions/pipeline.js.
 *
 * Relies on functions/index.js having already called admin.initializeApp()
 * before requiring this file (matches how pipeline.js relies on the same
 * ordering).
 */
const functions = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const admin = require('firebase-admin');
const { google } = require('googleapis');
const { GoogleAuth } = require('google-auth-library');

const db = admin.firestore();
const vertexApiKey = defineSecret('VERTEX_API_KEY');
const appClientSecret = defineSecret('APP_CLIENT_SECRET');

const { runGscDemandScan } = require('./sensors/gscDemandScan');
const { runContentDecayScan } = require('./sensors/contentDecayScan');
const { runSerpGapScan } = require('./sensors/serpGapScan');
const { createGeminiClient } = require('./lib/geminiClient');
const costGuard = require('./lib/costGuard');

function isAuthorized(req) {
  const isScheduler = req.headers['user-agent']?.includes('Google-Cloud-Scheduler');
  const hasSecret = req.headers['x-app-secret'] === appClientSecret.value();
  return isScheduler || hasSecret;
}

exports.gscDemandScan = functions.onRequest(
  {
    secrets: [appClientSecret],
    region: 'us-central1',
    timeoutSeconds: 180,
    memory: '256MiB',
  },
  async (req, res) => {
    if (!isAuthorized(req)) return res.status(403).json({ error: 'Unauthorized' });
    try {
      const auth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/webmasters.readonly'] });
      const authClient = await auth.getClient();
      const searchconsole = google.searchconsole({ version: 'v1', auth: authClient });
      const result = await runGscDemandScan({ db, searchconsole });
      console.log('📡 [gscDemandScan]', result);
      return res.status(200).json({ success: true, ...result });
    } catch (error) {
      console.error('❌ [gscDemandScan] failed:', error);
      return res.status(500).json({ error: error.message });
    }
  }
);

exports.contentDecayScan = functions.onRequest(
  {
    secrets: [appClientSecret],
    region: 'us-central1',
    timeoutSeconds: 180,
    memory: '256MiB',
  },
  async (req, res) => {
    if (!isAuthorized(req)) return res.status(403).json({ error: 'Unauthorized' });
    try {
      const result = await runContentDecayScan({ db });
      console.log('📉 [contentDecayScan]', result);
      return res.status(200).json({ success: true, ...result });
    } catch (error) {
      console.error('❌ [contentDecayScan] failed:', error);
      return res.status(500).json({ error: error.message });
    }
  }
);

exports.serpGapScan = functions.onRequest(
  {
    secrets: [appClientSecret, vertexApiKey],
    region: 'us-central1',
    timeoutSeconds: 180,
    memory: '256MiB',
  },
  async (req, res) => {
    if (!isAuthorized(req)) return res.status(403).json({ error: 'Unauthorized' });
    try {
      const budget = await costGuard.checkBudget(db);
      if (!budget.ok) {
        console.warn('⏸ [serpGapScan] costGuard budget exceeded, skipping run', budget);
        return res.status(200).json({ success: false, skipped: 'cost_guard_exceeded', ...budget });
      }

      const geminiClient = createGeminiClient(vertexApiKey.value(), { model: 'gemini-3.6-flash' });
      const wrappedClient = {
        async callJSON(args) {
          const result = await geminiClient.callJSON(args);
          // Best-effort usage accounting — Gemini's REST response carries
          // usageMetadata, but callJSON only returns the parsed JSON payload,
          // so this is a rough per-call estimate rather than exact token
          // counts. Good enough for a circuit-breaker-style guard.
          await costGuard.recordUsage(db, 'gemini', 1500, 200).catch(() => {});
          return result;
        },
      };

      const result = await runSerpGapScan({ db, fetchFn: fetch, geminiClient: wrappedClient });
      console.log('🔍 [serpGapScan]', result);
      return res.status(200).json({ success: true, ...result });
    } catch (error) {
      console.error('❌ [serpGapScan] failed:', error);
      return res.status(500).json({ error: error.message });
    }
  }
);
