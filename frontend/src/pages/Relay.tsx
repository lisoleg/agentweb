/**
 * Relay Page (V12.0)
 * Cross-chain relay + compute-integrated network management
 */

import { useState } from 'react';
import RelayPanel from '../components/RelayPanel';

function Relay() {
  const [activeTab, setActiveTab] = useState<'overview' | 'relay'>('relay');

  return (
    <div className="relay-page">
      <header>
        <h1>🔀 Cross-Chain Relay</h1>
        <p className="subtitle">V12.0 — Compute-Integrated Relay Network + Dynamic Fee Scheduling</p>
      </header>

      <div className="tab-navigation">
        <button
          className={`tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          Overview
        </button>
        <button
          className={`tab-btn ${activeTab === 'relay' ? 'active' : ''}`}
          onClick={() => setActiveTab('relay')}
        >
          Relay Management (V12.0)
        </button>
      </div>

      {activeTab === 'relay' && <RelayPanel />}

      {activeTab === 'overview' && (
        <div className="overview-section">
          <div className="card">
            <h2>6G-Σ 融合架构 — Layer2 通算一体</h2>
            <p>RelayRegistry 支持 MESSAGE_RELAY 和 COMPUTE_RELAY 双类型任务，实现消息中继和算力中继的统一调度。</p>
            <div className="feature-grid">
              <div className="feature-item">
                <h3>🔗 智能路由</h3>
                <p>多因子路由决策：延迟 + 费率 + 声誉 + 负载均衡</p>
              </div>
              <div className="feature-item">
                <h3>💰 动态费率</h3>
                <p>信用联动费率折扣 + 低峰折扣 + 紧急加价</p>
              </div>
              <div className="feature-item">
                <h3>🛡️ 故障自愈</h3>
                <p>自动检测故障节点，重新路由到健康节点</p>
              </div>
              <div className="feature-item">
                <h3>📊 声誉质押</h3>
                <p>中继器质押Σ-Φ代币，根据服务质量累积声誉</p>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .relay-page {
          max-width: 1200px;
          margin: 0 auto;
          padding: 32px;
        }
        header h1 {
          margin: 0 0 8px 0;
          color: #213547;
        }
        .subtitle {
          color: #666;
          margin: 0 0 24px 0;
        }
        .tab-navigation {
          display: flex;
          gap: 8px;
          margin-bottom: 24px;
        }
        .tab-btn {
          padding: 10px 20px;
          border: 2px solid #646cff;
          background: transparent;
          color: #646cff;
          border-radius: 8px;
          font-size: 14px;
          cursor: pointer;
          transition: all 0.2s;
        }
        .tab-btn.active {
          background: #646cff;
          color: white;
        }
        .card {
          background: white;
          border-radius: 12px;
          padding: 24px;
          margin-bottom: 24px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
        .feature-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
          gap: 16px;
          margin-top: 16px;
        }
        .feature-item {
          background: #f8f9fa;
          border-radius: 8px;
          padding: 16px;
        }
        .feature-item h3 {
          margin: 0 0 8px 0;
          font-size: 1em;
        }
        .feature-item p {
          margin: 0;
          color: #666;
          font-size: 0.9em;
        }
      `}</style>
    </div>
  );
}

export default Relay;
