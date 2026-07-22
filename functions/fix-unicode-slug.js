/**
 * One-time script: Fix unicode slug for article "mua-vu-tây-nguyên-thang-4-2026"
 * Creates new document with ASCII slug, updates HTML canonical/og:url, deletes old doc
 * 
 * Run: cd projects/KeoLai/functions && node fix-unicode-slug.js
 */
const admin = require("firebase-admin");
const serviceAccount = require("./serviceAccountKey.json");

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

const OLD_SLUG = "mua-vu-tây-nguyên-thang-4-2026";
const NEW_SLUG = "mua-vu-tay-nguyen-thang-4-2026";
const NEW_URL = `https://keolaigiamhom.vn/articles/${NEW_SLUG}/`;

async function fixUnicodeSlug() {
    console.log(`🔄 Fixing unicode slug: ${OLD_SLUG} → ${NEW_SLUG}`);

    // 1. Read old document
    const oldDoc = await db.collection("articles").doc(OLD_SLUG).get();
    if (!oldDoc.exists) {
        console.error("❌ Old document not found!");
        process.exit(1);
    }

    const data = oldDoc.data();
    console.log(`📄 Found article: "${data.title}"`);

    // 2. Fix HTML content - replace all old URL references with new
    let fixedHtml = data.html;
    // Replace the unicode slug in ALL occurrences (canonical, og:url, schema.org, etc.)
    fixedHtml = fixedHtml.split(OLD_SLUG).join(NEW_SLUG);

    const replacements = (data.html.match(new RegExp(OLD_SLUG.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
    console.log(`🔧 Replaced ${replacements} occurrences of old slug in HTML`);

    // 3. Create new document with ASCII slug
    const newData = {
        ...data,
        slug: NEW_SLUG,
        url: NEW_URL,
        html: fixedHtml,
    };

    await db.collection("articles").doc(NEW_SLUG).set(newData);
    console.log(`✅ Created new document: articles/${NEW_SLUG}`);

    // 4. Delete old document
    await db.collection("articles").doc(OLD_SLUG).delete();
    console.log(`🗑️  Deleted old document: articles/${OLD_SLUG}`);

    // 5. Also fix the corresponding topic if exists
    const topicDoc = await db.collection("topics").doc(OLD_SLUG).get();
    if (topicDoc.exists) {
        const topicData = topicDoc.data();
        await db.collection("topics").doc(NEW_SLUG).set({
            ...topicData,
            slug: NEW_SLUG,
        });
        await db.collection("topics").doc(OLD_SLUG).delete();
        console.log(`✅ Fixed topic: ${OLD_SLUG} → ${NEW_SLUG}`);
    }

    console.log("\n🎉 Done! New article URL:", NEW_URL);
    process.exit(0);
}

fixUnicodeSlug().catch(err => {
    console.error("Fatal error:", err);
    process.exit(1);
});
