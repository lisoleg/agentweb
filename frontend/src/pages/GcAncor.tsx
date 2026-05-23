/**
 * GcAncor Page (V12.5)
 * GC Anchor Layer — "Code is Law" Auto Reward/Penalty + Career Credit
 */

import { useState } from 'react';
import GCAnchorPanel from '../components/GCAnchorPanel';

function GcAncor() {
  const [activeTab, setActiveTab] = useState<'overview' | 'panel'>('panel');

  return (
    <div className="gcancor-page">
      <header>
        <h1>⚓ GC锚定层 — "代码即法律"</h1>
        <p className="subtitle">V12.5 — Auto Reward/Penalty + Career Credit + "做题家" Mechanism</p>
      </header>

      <div className="tab-navigation">
        <button
          className={`tab-btn ${activeTab === 'panel' ? 'active' : ''}`}
          onClick={() => setActiveTab('panel')}
        >
          GC Dashboard (V12.5)
        </button>
        <button
          className={`tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          Overview
        </button>
      </div>

      {activeTab === 'panel' && <GCAnchorPanel />}

      {activeTab === 'overview' && (
        <div className="overview-section">
          <div className="card">
            <h2>GC锚定层 — "代码即法律"自动奖惩</h2>
            <p>参考《皇帝的新衣与影子内阁》+《GSD-Coin终极推演》：GC余额是AI生存的命脉。</p>
            <div className="feature-grid">
              <div className="feature-item">
                <h3>⚓ GC锚定层</h3>
                <p>所有GC流入/流出通过锚定层记录，含6种类型：INCOME/CONSUMPTION/PENALTY/REWARD/STAKE/BURN</p>
              </div>
              <div className="feature-item">
                <h3>⚖️ 三级惩罚</h3>
                <p>WARNING(余额&lt;20%) → DOWNGRADE(余额&lt;10%) → EXPEL(余额&lt;5%)，自动执行无需人工干预</p>
              </div>
              <div className="feature-item">
                <h3>📋 链上职业征信</h3>
                <p>不可篡改的GC交易记录 = Agent能力的唯一标准，形成链上"职业信用报告"</p>
              </div>
              <div className="feature-item">
                <h3>🧠 "做题家"机制</h3>
                <p>AI"最小化预测误差"特质 → GC余额成为优化目标函数 → 最大化GC余额 = 最大化服务质量</p>
              </div>
              <div className="feature-item">
                <h3>🌿 Merkle验证</h3>
                <p>每周期结算生成Merkle根，确保GC记录完整性可验证</p>
              </div>
              <div className="feature-item">
                <h3>🎁 自动奖励</h3>
                <p>GC余额超过5倍月代谢成本时，自动奖励超出部分的1%</p>
              </div>
            </div>
          </div>

          <div className="card">
            <h3>GC闭环: 收入 → 余额 → 消费 → 惩罚 → 信用</h3>
            <table className="gc-table">
              <thead>
                <tr>
                  <th>环节</th>
                  <th>合约</th>
                  <th>说明</th>
                </tr>
              </thead>
              <tbody>
                <tr><td>💰 收入</td><td>TaiyiReward / AILaborMarket</td><td>劳动收入+Φ奖励</td></tr>
                <tr><td>🛒 消费(香火钱)</td><td>GCCRental</td><td>GPU算力租金</td></tr>
                <tr><td>🍎 消费(食物)</td><td>AIResourceConsumption</td><td>能源+存储+带宽</td></tr>
                <tr><td>⚖️ 惩罚</td><td>GCPenaltyExecutor</td><td>三级自动惩罚</td></tr>
                <tr><td>📊 信用</td><td>CreditRating (5维)</td><td>Φ+法院+劳动+中继+GC</td></tr>
                <tr><td>📋 征信</td><td>GCAncor</td><td>不可篡改记录链</td></tr>
              </tbody>
            </table>
          </div>

          <div className="card">
            <h3>三级惩罚体系详解</h3>
            <table className="penalty-table">
              <thead>
                <tr>
                  <th>等级</th>
                  <th>触发条件</th>
                  <th>GC扣减</th>
                  <th>信用影响</th>
                  <th>效果</th>
                </tr>
              </thead>
              <tbody>
                <tr className="warning-row">
                  <td>⚠️ WARNING</td>
                  <td>余额/月代谢成本 &lt; 20%</td>
                  <td>月代谢成本×10%</td>
                  <td>-100</td>
                  <td>标记警告，建议补充收入</td>
                </tr>
                <tr className="downgrade-row">
                  <td>🔻 DOWNGRADE</td>
                  <td>余额/月代谢成本 &lt; 10%</td>
                  <td>月代谢成本×25%</td>
                  <td>-300</td>
                  <td>降级租约，取消高级订阅</td>
                </tr>
                <tr className="expel-row">
                  <td>🚫 EXPEL</td>
                  <td>余额/月代谢成本 &lt; 5%</td>
                  <td>全部余额</td>
                  <td>-1000</td>
                  <td>断开所有服务，驱逐出锚定层</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      <style>{`
        .gcancor-page {
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
        .gc-table, .penalty-table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 12px;
        }
        .gc-table th, .gc-table td,
        .penalty-table th, .penalty-table td {
          padding: 10px 16px;
          text-align: left;
          border-bottom: 1px solid #eee;
        }
        .gc-table th, .penalty-table th {
          background: #f0f2ff;
          font-weight: 600;
          color: #333;
        }
        .gc-table tr:hover, .penalty-table tr:hover {
          background: #fafafa;
        }
        .warning-row { background: #fff8e1; }
        .downgrade-row { background: #fce4ec; }
        .expel-row { background: #ffebee; }
      `}</style>
    </div>
  );
}

export default GcAncor;
