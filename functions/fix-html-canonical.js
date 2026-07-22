/**
 * Fix canonical references inside HTML content of 4 articles
 * Uses Firebase Admin SDK with application default credentials
 */
const admin = require('firebase-admin');

admin.initializeApp({
    projectId: 'keolai-63ec1',
});
const db = admin.firestore();

const SLUGS = [
    'ky-thuat-tia-canh-keo-lai',
    'mat-do-trong-keo-lai',
    'so-sanh-keo-lai-va-keo-tai-tuong',
    'xu-ly-dat-truoc-khi-trong-keo-lai',
];

async function main() {
    for (const slug of SLUGS) {
        const ref = db.collection('articles').doc(slug);
        const snap = await ref.get();
        if (!snap.exists) { console.log(`SKIP ${slug}`); continue; }

        const html = snap.data().html || '';
        const oldDomain = 'keolai-63ec1.web.app';
        const count = (html.match(new RegExp(oldDomain, 'g')) || []).length;

        if (count === 0) {
            console.log(`✅ ${slug} — NO old domain refs found`);
        } else {
            const fixed = html.replace(new RegExp(oldDomain, 'g'), 'keolaigiamhom.vn');
            await ref.update({ html: fixed });
            console.log(`✅ ${slug} — Fixed ${count} references in HTML`);
        }
    }
    console.log('\nDone!');
    process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
