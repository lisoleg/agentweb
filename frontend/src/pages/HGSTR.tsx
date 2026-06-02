/**
 * HGSTRPage — V13.0 HG-STR 异构图时空推理页面
 * 双Tab: 概述 + 面板
 */

import React, { useState } from 'react';
import {
  Box, Card, CardContent, Typography, Grid, Chip, Tabs, Tab, Alert, Divider, Paper,
} from '@mui/material';
import HGSTRPanel from '../components/HGSTRPanel';

const HGSTRPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState(0);

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        🔀 HG-STR 异构图时空推理 (V13.0)
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        基于异构图时空推理的自主蜂群决策系统(HG-STR) — 类型化边 + 分层Planner + 残存记忆
      </Typography>

      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
        <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)}>
          <Tab label="📋 概述" />
          <Tab label="🖥️ 面板" />
        </Tabs>
      </Box>

      {activeTab === 0 && (
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <Alert severity="info">
              <strong>论文来源</strong>: 《基于异构图时空推理的自主蜂群决策系统(HG-STR)及其对下一代多智能体架构(太乙AGI)的启示》— 复合体理学
            </Alert>
          </Grid>

          {[
            {
              title: '🔗 类型化边 (Typed Edge)',
              desc: 'τ: E → T 类型映射函数，取代扁平JSON RPC',
              details: '禁止: `{ "to": "AgentB", "data": "..." }` (无语义) → 强制: EdgeType + Schema验证',
              theorem: '定理4.1: 异构图通信效率优于同构图 (m_het=O(k), k≪d)',
              color: '#2196f3',
            },
            {
              title: '🧠 分层Planner',
              desc: '三层MDP: L1战略→L2战役→L3战术 + ITA-Trigger层间绑定',
              details: '避免Flat Policy在高维空间陷入局部最优或死锁，连续3次同目标→自动逃逸',
              theorem: '将"被动响应"升级为"主动预判"',
              color: '#4caf50',
            },
            {
              title: '💾 残存记忆 + Gossip',
              desc: 'GRU隐状态h_i + Anti-entropy同步 + Gossip+TTL弱连通',
              details: '断链时凭h_i继续运行，重连后反熵同步修复差异',
              theorem: '定理4.2: T_GRU ≪ T_noMem (25×改进)',
              color: '#ff9800',
            },
          ].map((item, idx) => (
            <Grid item xs={12} md={4} key={idx}>
              <Card sx={{ borderTop: 3, borderColor: item.color }}>
                <CardContent>
                  <Typography variant="h6">{item.title}</Typography>
                  <Typography variant="body2" sx={{ mt: 1 }}>{item.desc}</Typography>
                  <Divider sx={{ my: 1 }} />
                  <Typography variant="body2" color="text.secondary">{item.details}</Typography>
                  <Chip label={item.theorem} size="small" sx={{ mt: 1, bgcolor: item.color, color: '#fff' }} />
                </CardContent>
              </Card>
            </Grid>
          ))}

          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6">🔬 可证伪预言</Typography>
                <Divider sx={{ my: 1 }} />
                <Paper sx={{ p: 2, mb: 1 }}>
                  <Typography><strong>P1</strong>: 50节点AgentWeb中，异构边组任务完成率比同构组高15%</Typography>
                  <Typography variant="body2" color="text.secondary">
                    对照组A: 全JSON RPC扁平通信 | 实验组B: 强制EdgeType约束 | 30%丢包 | 预期: B组&gt;90%, A组&lt;75%
                  </Typography>
                </Paper>
                <Paper sx={{ p: 2 }}>
                  <Typography><strong>P2</strong>: 医疗AgentWeb中，带ITA-Trigger的预警系统误报率比纯弹窗系统低40%</Typography>
                  <Typography variant="body2" color="text.secondary">
                    对照组A: 阈值超标即弹窗 | 实验组B: 阈值→触发T→自动调取病史→计算综合风险→再决定 | 预期: False Alarm Rate显著降低
                  </Typography>
                </Paper>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {activeTab === 1 && <HGSTRPanel />}
    </Box>
  );
};

export default HGSTRPage;
