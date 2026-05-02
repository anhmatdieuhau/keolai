export async function getArticleAnalytics(slug) {
  try {
    const res = await fetch(`https://us-central1-keolai-63ec1.cloudfunctions.net/contentAnalytics?slug=${slug}`);
    if (!res.ok) throw new Error('Failed to fetch analytics');
    return await res.json();
  } catch (err) {
    console.error('Analytics error:', err);
    return { views: 0, users: 0, avgTime: '0s', leads: 0, conversionRate: '0%' };
  }
}
