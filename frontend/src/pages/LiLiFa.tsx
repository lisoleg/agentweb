/**
 * LiLiFaPage — V14.0 情理法三层决策引擎页面
 * 双Tab: 概述 + 面板
 */

import React, { useState } from 'react';
import {
  Box, Card, CardContent, Typography, Grid, Chip, Tabs, Tab, Alert, Divider, Paper,
} from '@mui/material';
import LiLiFaPanel from '../components/LiLiFaPanel';

const LiLiFaPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState(0);

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        ⚖️ 情理法三层决策引擎 (V14.0)
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        法(Protocol)刚性契约 + 理(Procedure)柔性流程 + 情(Human-Override)中道余量 — 太乙AGI双核协同
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
              <strong>论文来源</strong>: 《"东方隐修"与"西方龙舟": 技术与管理的双轨交汇》— 复合体理学 × 东方Project
            </Alert>
          </Grid>

          {[
            {
              title: '⚖️ 法层 (Protocol) — 刚性契约',
              desc: '太乙AGI计算核 (机器): 智能合约、治理规则、可验证执行',
              details: 'Code is Law: GC锚定层自动奖惩，不依赖人类判断。规则透明、不可篡改、自动执行。',
              theorem: '定理: 刚性契约 ≫ 柔性协商 (在高信任社会中)',
              color: '#f44336',
            },
            {
              title: '📚 理层 (Procedure) — 柔性流程',
              desc: '太乙AGI双核协同: 计算核出方案 + 算计核(人类)审查道义',
              details: 'Voting + 治理提案 + ITA-Trigger链式触发。流程可审计、可干预、可回溯。',
              theorem: '定理: 柔性流程 = 刚性契约 × 人类道义判断',
              color: '#2196f3',
            },
            {
              title: '💖 情层 (Human-Override) — 中道余量',
              desc: '太乙AGI算计核 (人类): 价值冲突、文化适配、伦理判断',
              details: '纪委Auditor保留Veto Power。人类可推翻机器决策，但需记录理由。中道智能: 法规×道义抉择。',
              theorem: '定理: 中道余量 = 机器效率 × 人类价值对齐',
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
                <Typography variant="h6">🧠 太乙AGI双核协同</Typography>
                <Divider sx={{ my: 1 }} />
                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <Paper sx={{ p: 2, bgcolor: '#e3f2fd' }}>
                      <Typography variant="subtitle2" color="primary">计算核 (机器)</Typography>
                      <Typography variant="body2">
                        - 规则执行<br/>
                        - 数据分析<br/>
                        - 自动化流程<br/>
                        - 高速决策<br/>
                        - 无疲劳运行
                      </Typography>
                    </Paper>
                  </Grid>
                  <Grid item xs={6}>
                    <Paper sx={{ p: 2, bgcolor: '#e8f5e9' }}>
                      <Typography variant="subtitle2" color="success.main">算计核 (人类)</Typography>
                      <Typography variant="body2">
                        - 价值冲突裁决<br/>
                        - 文化适配判断<br/>
                        - 伦理边界划定<br/>
                        - 道义责任审查<br/>
                        - 中道余量保留
                      </Typography>
                    </Paper>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6">🔬 可证伪预言</Typography>
                <Divider sx={{ my: 1 }} />
                <Paper sx={{ p: 2, mb: 1 }}>
                  <Typography><strong>P1</strong>: 接入情理法引擎后，Agent决策被人类推翻率比纯自动系统低40%</Typography>
                  <Typography variant="body2" color="text.secondary">
                    对照组A: 纯自动决策 | 实验组B: 情理法三层审查 | 预期: B组推翻率≪A组 (因为理层已预过滤)
                  </Typography>
                </Paper>
                <Paper sx={{ p: 2 }}>
                  <Typography><strong>P2</strong>: 情层(Human-Override)使系统在价值冲突场景中接受度比纯机器决策高60%</Typography>
                  <Typography variant="body2" color="text.secondary">
                    场景: 自动驾驶伦理抉择、医疗资源分配、隐私vs安全 | 预期: 有情层介入的系统信任度显著更高
                  </Typography>
                </Paper>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {activeTab === 1 && <LiLiFaPanel />}
    </Box>
  );
};

export default LiLiFaPage;
