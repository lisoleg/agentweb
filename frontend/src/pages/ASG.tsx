/**
 * V17.0 ASG (Agent Security Gateway) — 页面入口
 *
 * 基于 MetaMask Agent Wallet 四道安全防线
 * AI Agent自主操作的隐私安全框架
 */
import React from 'react';
import ASGDashboard from '../components/ASGDashboard';

export default function ASG() {
  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f5f5f5' }}>
      <ASGDashboard />
    </div>
  );
}
