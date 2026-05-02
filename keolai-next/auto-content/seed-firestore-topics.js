#!/usr/bin/env node
/**
 * Seed Firestore topics collection from local .mdx files
 * Reads frontmatter, creates topic docs for the legacy pipeline to consume.
 * Only adds topics that DON'T already exist in Firestore.
 */

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// Init Firebase Admin
const serviceAccount = require('../../functions/service-account-key.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'keolai-63ec1'
});
const db = admin.firestore();

// Existing Firestore topic slugs (already in pipeline)
const EXISTING_SLUGS = [
  'chi-phi-trong-1-hecta-keo-lai',
  'ky-thuat-tia-canh-keo-lai',
  'mat-do-trong-keo-lai',
  'phong-tru-sau-benh-keo-lai',
  'quy-trinh-bon-phan-keo-lai',
  'so-sanh-keo-lai-va-keo-tai-tuong',
  'thu-hoach-keo-lai-dung-thoi-diem',
  'tuoi-nuoc-cho-keo-lai-moi-trong',
  'trong-keo-lai-xen-canh',
  'xu-ly-dat-truoc-khi-trong-keo-lai'
];

function parseFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return null;
  const lines = match[1].split('\n');
  const data = {};
  for (const line of lines) {
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    const key = line.substring(0, idx).trim();
    let val = line.substring(idx + 1).trim();
    // Remove surrounding quotes
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    data[key] = val;
  }
  return data;
}

function parseStats(statsStr) {
  if (!statsStr) return [];
  // Format: "value1:label1|value2:label2|..."
  return statsStr.split('|').map(pair => {
    const [value, label] = pair.split(':');
    return { value: (value || '').trim(), label: (label || '').trim() };
  }).filter(s => s.value && s.label);
}

async function main() {
  const contentDir = path.join(__dirname, '..', 'content');
  const files = fs.readdirSync(contentDir).filter(f => f.endsWith('.mdx')).sort();
  
  let added = 0;
  let skipped = 0;
  let priority = 11; // Start after existing topics

  for (const file of files) {
    const slug = file.replace('.mdx', '');
    
    // Skip if already in Firestore
    if (EXISTING_SLUGS.includes(slug)) {
      skipped++;
      continue;
    }

    const content = fs.readFileSync(path.join(contentDir, file), 'utf-8');
    const meta = parseFrontmatter(content);
    if (!meta || !meta.title) {
      console.log(`  SKIP (no frontmatter): ${slug}`);
      skipped++;
      continue;
    }

    const stats = parseStats(meta.stats);

    const topicData = {
      title: meta.title,
      description: meta.description || '',
      keywords: meta.keywords || '',
      slug: slug,
      label: meta.label || '',
      breadcrumb: meta.breadcrumb || '',
      priority: priority++,
      stats: stats,
      status: 'pending',
      createdAt: admin.firestore.Timestamp.now()
    };

    await db.collection('topics').doc(slug).set(topicData);
    console.log(`  + ${slug} (priority ${topicData.priority})`);
    added++;
  }

  console.log(`\nDone: ${added} topics added, ${skipped} skipped (already exist or no frontmatter)`);
  console.log(`Total pending topics = ${added} (enough for ${added} days of auto-generation)`);
  process.exit(0);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
