/**
 * DAAMetricPage — V14.0 DAA度量 + GUI减法页面
 * 双Tab: 概述 + 面板
 */

import React, { useState } from 'react';
import {
  Box, Card, CardContent, Typography, Grid, Chip, Tabs, Tab, Alert, Divider, Paper,
} from '@mui/material';
import DAADashboard from '../components/DAADashboard';

const DAAMetricPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState(0);

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        📏 DAA度量 + GUI减法 (V14.0)
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        DA-A: Distance-Advanced Along Assignment | GUI减法: 界面逐步简化直至消失 | 政府退后: 定规则、供API
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
              <strong>论文来源</strong>: 《隐式化管理: GUI减法与政府退后》— 复合体理学 | 核心: 不考核忙碌程度，只考核任务实际推进距离
            </Alert>
          </Grid>

          {[
            {
              title: '📏 DAA度量 (Distance-Advanced Along Assignment)',
              desc: '不考核"你多忙"，只考核"你推进了多少"',
              details: 'DAA = ∫_(t_start)^(t_now) v_task(t) dt / D_total。流贯密度 = 实际推进距离 / 时间。停滞检测: 流贯密度 < ε 持续 T 秒 → 预警。',
              theorem: '定理: DAA ≫ 时长考核 (防止Fake Work)',
              color: '#2196f3',
            },
            {
              title: '⬜ GUI减法引擎',
              desc: '界面交互逐步简化直至消失，能力隐性化',
              details: 'Stage 0: 全功能 | Stage 1: 隐藏高级选项 | Stage 2: 简化操作流程 | Stage 3: 智能预测 | Stage 4: 仅提示 | Stage 5: 消失 (完全隐性化)',
              theorem: '定理: GUI元素数 ∝ 用户认知负荷 ∝ 操作错误率',
              color: '#ff9800',
            },
            {
              title: '🏛️ 政府退后机制',
              desc: '定规则、供API，前台创造力交给社会Agent',
              details: '政府不退后 → 市场创造力被压抑。政府退后 → 定规则 + 供API → Agent自主创造。双轨制: 政府管规则，市场管创造。',
              theorem: '定理: 政府退后程度 ∝ 社会Agent创造力 (在规则明确前提下)',
              color: '#4caf50',
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
                  <Typography><strong>P1</strong>: 采用DAA度量后，Agent Fake Work率比时长考核低50%</Typography>
                  <Typography variant="body2" color="text.secondary">
                    对照组A: 按时长考核 (鼓励Fake Work) | 实验组B: 按DAA考核 (鼓励实际推进) | 预期: B组Fake Work率≪A组
                  </Typography>
                </Paper>
                <Paper sx={{ p: 2 }}>
                  <Typography><strong>P2</strong>: GUI减法使新用户上手时间比传统UI短40%</Typography>
                  <Typography variant="body2" color="text.secondary">
                    对照组A: 全功能UI (无减法) | 实验组B: GUI减法 (逐步隐性化) | 预期: B组上手时间显著短于A组
                  </Typography>
                </Paper>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {activeTab === 1 && <DAADashboard />}
    </Box>
  );
};

export default DAAMetricPage;
