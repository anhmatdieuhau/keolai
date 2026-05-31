'use client';
import { useState, useEffect } from 'react';

const API_URL = 'https://us-central1-keolai-63ec1.cloudfunctions.net/listArticles';
const PAGE_SIZE = 6;

export default function AutoGenArticles({ staticArticles = [] }) {
  const [aiArticles, setAiArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  useEffect(() => {
    fetch(API_URL)
      .then((r) => r.json())
      .then((data) => {
        setAiArticles(data.articles || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  // Merge static + AI, static first
  const allArticles = [
    ...staticArticles.map((a) => ({ ...a, type: 'static' })),
    ...aiArticles.map((a) => ({ ...a, type: 'ai' })),
  ];

  const visible = allArticles.slice(0, visibleCount);
  const hasMore = visibleCount < allArticles.length;

  if (loading && !staticArticles.length) {
    return (
      <div className="knowledge-grid">
        {[1, 2, 3].map((i) => (
          <div key={i} className="knowledge-card skeleton">
            <div className="skeleton-img" />
            <div className="skeleton-title" />
            <div className="skeleton-text" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <>
      <div className="knowledge-grid">
        {visible.map((a) =>
          a.type === 'static' ? (
            <article key={a.slug}>
              <a href={`/articles/${a.slug}`} className="knowledge-card" style={{ textDecoration: 'none', color: 'inherit' }}>
                <div className="knowledge-img">
                  <img src={a.image} alt={a.title} loading="lazy" />
                </div>
                <h3>{a.title}</h3>
                <p>{a.description}</p>
              </a>
            </article>
          ) : (
            <article key={a.slug}>
              <a
                href={a.url}
                className="knowledge-card"
                style={{ textDecoration: 'none', color: 'inherit' }}
              >
                <div className="knowledge-img" style={{ background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>
                  <span style={{ color: '#fff', fontSize: '1.1rem', fontWeight: 600, textAlign: 'center', lineHeight: 1.4 }}>
                    {a.title.split('—')[0]?.trim() || a.title}
                  </span>
                </div>
                <h3>{a.title}</h3>
                <p>{a.description}</p>
                {a.publishedAt && (
                  <span className="article-date">
                    {new Date(a.publishedAt).toLocaleDateString('vi-VN')}
                  </span>
                )}
              </a>
            </article>
          )
        )}
        {loading && (
          <>
            {[1, 2, 3].map((i) => (
              <div key={`sk-${i}`} className="knowledge-card skeleton">
                <div className="skeleton-img" />
                <div className="skeleton-title" />
                <div className="skeleton-text" />
              </div>
            ))}
          </>
        )}
      </div>

      {hasMore && !loading && (
        <div style={{ textAlign: 'center', marginTop: '2rem' }}>
          <button
            className="btn btn-outline"
            onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
            style={{ cursor: 'pointer' }}
          >
            Xem thêm bài viết ({allArticles.length - visibleCount} bài còn lại)
          </button>
        </div>
      )}
    </>
  );
}
