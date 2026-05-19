/**
 * Dashboard Page
 * Main landing page after login
 */

import { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';

function Dashboard() {
  const { user, logout } = useAuth();
  const [stats, setStats] = useState({
    phiValue: 0,
    agentCount: 0,
    vcCount: 0,
  });

  useEffect(() => {
    // TODO: Fetch actual stats
    setStats({
      phiValue: 0.75,
      agentCount: 3,
      vcCount: 5,
    });
  }, []);

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <h1>Welcome, {user?.username}!</h1>
        <button onClick={logout} className="logout-btn">
          Logout
        </button>
      </header>

      <div className="dashboard-content">
        {/* Φ Value Card */}
        <div className="card phi-card">
          <h2>Φ Value</h2>
          <div className="phi-value">{(stats.phiValue * 100).toFixed(1)}%</div>
          <p className="description">Your integrated information value</p>
        </div>

        {/* DID Card */}
        <div className="card did-card">
          <h2>Your DID</h2>
          <div className="did-value">
            {user?.did ? (
              <code>{user.did}</code>
            ) : (
              <span className="not-available">Not created yet</span>
            )}
          </div>
          <a href="/identity" className="card-link">
            Manage Identity →
          </a>
        </div>

        {/* Agents Card */}
        <div className="card agents-card">
          <h2>Your Agents</h2>
          <div className="count">{stats.agentCount}</div>
          <a href="/agent" className="card-link">
            View Agents →
          </a>
        </div>

        {/* VCs Card */}
        <div className="card vc-card">
          <h2>Verifiable Credentials</h2>
          <div className="count">{stats.vcCount}</div>
          <p className="description">Credentials issued to you</p>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="quick-actions">
        <h3>Quick Actions</h3>
        <div className="action-buttons">
          <a href="/identity" className="action-btn">
            📇 Manage Identity
          </a>
          <a href="/agent" className="action-btn">
            🤖 Agent Workbench
          </a>
          <a href="/governance" className="action-btn">
            🗳 Governance
          </a>
          <a href="/news" className="action-btn">
            📰 News Feed
          </a>
        </div>
      </div>

      <style>{`
        .dashboard {
          max-width: 1200px;
          margin: 0 auto;
          padding: 32px;
        }
        .dashboard-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 32px;
        }
        .dashboard-header h1 {
          margin: 0;
          color: #213547;
        }
        .logout-btn {
          padding: 8px 24px;
          background: #fee;
          color: #c33;
          border: 1px solid #fcc;
          border-radius: 8px;
          cursor: pointer;
        }
        .dashboard-content {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          gap: 24px;
          margin-bottom: 48px;
        }
        .card {
          background: white;
          border-radius: 12px;
          padding: 24px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
          transition: transform 0.2s;
        }
        .card:hover {
          transform: translateY(-4px);
          box-shadow: 0 4px 16px rgba(0,0,0,0.15);
        }
        .card h2 {
          margin: 0 0 16px 0;
          font-size: 1.2em;
          color: #666;
        }
        .phi-value {
          font-size: 3em;
          font-weight: bold;
          color: #646cff;
        }
        .did-value code {
          display: block;
          background: #f5f5f5;
          padding: 8px;
          border-radius: 4px;
          font-size: 0.85em;
          word-break: break-all;
        }
        .not-available {
          color: #999;
        }
        .count {
          font-size: 3em;
          font-weight: bold;
          color: #52c41a;
        }
        .description {
          color: #999;
          font-size: 0.9em;
          margin-top: 8px;
        }
        .card-link {
          display: inline-block;
          margin-top: 16px;
          color: #646cff;
          text-decoration: none;
        }
        .quick-actions {
          background: white;
          border-radius: 12px;
          padding: 24px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
        .quick-actions h3 {
          margin: 0 0 16px 0;
          color: #213547;
        }
        .action-buttons {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 16px;
        }
        .action-btn {
          display: block;
          padding: 16px;
          background: #f8f9fa;
          border-radius: 8px;
          text-decoration: none;
          color: #213547;
          font-weight: 500;
          text-align: center;
          transition: background 0.2s;
        }
        .action-btn:hover {
          background: #e9ecef;
        }
      `}</style>
    </div>
  );
}

export default Dashboard;
