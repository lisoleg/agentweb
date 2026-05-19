/**
 * Governance Page
 * View and vote on proposals
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { governanceAPI } from '../services/api';
import { useAuth } from '../hooks/useAuth';

function Governance() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [proposals, setProposals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newProposal, setNewProposal] = useState({ description: '', deadlineDays: 7 });

  useEffect(() => {
    loadProposals();
  }, [));

  const loadProposals = async () => {
    try {
      setLoading(true);
      setError(null);
      const response: any = await governanceAPI.list();
      setProposals(response.data?.proposals || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load proposals');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateProposal = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setError(null);
      await governanceAPI.propose(newProposal.description, '');
      setNewProposal({ description: '', deadlineDays: 7 });
      setShowCreate(false);
      loadProposals();
    } catch (err: any) {
      setError(err.message || 'Failed to create proposal');
    }
  };

  const handleVote = async (proposalId: string, support: boolean) => {
    try {
      setError(null);
      await governanceAPI.vote(proposalId, support);
      loadProposals();
    } catch (err: any) {
      setError(err.message || 'Failed to vote');
    }
  };

  return (
    <div className="governance-page">
      <header>
        <h1>Governance</h1>
        <p className="subtitle">Participate in decentralized decision-making</p>
      </header>

      {error && <div className="error-message">{error}</div>}

      <div className="actions">
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="primary-btn"
        >
          {showCreate ? 'Cancel' : 'Create Proposal'}
        </button>
      </div>

      {/* Create Proposal Form */}
      {showCreate && (
        <section className="create-form card">
          <h2>Create New Proposal</h2>
          <form onSubmit={handleCreateProposal}>
            <div className="form-group">
              <label htmlFor="description">Description</label>
              <textarea
                id="description"
                value={newProposal.description}
                onChange={(e) => setNewProposal({ ...newProposal, description: e.target.value })}
                required
                rows={4}
                placeholder="Describe your proposal..."
              />
            </div>
            <div className="form-group">
              <label htmlFor="deadline">Voting Deadline (days)</label>
              <input
                id="deadline"
                type="number"
                min={1}
                max={30}
                value={newProposal.deadlineDays}
                onChange={(e) => setNewProposal({ ...newProposal, deadlineDays: parseInt(e.target.value) })}
              />
            </div>
            <button type="submit" className="primary-btn">
              Submit Proposal
            </button>
          </form>
        </section>
      )}

      {/* Proposals List */}
      <section className="proposals-list">
        <h2>All Proposals</h2>
        {loading ? (
          <div className="loading">Loading proposals...</div>
        ) : proposals.length === 0 ? (
          <div className="empty-state">
            <p>No proposals yet.</p>
          </div>
        ) : (
          <div className="proposal-cards">
            {proposals.map((p, index) => (
              <div key={index} className="proposal-card card">
                <h3>Proposal {p.proposalId?.substr(0, 16)}...</h3>
                <p className="description">{p.description}</p>
                <div className="proposal-meta">
                  <span>Status: <strong>{p.status}</strong></span>
                  <span>Creator: {p.creator}</span>
                </div>
                {p.status === 'Active' && (
                  <div className="vote-actions">
                    <button
                      onClick={() => handleVote(p.proposalId, true)}
                      className="vote-btn for"
                    >
                      Vote For ({p.forVotes?.toFixed(2)})
                    </button>
                    <button
                      onClick={() => handleVote(p.proposalId, false)}
                      className="vote-btn against"
                    >
                      Vote Against ({p.againstVotes?.toFixed(2)})
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <style>{`
        .governance-page {
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
        .create-form h2 {
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
        .proposals-list h2 {
          margin: 0 0 16px 0;
          color: #213547;
        }
        .proposal-cards {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
          gap: 24px;
        }
        .proposal-card {
          background: white;
          border-radius: 12px;
          padding: 24px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
        .proposal-card h3 {
          margin: 0 0 12px 0;
          color: #213547;
          font-size: 1em;
        }
        .description {
          color: #666;
          margin-bottom: 16px;
        }
        .proposal-meta {
          display: flex;
          gap: 16px;
          margin-bottom: 16px;
          font-size: 0.9em;
          color: #666;
        }
        .vote-actions {
          display: flex;
          gap: 12px;
        }
        .vote-btn {
          flex: 1;
          padding: 10px;
          border: none;
          border-radius: 8px;
          font-size: 14px;
          cursor: pointer;
          font-weight: 500;
        }
        .vote-btn.for {
          background: #52c41a;
          color: white;
        }
        .vote-btn.against {
          background: #ff4d4f;
          color: white;
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

export default Governance;
