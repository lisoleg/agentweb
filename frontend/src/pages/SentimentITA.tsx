/**
 * SentimentITAPage — V14.0 舆情ITA引擎页面
 * 双Tab: 概述 + 面板
 */

import React, { useState } from 'react';
import {
  Box, Card, CardContent, Typography, Grid, Chip, Tabs, Tab, Alert, Divider, Paper,
} from '@mui/material';
import SentimentITAPanel from '../components/SentimentITAPanel';

const SentimentITAPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState(0);

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        🚨 舆情ITA引擎 (V14.0)
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        情绪优先(Sentiment-First) + 责任上移(Escalate-Up) — 借鉴胖东来/长城汽车舆情处置逻辑
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
              <strong>核心机制</strong>: 情绪密度超标 → Draft Hold (停发营销内容) → 责任上移 (自动Escalate总部) → 1小时补偿方案 + 48小时调查报告
            </Alert>
          </Grid>

          {[
            {
              title: '🚨 情绪优先 (Sentiment-First)',
              desc: 'Agent自主监测舆情，情绪密度超标自动触发Draft Hold',
              details: '负面polarity + 传播velocity > 阈值 → 停发营销内容 → 启动应急预案',
              theorem: '定理: 情绪扩散速度 ≫ 事实澄清速度 → 必须先止损再澄清',
              color: '#f44336',
            },
            {
              title: '⬆️ 责任上移 (Escalate-Up)',
              desc: '系统不直接断开连接，而是自动上报总部/纪委',
              details: '连续3次同类舆情 → 自动Escalate → 总部/纪委介入 → 不扣贡献分',
              theorem: '中国式问责: 刀刃向内 → 自查自纠 → 责任上移而非下放',
              color: '#ff9800',
            },
            {
              title: '💰 1小时补偿 + 48小时调查',
              desc: 'AI自动生成补偿方案 (退款/优惠券/道歉信)，人类审核后执行',
              details: '补偿方案生成 (1h) → 调查报告 (48h) → 反馈评分 → 迭代优化',
              theorem: '定理: 补偿速度 ∝ 品牌信任恢复速度',
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
                  <Typography><strong>P1</strong>: 接入舆情ITA后，品牌危机持续时间比传统舆情系统短30%</Typography>
                  <Typography variant="body2" color="text.secondary">
                    对照组A: 人工监测+人工决策 | 实验组B: 舆情ITA自动Draft Hold+补偿 | 预期: B组危机持续时间显著短于A组
                  </Typography>
                </Paper>
                <Paper sx={{ p: 2 }}>
                  <Typography><strong>P2</strong>: 责任上移机制使Agent误报率比纯自动系统低50%</Typography>
                  <Typography variant="body2" color="text.secondary">
                    对照组A: 纯自动 (误报即执行) | 实验组B: 责任上移 (连续误报→上报人类) | 预期: B组误报率显著低于A组
                  </Typography>
                </Paper>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {activeTab === 1 && <SentimentITAPanel />}
    </Box>
  );
};

export default SentimentITAPage;
