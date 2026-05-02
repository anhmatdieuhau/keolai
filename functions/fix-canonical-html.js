/**
 * One-time script: Fix canonical URLs inside stored HTML for 4 articles
 * that still reference keolai-63ec1.web.app
 * 
 * Run: node fix-canonical-html.js
 */
const admin = require('firebase-admin');

// Initialize with service account
admin.initializeApp();
const db = admin.firestore();

const SLUGS_TO_FIX = [
    'ky-thuat-tia-canh-keo-lai',
    'mat-do-trong-keo-lai',
    'so-sanh-keo-lai-va-keo-tai-tuong',
    'xu-ly-dat-truoc-khi-trong-keo-lai',
];

const OLD_DOMAIN = 'https://keolai-63ec1.web.app';
const NEW_DOMAIN = 'https://keolaigiamhom.vn';

async function fixCanonicalHtml() {
    console.log('🔧 Fixing canonical URLs in stored HTML...\n');

    for (const slug of SLUGS_TO_FIX) {
        const docRef = db.collection('articles').doc(slug);
        const doc = await docRef.get();

        if (!doc.exists) {
            console.log(`⚠️  Article not found: ${slug}`);
            continue;
        }

        const data = doc.data();
        let html = data.html || '';

        // Count replacements
        const matches = (html.match(new RegExp(OLD_DOMAIN.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;

        if (matches === 0) {
            console.log(`✅ ${slug} — already correct (no .web.app references)`);
            continue;
        }

        // Replace all occurrences
        const fixedHtml = html.replace(new RegExp(OLD_DOMAIN.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), NEW_DOMAIN);

        await docRef.update({ html: fixedHtml });
        console.log(`✅ ${slug} — fixed ${matches} references (${OLD_DOMAIN} → ${NEW_DOMAIN})`);
    }

    console.log('\n🎉 Done! All canonical URLs updated.');
}

fixCanonicalHtml().catch(console.error);
