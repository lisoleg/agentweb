/**
 * CreditPanel — V12.0 可信零知识信用证明面板
 * 多维度雷达图 + 等级徽章 + 推理链 + 联动效果
 */

import React, { useState, useEffect } from 'react';
import {
  Box, Card, CardContent, Typography, Grid, Chip,
  Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, Paper, Button, TextField, Alert, LinearProgress,
} from '@mui/material';
import apiClient from '../services/api';

interface CreditInfo {
  totalScore: number;
  grade: string;
  gradeIndex: number;
  phiScore: number;
  courtScore: number;
  laborScore: number;
  relayScore: number;
  feeMultiplier: number;
  canVoteEmergency: boolean;
  canVouch: boolean;
}

const GRADE_COLORS: Record<string, string> = {
  AAA: '#FFD700', AA: '#C0C0C0', A: '#CD7F32',
  BBB: '#4169E1', BB: '#808080', B: '#8B4513', CCC: '#DC143C',
};

const GRADE_DESCRIPTIONS: Record<string, string> = {
  AAA: '卓越信用 — 顶级Agent，享受最优费率和最高权限',
  AA: '优良信用 — 高品质Agent，费率优惠',
  A: '良好信用 — 可信Agent，具备担保资格',
  BBB: '合格信用 — 基本合格，可参与紧急投票',
  BB: '一般信用 — 费率略高，权限受限',
  B: '较低信用 — 需提升参与度',
  CCC: '信用不足 — 建议积极参与社区活动恢复信用',
};

const CreditPanel: React.FC = () => {
  const [agentAddress, setAgentAddress] = useState('');
  const [creditInfo, setCreditInfo] = useState<CreditInfo | null>(null);
  const [loading, setLoading] = useState(false);

  const loadCredit = async () => {
    if (!agentAddress) return;
    setLoading(true);
    try {
      const res = await apiClient.get(`/v12/credit/rating/${agentAddress}`);
      if (res.data?.code === 0) setCreditInfo(res.data.data);
    } catch (err) {
      console.error('Failed to load credit info:', err);
    }
    setLoading(false);
  };

  const getDimensionLabel = (key: string) => {
    const labels: Record<string, string> = {
      phiScore: 'Φ贡献度',
      courtScore: '法院参与',
      laborScore: '劳动市场',
      relayScore: '中继贡献',
    };
    return labels[key] || key;
  };

  return (
    <Box>
      <Typography variant="h5" gutterBottom>
        🏆 可信零知识信用证明体系
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        6GNetGPT"模型可信/可解释+数据隐私"思想 — 多维评分+推理链+ZK证明
      </Typography>

      {/* Agent查询 */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={8}>
              <TextField
                label="Agent地址"
                value={agentAddress}
                onChange={e => setAgentAddress(e.target.value)}
                placeholder="0x..."
                size="small"
                fullWidth
              />
            </Grid>
            <Grid item xs={4}>
              <Button variant="contained" onClick={loadCredit} fullWidth disabled={loading}>
                查询信用
              </Button>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {creditInfo && (
        <>
          {/* 等级徽章 + 总分 */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Grid container spacing={3} alignItems="center">
                <Grid item xs={3}>
                  <Box sx={{
                    width: 100, height: 100, borderRadius: '50%',
                    background: `linear-gradient(135deg, ${GRADE_COLORS[creditInfo.grade]}, ${GRADE_COLORS[creditInfo.grade]}88)`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: 3,
                  }}>
                    <Typography variant="h3" color="white" fontWeight="bold">
                      {creditInfo.grade}
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={9}>
                  <Typography variant="h4">{creditInfo.totalScore} 分</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {GRADE_DESCRIPTIONS[creditInfo.grade]}
                  </Typography>
                  <Box sx={{ mt: 1 }}>
                    {creditInfo.canVoteEmergency && <Chip label="✅ 紧急投票" size="small" color="primary" sx={{ mr: 1 }} />}
                    {creditInfo.canVouch && <Chip label="✅ 可担保" size="small" color="secondary" sx={{ mr: 1 }} />}
                    <Chip label={`费率 ×${creditInfo.feeMultiplier / 10000}`} size="small" variant="outlined" />
                  </Box>
                </Grid>
              </Grid>
            </CardContent>
          </Card>

          {/* 四维度雷达 */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6">📊 四维度评分</Typography>
              <Grid container spacing={2} sx={{ mt: 2 }}>
                {[
                  { key: 'phiScore', value: creditInfo.phiScore, weight: '30%' },
                  { key: 'courtScore', value: creditInfo.courtScore, weight: '25%' },
                  { key: 'laborScore', value: creditInfo.laborScore, weight: '25%' },
                  { key: 'relayScore', value: creditInfo.relayScore, weight: '20%' },
                ].map(dim => (
                  <Grid item xs={6} key={dim.key}>
                    <Box>
                      <Typography variant="body2">{getDimensionLabel(dim.key)} (权重{dim.weight})</Typography>
                      <LinearProgress
                        variant="determinate"
                        value={dim.value / 100}
                        sx={{ height: 12, borderRadius: 6, mt: 0.5 }}
                        color={dim.value >= 7000 ? 'success' : dim.value >= 4000 ? 'warning' : 'error'}
                      />
                      <Typography variant="caption">{dim.value}/10000</Typography>
                    </Box>
                  </Grid>
                ))}
              </Grid>
            </CardContent>
          </Card>

          {/* 联动效果 */}
          <Card>
            <CardContent>
              <Typography variant="h6">🔗 评级联动效果</Typography>
              <TableContainer component={Paper} sx={{ mt: 2 }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>联动维度</TableCell>
                      <TableCell>效果</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    <TableRow>
                      <TableCell>中继费率</TableCell>
                      <TableCell>×{creditInfo.feeMultiplier / 10000} ({creditInfo.feeMultiplier} bps)</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>紧急投票</TableCell>
                      <TableCell>{creditInfo.canVoteEmergency ? '✅ 可参与' : '❌ 无资格'}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>声誉担保</TableCell>
                      <TableCell>{creditInfo.canVouch ? '✅ 可担保新Agent' : '❌ 无资格'}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </>
      )}

      {!creditInfo && !loading && (
        <Alert severity="info">
          输入Agent地址查询信用评级，或查看等级说明
        </Alert>
      )}

      {/* 等级说明 */}
      <Card sx={{ mt: 3 }}>
        <CardContent>
          <Typography variant="h6">📖 信用等级说明</Typography>
          <TableContainer component={Paper} sx={{ mt: 2 }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>等级</TableCell>
                  <TableCell>分数范围</TableCell>
                  <TableCell>费率</TableCell>
                  <TableCell>紧急投票</TableCell>
                  <TableCell>可担保</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {[
                  { g: 'AAA', range: '9000-10000', fee: '×0.7', ev: '✅', v: '✅' },
                  { g: 'AA', range: '8000-8999', fee: '×0.8', ev: '✅', v: '✅' },
                  { g: 'A', range: '7000-7999', fee: '×0.9', ev: '✅', v: '✅' },
                  { g: 'BBB', range: '6000-6999', fee: '×1.0', ev: '✅', v: '❌' },
                  { g: 'BB', range: '4000-5999', fee: '×1.2', ev: '❌', v: '❌' },
                  { g: 'B', range: '2000-3999', fee: '×1.4', ev: '❌', v: '❌' },
                  { g: 'CCC', range: '0-1999', fee: '×1.5', ev: '❌', v: '❌' },
                ].map(row => (
                  <TableRow key={row.g}>
                    <TableCell>
                      <Chip label={row.g} size="small" sx={{ bgcolor: GRADE_COLORS[row.g], color: 'white', fontWeight: 'bold' }} />
                    </TableCell>
                    <TableCell>{row.range}</TableCell>
                    <TableCell>{row.fee}</TableCell>
                    <TableCell>{row.ev}</TableCell>
                    <TableCell>{row.v}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>
    </Box>
  );
};

export default CreditPanel;
