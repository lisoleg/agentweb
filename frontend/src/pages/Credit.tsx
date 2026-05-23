/**
 * Credit Page (V12.0)
 * Credit rating + ZK proof + reputation staking
 */

import { useState } from 'react';
import CreditPanel from '../components/CreditPanel';

function Credit() {
  const [activeTab, setActiveTab] = useState<'overview' | 'credit'>('credit');

  return (
    <div className="credit-page">
      <header>
        <h1>🏆 Credit Rating & ZK Proof</h1>
        <p className="subtitle">V12.0 — Four-Dimension Scoring + Zero-Knowledge Credit Verification</p>
      </header>

      <div className="tab-navigation">
        <button
          className={`tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          Overview
        </button>
        <button
          className={`tab-btn ${activeTab === 'credit' ? 'active' : ''}`}
          onClick={() => setActiveTab('credit')}
        >
          Credit Dashboard (V12.0)
        </button>
      </div>

      {activeTab === 'credit' && <CreditPanel />}

      {activeTab === 'overview' && (
        <div className="overview-section">
          <div className="card">
            <h2>6G-Σ 融合架构 — Layer1 可信基础设施</h2>
            <p>CreditRating 实现四维度评分、七级信用等级、费率/权限联动和信用衰减机制。</p>
            <div className="feature-grid">
              <div className="feature-item">
                <h3>📐 四维度评分</h3>
                <p>Φ值(30%) + 法院声誉(25%) + 劳动信用(25%) + 中继贡献(20%)</p>
              </div>
              <div className="feature-item">
                <h3>🏅 七级等级</h3>
                <p>AAA → AA → A → BBB → BB → B → CCC，等级决定费率和权限</p>
              </div>
              <div className="feature-item">
                <h3>🔐 ZK信用证明</h3>
                <p>零知识证明信用评分达标，不泄露具体分数（V13升级真实电路）</p>
              </div>
              <div className="feature-item">
                <h3>🤝 声誉担保</h3>
                <p>A+评级Agent可担保新Agent，罚没机制确保担保质量</p>
              </div>
            </div>
          </div>

          <div className="card">
            <h3>信用等级 ↔ 费率/权限联动表</h3>
            <table className="credit-table">
              <thead>
                <tr>
                  <th>等级</th>
                  <th>费率折扣</th>
                  <th>中继上限</th>
                  <th>担保资格</th>
                </tr>
              </thead>
              <tbody>
                <tr><td>AAA</td><td>50%</td><td>无限制</td><td>✅ 可担保5人</td></tr>
                <tr><td>AA</td><td>65%</td><td>100任务/日</td><td>✅ 可担保3人</td></tr>
                <tr><td>A</td><td>80%</td><td>50任务/日</td><td>✅ 可担保1人</td></tr>
                <tr><td>BBB</td><td>100%</td><td>20任务/日</td><td>❌</td></tr>
                <tr><td>BB</td><td>120%</td><td>10任务/日</td><td>❌</td></tr>
                <tr><td>B</td><td>150%</td><td>5任务/日</td><td>❌</td></tr>
                <tr><td>CCC</td><td>200%</td><td>1任务/日</td><td>❌</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      <style>{`
        .credit-page {
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
        .credit-table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 12px;
        }
        .credit-table th, .credit-table td {
          padding: 10px 16px;
          text-align: left;
          border-bottom: 1px solid #eee;
        }
        .credit-table th {
          background: #f0f2ff;
          font-weight: 600;
          color: #333;
        }
        .credit-table tr:hover {
          background: #fafafa;
        }
      `}</style>
    </div>
  );
}

export default Credit;
