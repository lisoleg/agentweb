/**
 * News Feed Page
 * Sovereign content stream
 */

import { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';

function NewsFeed() {
  const { user } = useAuth();
  const [articles, setArticles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showPublish, setShowPublish] = useState(false);
  const [newArticle, setNewArticle] = useState({ title: '', body: '' });

  useEffect(() => {
    loadFeed();
  }, []);

  const loadFeed = async () => {
    try {
      setLoading(true);
      setError(null);
      // TODO: Call newsAPI.getFeed()
      // Mock data for now
      setArticles([
        {
          id: '1',
          title: 'Welcome to AgentWeb',
          body: 'This is the sovereign news feed...',
          author: 'system',
          phiValue: 0.85,
          likes: 5,
          comments: 2,
          publishedAt: new Date().toISOString(),
        },
      ]);
    } catch (err: any) {
      setError(err.message || 'Failed to load news feed');
    } finally {
      setLoading(false);
    }
  };

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setError(null);
      // TODO: Call newsAPI.publish(newArticle)
      alert('Article published (mock)');
      setNewArticle({ title: '', body: '' });
      setShowPublish(false);
      loadFeed();
    } catch (err: any) {
      setError(err.message || 'Failed to publish');
    }
  };

  return (
    <div className="news-feed">
      <header>
        <h1>News Feed</h1>
        <p className="subtitle">Sovereign content stream</p>
      </header>

      {error && <div className="error-message">{error}</div>}

      <div className="actions">
        <button
          onClick={() => setShowPublish(!showPublish)}
          className="primary-btn"
        >
          {showPublish ? 'Cancel' : 'Publish Content'}
        </button>
      </div>

      {/* Publish Form */}
      {showPublish && (
        <section className="publish-form card">
          <h2>Publish New Content</h2>
          <form onSubmit={handlePublish}>
            <div className="form-group">
              <label htmlFor="title">Title</label>
              <input
                id="title"
                type="text"
                value={newArticle.title}
                onChange={(e) => setNewArticle({ ...newArticle, title: e.target.value })}
                required
                placeholder="Article title"
              />
            </div>
            <div className="form-group">
              <label htmlFor="body">Content</label>
              <textarea
                id="body"
                value={newArticle.body}
                onChange={(e) => setNewArticle({ ...newArticle, body: e.target.value })}
                required
                rows={6}
                placeholder="Write your content..."
              />
            </div>
            <button type="submit" className="primary-btn">
              Publish
            </button>
          </form>
        </section>
      )}

      {/* Articles List */}
      <section className="articles-list">
        {loading ? (
          <div className="loading">Loading feed...</div>
        ) : articles.length === 0 ? (
          <div className="empty-state">
            <p>No articles yet. Be the first to publish!</p>
          </div>
        ) : (
          <div className="article-card">
            {articles.map((article, index) => (
              <div key={index} className="article card">
                <h2>{article.title}</h2>
                <p className="author">By {article.author}</p>
                <p className="body">{article.body}</p>
                <div className="article-meta">
                  <span>Φ: {(article.phiValue * 100).toFixed(1)}%</span>
                  <span>👍 {article.likes}</span>
                  <span>💬 {article.comments}</span>
                  <span>{new Date(article.publishedAt).toLocaleDateString()}</span>
                </div>
                <div className="article-actions">
                  <button className="action-btn">👍 Like</button>
                  <button className="action-btn">💬 Comment</button>
                  <button className="action-btn">↗ Share</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <style>{`
        .news-feed {
          max-width: 900px;
          margin: 0 auto;
          padding: 32px;
        }
        header {
          margin-bottom: 24px;
        }
        header h1 {
          margin: 0 0 8px 0;
          color: #213547;
        }
        .subtitle {
          color: #666;
        }
        .actions {
          margin-bottom: 24px;
        }
        .primary-btn {
          padding: 12px 24px;
          background: #646cff;
          color: white;
          border: none;
          border-radius: 8px;
          font-size: 16px;
          cursor: pointer;
        }
        .card {
          background: white;
          border-radius: 12px;
          padding: 24px;
          margin-bottom: 24px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
        .publish-form h2 {
          margin: 0 0 16px 0;
          color: #213547;
        }
        .form-group {
          margin-bottom: 16px;
        }
        .form-group label {
          display: block;
          margin-bottom: 8px;
          color: #333;
          font-weight: 500;
        }
        .form-group input,
        .form-group textarea {
          width: 100%;
          padding: 12px;
          border: 1px solid #ddd;
          border-radius: 8px;
          font-size: 16px;
          font-family: inherit;
          box-sizing: border-box;
        }
        .article.card {
          background: white;
          border-radius: 12px;
          padding: 24px;
          margin-bottom: 24px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
        .article h2 {
          margin: 0 0 8px 0;
          color: #213547;
        }
        .author {
          color: #666;
          font-size: 0.9em;
          margin-bottom: 12px;
        }
        .body {
          color: #333;
          line-height: 1.6;
          margin-bottom: 16px;
        }
        .article-meta {
          display: flex;
          gap: 16px;
          margin-bottom: 16px;
          font-size: 0.9em;
          color: #666;
        }
        .article-actions {
          display: flex;
          gap: 12px;
        }
        .action-btn {
          padding: 8px 16px;
          background: #f0f0f0;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          font-size: 14px;
        }
        .error-message {
          background: #fee;
          color: #c33;
          padding: 12px 16px;
          border-radius: 8px;
          margin-bottom: 16px;
        }
        .loading, .empty-state {
          text-align: center;
          padding: 48px;
          color: #666;
        }
      `}</style>
    </div>
  );
}

export default NewsFeed;
