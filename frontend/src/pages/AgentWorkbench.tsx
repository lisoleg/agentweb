/**
 * Agent Workbench Page
 * Register and manage AI Agents
 */

import { useEffect, useState } from 'react';
import { agentAPI } from '../services/api';
import { useAuth } from '../hooks/useAuth';

function AgentWorkbench() {
  const { user } = useAuth();
  const [agents, setAgents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showRegister, setShowRegister] = useState(false);
  const [registerData, setRegisterData] = useState({
    name: '',
    description: '',
    endpoint: '',
  });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadAgents();
  }, []);

  const loadAgents = async () => {
    try {
      setLoading(true);
      setError(null);
      const response: any = await agentAPI.list();
      setAgents(response.data?.agents || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load agents');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setError(null);
      await agentAPI.register(registerData);
      setShowRegister(false);
      setRegisterData({ name: '', description: '', endpoint: '' });
      loadAgents();
    } catch (err: any) {
      setError(err.message || 'Failed to register agent');
    }
  };

  return (
    <div className="agent-workbench">
      <header>
        <h1>Agent Workbench</h1>
        <p className="subtitle">Register and manage your AI Agents</p>
      </header>

      {error && <div className="error-message">{error}</div>}

      <div className="actions">
        <button
          onClick={() => setShowRegister(!showRegister)}
          className="primary-btn"
        >
          {showRegister ? 'Cancel' : 'Register New Agent'}
        </button>
      </div>

      {/* Register Form */}
      {showRegister && (
        <section className="register-form card">
          <h2>Register New Agent</h2>
          <form onSubmit={handleRegister}>
            <div className="form-group">
              <label htmlFor="name">Agent Name</label>
              <input
                id="name"
                type="text"
                value={registerData.name}
                onChange={(e) => setRegisterData({ ...registerData, name: e.target.value })}
                required
                placeholder="My AI Agent"
              />
            </div>

            <div className="form-group">
              <label htmlFor="description">Description</label>
              <textarea
                id="description"
                value={registerData.description}
                onChange={(e) => setRegisterData({ ...registerData, description: e.target.value })}
                placeholder="Describe what your agent does..."
                rows={3}
              />
            </div>

            <div className="form-group">
              <label htmlFor="endpoint">API Endpoint (Optional)</label>
              <input
                id="endpoint"
                type="url"
                value={registerData.endpoint}
                onChange={(e) => setRegisterData({ ...registerData, endpoint: e.target.value })}
                placeholder="https://api.example.com/agent"
              />
            </div>

            <button type="submit" className="primary-btn">
              Register Agent
            </button>
          </form>
        </section>
      )}

      {/* Agents List */}
      <section className="agents-list">
        <h2>Your Agents</h2>
        {loading ? (
          <div className="loading">Loading agents...</div>
        ) : agents.length === 0 ? (
          <div className="empty-state">
            <p>No agents registered yet.</p>
            <p>Register your first AI Agent to get started!</p>
          </div>
        ) : (
          <div className="agent-cards">
            {agents.map((agent, index) => (
              <div key={index} className="agent-card card">
                <h3>{agent.name}</h3>
                <p className="agent-id">ID: {agent.agentId}</p>
                {agent.description && <p className="description">{agent.description}</p>}
                <div className="agent-meta">
                  <span>Reputation: {agent.reputation}%</span>
                  <span>Status: {agent.active ? 'Active' : 'Inactive'}</span>
                </div>
                {agent.endpoint && (
                  <a href={agent.endpoint} target="_blank" rel="noopener noreferrer" className="endpoint-link">
                    View API →
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <style>{`
        .agent-workbench {
          max-width: 1200px;
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
        .register-form h2 {
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
        .agent-cards {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
          gap: 24px;
        }
        .agent-card {
          background: white;
          border-radius: 12px;
          padding: 24px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
        .agent-card h3 {
          margin: 0 0 8px 0;
          color: #213547;
        }
        .agent-id {
          color: #999;
          font-size: 0.85em;
          word-break: break-all;
          margin-bottom: 8px;
        }
        .description {
          color: #666;
          margin-bottom: 12px;
        }
        .agent-meta {
          display: flex;
          gap: 16px;
          margin-bottom: 12px;
          font-size: 0.9em;
          color: #666;
        }
        .endpoint-link {
          display: inline-block;
          color: #646cff;
          text-decoration: none;
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

export default AgentWorkbench;
