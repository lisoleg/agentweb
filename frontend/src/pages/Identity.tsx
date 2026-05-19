/**
 * Identity Page
 * DID management and Verifiable Credentials
 */

import { useEffect, useState } from 'react';
import { didAPI, vcAPI } from '../services/api';
import { useAuth } from '../hooks/useAuth';

function Identity() {
  const { user } = useAuth();
  const [did, setDid] = useState<string | null>(null);
  const [didDocument, setDidDocument] = useState<any>(null);
  const [vcs, setVcs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Try to get user's DID
      try {
        const didResponse: any = await didAPI.getMyDID();
        if (didResponse.data?.did) {
          setDid(didResponse.data.did);
          const resolveResponse: any = await didAPI.resolve(didResponse.data.did);
          setDidDocument(resolveResponse.data?.document);
        }
      } catch (err) {
        // DID not created yet
        console.log('No DID found, will create on demand');
      }

      // Load VCs if DID exists
      if (did) {
        const vcResponse: any = await vcAPI.list(did);
        setVcs(vcResponse.data?.vcs || []);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load identity data');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateDID = async () => {
    try {
      setError(null);
      const response: any = await didAPI.create(user!.id);
      setDid(response.data?.did);
      setDidDocument(response.data?.document);
    } catch (err: any) {
      setError(err.message || 'Failed to create DID');
    }
  };

  if (loading) {
    return <div className="loading">Loading identity...</div>;
  }

  return (
    <div className="identity-page">
      <header>
        <h1>Digital Identity</h1>
        <p className="subtitle">Manage your DID and Verifiable Credentials</p>
      </header>

      {error && <div className="error-message">{error}</div>}

      {/* DID Section */}
      <section className="did-section card">
        <h2>Your DID</h2>
        {did ? (
          <div>
            <div className="did-display">
              <code>{did}</code>
              <button
                onClick={() => navigator.clipboard.writeText(did)}
                className="copy-btn"
              >
                Copy
              </button>
            </div>

            {didDocument && (
              <div className="did-details">
                <h3>DID Document</h3>
                <pre>{JSON.stringify(didDocument, null, 2)}</pre>
              </div>
            )}
          </div>
        ) : (
          <div>
            <p>You don't have a DID yet.</p>
            <button onClick={handleCreateDID} className="primary-btn">
              Create DID
            </button>
          </div>
        )}
      </section>

      {/* VCs Section */}
      <section className="vc-section card">
        <h2>Verifiable Credentials</h2>
        {vcs.length === 0 ? (
          <p>No credentials yet.</p>
        ) : (
          <div className="vc-list">
            {vcs.map((vc, index) => (
              <div key={index} className="vc-card">
                <h3>{vc.type?.join(', ')}</h3>
                <p>Issuer: {vc.issuer}</p>
                <p>Issued: {new Date(vc.issuanceDate).toLocaleDateString()}</p>
              </div>
            ))}
          </div>
        )}
      </section>

      <style>{`
        .identity-page {
          max-width: 900px;
          margin: 0 auto;
          padding: 32px;
        }
        header {
          margin-bottom: 32px;
        }
        header h1 {
          margin: 0 0 8px 0;
          color: #213547;
        }
        .subtitle {
          color: #666;
        }
        .card {
          background: white;
          border-radius: 12px;
          padding: 24px;
          margin-bottom: 24px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
        .card h2 {
          margin: 0 0 16px 0;
          color: #213547;
        }
        .did-display {
          display: flex;
          gap: 12px;
          align-items: center;
          background: #f5f5f5;
          padding: 12px;
          border-radius: 8px;
          margin-bottom: 16px;
        }
        .did-display code {
          flex: 1;
          word-break: break-all;
        }
        .copy-btn {
          padding: 8px 16px;
          background: #646cff;
          color: white;
          border: none;
          border-radius: 6px;
          cursor: pointer;
        }
        .did-details pre {
          background: #f5f5f5;
          padding: 16px;
          border-radius: 8px;
          overflow-x: auto;
          font-size: 0.85em;
        }
        .vc-list {
          display: grid;
          gap: 16px;
        }
        .vc-card {
          padding: 16px;
          border: 1px solid #e0e0e0;
          border-radius: 8px;
        }
        .vc-card h3 {
          margin: 0 0 8px 0;
          color: #646cff;
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
        .error-message {
          background: #fee;
          color: #c33;
          padding: 12px 16px;
          border-radius: 8px;
          margin-bottom: 16px;
        }
        .loading {
          text-align: center;
          padding: 48px;
          color: #666;
        }
      `}</style>
    </div>
  );
}

export default Identity;
