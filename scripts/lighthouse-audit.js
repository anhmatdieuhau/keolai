#!/usr/bin/env node
/**
 * 2.1 / 2.2 — Mobile & Speed Audit Script
 * Runs Lighthouse on keolaigiamhom.vn (mobile + desktop)
 * and outputs a human-readable report with pass/fail thresholds.
 *
 * Usage:
 *   node scripts/lighthouse-audit.js
 *   node scripts/lighthouse-audit.js --url https://keolaigiamhom.vn/articles/ky-thuat-trong-keo-lai
 *
 * Requires: npm install -g lighthouse
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const TARGET_URL = process.argv.find(a => a.startsWith('--url='))?.split('=')[1]
  || 'https://keolaigiamhom.vn';

const THRESHOLDS = {
  performance: 80,
  accessibility: 90,
  'best-practices': 85,
  seo: 90,
  lcp: 2500,   // ms
  fid: 100,    // ms
  cls: 0.1,
  fcp: 1800,   // ms
  tti: 3800,   // ms
};

const REPORT_DIR = path.join(__dirname, '../lighthouse-reports');
if (!fs.existsSync(REPORT_DIR)) fs.mkdirSync(REPORT_DIR, { recursive: true });

const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

async function runAudit(formFactor) {
  const preset = formFactor === 'mobile' ? 'mobile' : 'desktop';
  const outputPath = path.join(REPORT_DIR, `${preset}-${timestamp}.json`);

  console.log(`\n🔍 Running Lighthouse (${preset.toUpperCase()}) on ${TARGET_URL}...`);

  try {
    execSync(
      `lighthouse "${TARGET_URL}" \
        --output=json \
        --output-path="${outputPath}" \
        --chrome-flags="--headless --no-sandbox --disable-gpu" \
        --form-factor=${preset} \
        --throttling-method=${preset === 'mobile' ? 'simulate' : 'provided'} \
        --quiet`,
      { stdio: 'pipe' }
    );
  } catch (e) {
    // lighthouse exits non-zero on low scores — still read JSON
    if (!fs.existsSync(outputPath)) {
      console.error('❌ Lighthouse failed to produce output. Is lighthouse installed? Run: npm install -g lighthouse');
      process.exit(1);
    }
  }

  const report = JSON.parse(fs.readFileSync(outputPath, 'utf-8'));
  const cats = report.categories;
  const audits = report.audits;

  const scores = {
    performance: Math.round(cats.performance?.score * 100),
    accessibility: Math.round(cats.accessibility?.score * 100),
    'best-practices': Math.round(cats['best-practices']?.score * 100),
    seo: Math.round(cats.seo?.score * 100),
  };

  const vitals = {
    lcp: Math.round(audits['largest-contentful-paint']?.numericValue || 0),
    fid: Math.round(audits['max-potential-fid']?.numericValue || 0),
    cls: Math.round((audits['cumulative-layout-shift']?.numericValue || 0) * 1000) / 1000,
    fcp: Math.round(audits['first-contentful-paint']?.numericValue || 0),
    tti: Math.round(audits['interactive']?.numericValue || 0),
  };

  // Print results
  console.log(`\n${'═'.repeat(55)}`);
  console.log(`  LIGHTHOUSE RESULTS — ${preset.toUpperCase()}`);
  console.log(`${'═'.repeat(55)}`);

  for (const [key, score] of Object.entries(scores)) {
    const threshold = THRESHOLDS[key];
    const pass = score >= threshold;
    const icon = pass ? '✅' : '❌';
    const bar = '█'.repeat(Math.floor(score / 5)) + '░'.repeat(20 - Math.floor(score / 5));
    console.log(`  ${icon} ${key.padEnd(18)} ${bar} ${String(score).padStart(3)}/100  (min: ${threshold})`);
  }

  console.log(`\n  CORE WEB VITALS:`);
  const vitalChecks = [
    { name: 'LCP', value: `${vitals.lcp}ms`, pass: vitals.lcp <= THRESHOLDS.lcp, target: '≤2500ms' },
    { name: 'FID', value: `${vitals.fid}ms`, pass: vitals.fid <= THRESHOLDS.fid, target: '≤100ms' },
    { name: 'CLS', value: String(vitals.cls), pass: vitals.cls <= THRESHOLDS.cls, target: '≤0.1' },
    { name: 'FCP', value: `${vitals.fcp}ms`, pass: vitals.fcp <= THRESHOLDS.fcp, target: '≤1800ms' },
    { name: 'TTI', value: `${vitals.tti}ms`, pass: vitals.tti <= THRESHOLDS.tti, target: '≤3800ms' },
  ];

  for (const v of vitalChecks) {
    console.log(`  ${v.pass ? '✅' : '❌'} ${v.name.padEnd(5)} ${v.value.padEnd(10)} (target: ${v.target})`);
  }

  // Opportunity audits
  const opportunities = [
    'uses-optimized-images',
    'uses-responsive-images',
    'render-blocking-resources',
    'unused-css-rules',
    'unused-javascript',
    'uses-text-compression',
    'uses-long-cache-ttl',
  ].map(id => {
    const a = audits[id];
    if (!a || a.score === 1) return null;
    const savings = a.details?.overallSavingsMs
      ? `save ~${Math.round(a.details.overallSavingsMs)}ms`
      : a.displayValue || '';
    return { id, title: a.title, savings };
  }).filter(Boolean);

  if (opportunities.length > 0) {
    console.log(`\n  OPPORTUNITIES:`);
    for (const op of opportunities) {
      console.log(`  ⚠️  ${op.title} — ${op.savings}`);
    }
  }

  console.log(`\n  📄 Full report: ${outputPath}\n`);

  return { scores, vitals, pass: Object.entries(scores).every(([k, v]) => v >= THRESHOLDS[k]) };
}

(async () => {
  const mobile = await runAudit('mobile');
  const desktop = await runAudit('desktop');

  console.log(`\n${'═'.repeat(55)}`);
  console.log(`  SUMMARY`);
  console.log(`${'═'.repeat(55)}`);
  console.log(`  Mobile:  ${mobile.pass ? '✅ PASS' : '❌ NEEDS WORK'}`);
  console.log(`  Desktop: ${desktop.pass ? '✅ PASS' : '❌ NEEDS WORK'}`);
  console.log(`\n  Reports saved to: ${REPORT_DIR}`);
  console.log(`${'═'.repeat(55)}\n`);

  // Write summary JSON for CI use
  const summaryPath = path.join(REPORT_DIR, `summary-${timestamp}.json`);
  fs.writeFileSync(summaryPath, JSON.stringify({ url: TARGET_URL, timestamp, mobile, desktop }, null, 2));

  process.exit(mobile.pass && desktop.pass ? 0 : 1);
})();
