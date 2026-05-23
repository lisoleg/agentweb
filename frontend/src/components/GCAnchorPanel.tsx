/**
 * GCAnchorPanel — V12.5 GC锚定层面板
 * GC余额仪表盘 + 代谢倒计时 + 收入消费流水 + 三级惩罚状态 + Merkle验证 + 职业征信报告
 *
 * "代码即法律": GC余额低于代谢阈值自动惩罚
 * "做题家机制": GC余额 = AI优化目标函数
 * "链上职业征信": 不可篡改的GC记录 = Agent能力唯一标准
 */

import React, { useState, useEffect } from 'react';
import {
  Box, Card, CardContent, Typography, Grid, Chip,
  Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, Paper, Button, TextField, Alert, LinearProgress,
  Tabs, Tab, Divider,
} from '@mui/material';
import apiClient from '../services/api';

// =============== Types ===============

interface GCHealth {
  balance: string;
  metabolicRate: string;
  secondsToStarve: string;
  monthlyCost: string;
  healthScore: number;
  healthGrade: string;
  statusMessage: string;
}

interface AnchorRecord {
  id: number;
  agent: string;
  recordType: string;
  amount: string;
  balanceAfter: string;
  sourceHash: string;
  epoch: number;
  timestamp: number;
}

interface PenaltyPrediction {
  gcBalance: string;
  metabolicRate: string;
  monthlyCost: string;
  ratioBps: number;
  predictedLevel: string;
  predictedBurnAmount: string;
  predictedCreditImpact: number;
  statusMessage: string;
}

interface CareerCredit {
  agent: string;
  registeredAt: number;
  totalIncome: string;
  totalConsumption: string;
  totalPenalty: string;
  totalReward: string;
  totalStaked: string;
  totalBurned: string;
  gcBalance: string;
  metabolicRate: string;
  currentHealthScore: number;
  currentHealthGrade: string;
  currentPenaltyLevel: string;
  consecutivePenalties: number;
  careerSummary: string;
  incomeConsumptionRatio: string;
  penaltyRate: string;
  netGCFlow: string;
}

// =============== Constants ===============

const HEALTH_GRADE_COLORS: Record<string, string> = {
  HEALTHY: '#4CAF50',
  GOOD: '#8BC34A',
  FAIR: '#FFC107',
  WARNING: '#FF9800',
  CRITICAL: '#F44336',
  STARVING: '#B71C1C',
};

const PENALTY_COLORS: Record<string, string> = {
  NONE: '#4CAF50',
  WARNING: '#FF9800',
  DOWNGRADE: '#F44336',
  EXPEL: '#B71C1C',
};

const RECORD_TYPE_ICONS: Record<string, string> = {
  INCOME: '💰',
  CONSUMPTION: '🛒',
  PENALTY: '⚠️',
  REWARD: '🎁',
  STAKE: '🔒',
  BURN: '🔥',
};

// =============== Component ===============

const GCAnchorPanel: React.FC = () => {
  const [agentAddress, setAgentAddress] = useState('');
  const [activeTab, setActiveTab] = useState(0);
  const [health, setHealth] = useState<GCHealth | null>(null);
  const [records, setRecords] = useState<AnchorRecord[]>([]);
  const [recordsTotal, setRecordsTotal] = useState(0);
  const [prediction, setPrediction] = useState<PenaltyPrediction | null>(null);
  const [career, setCareer] = useState<CareerCredit | null>(null);
  const [loading, setLoading] = useState(false);

  // 惩罚预测参数
  const [predictBalance, setPredictBalance] = useState('');
  const [predictMetabolic, setPredictMetabolic] = useState('');

  const loadHealth = async () => {
    if (!agentAddress) return;
    setLoading(true);
    try {
      const res = await apiClient.get(`/v12/gc-ancor/balance/${agentAddress}`);
      if (res.data?.code === 0) setHealth(res.data.data);
    } catch (err) {
      console.error('Failed to load GC health:', err);
    }
    setLoading(false);
  };

  const loadRecords = async () => {
    if (!agentAddress) return;
    try {
      const res = await apiClient.get(`/v12/gc-ancor/records/${agentAddress}?limit=20`);
      if (res.data?.code === 0) {
        setRecords(res.data.data.records || []);
        setRecordsTotal(res.data.data.total || 0);
      }
    } catch (err) {
      console.error('Failed to load records:', err);
    }
  };

  const predictPenalty = async () => {
    if (!predictBalance || !predictMetabolic) return;
    try {
      const res = await apiClient.post('/v12/gc-ancor/predict', {
        gcBalance: Number(predictBalance),
        metabolicRate: Number(predictMetabolic),
      });
      if (res.data?.code === 0) setPrediction(res.data.data);
    } catch (err) {
      console.error('Failed to predict penalty:', err);
    }
  };

  const loadCareer = async () => {
    if (!agentAddress) return;
    try {
      const res = await apiClient.get(`/v12/gc-ancor/career/${agentAddress}`);
      if (res.data?.code === 0) setCareer(res.data.data);
    } catch (err) {
      console.error('Failed to load career credit:', err);
    }
  };

  const loadAll = async () => {
    await loadHealth();
    await loadRecords();
    await loadCareer();
  };

  const formatTimestamp = (ts: number) => {
    if (!ts) return '-';
    return new Date(ts * 1000).toLocaleString();
  };

  const formatGC = (val: string) => {
    const num = Number(val);
    if (isNaN(num)) return '0';
    if (num >= 1e9) return (num / 1e9).toFixed(2) + 'B';
    if (num >= 1e6) return (num / 1e6).toFixed(2) + 'M';
    if (num >= 1e3) return (num / 1e3).toFixed(2) + 'K';
    return num.toFixed(2);
  };

  const formatSeconds = (secs: number) => {
    if (!secs || secs === Infinity) return '∞';
    const days = Math.floor(secs / 86400);
    const hours = Math.floor((secs % 86400) / 3600);
    return days > 0 ? `${days}天${hours}小时` : `${hours}小时`;
  };

  return (
    <Box>
      <Typography variant="h5" gutterBottom>
        ⚓ GC锚定层 — "代码即法律"自动奖惩
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        《皇帝的新衣与影子内阁》+ 《GSD-Coin终极推演》— GC余额 = AI生存命脉
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
              <Button variant="contained" onClick={loadAll} fullWidth disabled={loading}>
                查询GC状态
              </Button>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Tab导航 */}
      <Card sx={{ mb: 3 }}>
        <Tabs
          value={activeTab}
          onChange={(_, v) => setActiveTab(v)}
          variant="scrollable"
          scrollButtons="auto"
        >
          <Tab label="💰 GC仪表盘" />
          <Tab label="📊 交易流水" />
          <Tab label="⚠️ 惩罚预测" />
          <Tab label="📋 职业征信" />
        </Tabs>
      </Card>

      {/* Tab 0: GC仪表盘 */}
      {activeTab === 0 && (
        <>
          {health && (
            <Grid container spacing={3}>
              {/* 健康度大圆 */}
              <Grid item xs={12} md={4}>
                <Card sx={{ height: '100%' }}>
                  <CardContent sx={{ textAlign: 'center' }}>
                    <Typography variant="h6" gutterBottom>GC健康度</Typography>
                    <Box sx={{
                      width: 140, height: 140, borderRadius: '50%',
                      background: `linear-gradient(135deg, ${HEALTH_GRADE_COLORS[health.healthGrade]}, ${HEALTH_GRADE_COLORS[health.healthGrade]}88)`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      mx: 'auto', boxShadow: 3,
                    }}>
                      <Typography variant="h4" color="white" fontWeight="bold">
                        {health.healthScore}
                      </Typography>
                    </Box>
                    <Chip
                      label={health.healthGrade}
                      sx={{ mt: 2, bgcolor: HEALTH_GRADE_COLORS[health.healthGrade], color: 'white', fontWeight: 'bold' }}
                    />
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                      {health.statusMessage}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>

              {/* 余额+代谢率 */}
              <Grid item xs={12} md={4}>
                <Card sx={{ height: '100%' }}>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>💰 GC余额</Typography>
                    <Typography variant="h3" color="primary">
                      {formatGC(health.balance)}
                    </Typography>
                    <Divider sx={{ my: 2 }} />
                    <Typography variant="body2">代谢率: {formatGC(health.metabolicRate)} GC/s</Typography>
                    <Typography variant="body2">月代谢成本: {formatGC(health.monthlyCost)} GC</Typography>
                    <Typography variant="body2">
                      饿死倒计时: {formatSeconds(Number(health.secondsToStarve))}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>

              {/* 健康度进度条 */}
              <Grid item xs={12} md={4}>
                <Card sx={{ height: '100%' }}>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>📊 健康指标</Typography>
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="body2">健康度评分</Typography>
                      <LinearProgress
                        variant="determinate"
                        value={health.healthScore / 100}
                        sx={{ height: 16, borderRadius: 8, mt: 0.5 }}
                        color={health.healthScore >= 7000 ? 'success' : health.healthScore >= 4000 ? 'warning' : 'error'}
                      />
                      <Typography variant="caption">{health.healthScore}/10000</Typography>
                    </Box>

                    <Box sx={{ mt: 2 }}>
                      <Typography variant="body2" fontWeight="bold">三级惩罚阈值</Typography>
                      {[
                        { label: 'WARNING (20%)', color: '#FF9800', threshold: 2000 },
                        { label: 'DOWNGRADE (10%)', color: '#F44336', threshold: 1000 },
                        { label: 'EXPEL (5%)', color: '#B71C1C', threshold: 500 },
                      ].map(t => (
                        <Box key={t.label} sx={{ display: 'flex', alignItems: 'center', mt: 0.5 }}>
                          <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: t.color, mr: 1 }} />
                          <Typography variant="caption">{t.label}</Typography>
                        </Box>
                      ))}
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          )}

          {!health && !loading && (
            <Alert severity="info">
              输入Agent地址查询GC余额与健康状态
            </Alert>
          )}
        </>
      )}

      {/* Tab 1: 交易流水 */}
      {activeTab === 1 && (
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              📊 GC交易流水 (共{recordsTotal}条)
            </Typography>
            {records.length > 0 ? (
              <TableContainer component={Paper}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>ID</TableCell>
                      <TableCell>类型</TableCell>
                      <TableCell>数量</TableCell>
                      <TableCell>余额变化后</TableCell>
                      <TableCell>周期</TableCell>
                      <TableCell>时间</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {records.map(rec => (
                      <TableRow key={rec.id}>
                        <TableCell>{rec.id}</TableCell>
                        <TableCell>
                          <Chip
                            label={`${RECORD_TYPE_ICONS[rec.recordType] || '📝'} ${rec.recordType}`}
                            size="small"
                            variant="outlined"
                          />
                        </TableCell>
                        <TableCell>{formatGC(rec.amount)}</TableCell>
                        <TableCell>{formatGC(rec.balanceAfter)}</TableCell>
                        <TableCell>#{rec.epoch}</TableCell>
                        <TableCell>{formatTimestamp(rec.timestamp)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            ) : (
              <Alert severity="info">暂无交易记录，请先查询Agent地址</Alert>
            )}
          </CardContent>
        </Card>
      )}

      {/* Tab 2: 惩罚预测 */}
      {activeTab === 2 && (
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>🔮 惩罚预测器</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  给定GC余额与代谢率，预测惩罚等级和扣减量
                </Typography>
                <TextField
                  label="GC余额"
                  value={predictBalance}
                  onChange={e => setPredictBalance(e.target.value)}
                  type="number"
                  size="small"
                  fullWidth
                  sx={{ mb: 2 }}
                  placeholder="例如: 1000000"
                />
                <TextField
                  label="代谢率 (GC/秒)"
                  value={predictMetabolic}
                  onChange={e => setPredictMetabolic(e.target.value)}
                  type="number"
                  size="small"
                  fullWidth
                  sx={{ mb: 2 }}
                  placeholder="例如: 100"
                />
                <Button variant="contained" onClick={predictPenalty} fullWidth>
                  预测惩罚等级
                </Button>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={6}>
            {prediction ? (
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>预测结果</Typography>
                  <Box sx={{
                    p: 2, borderRadius: 2, mb: 2,
                    bgcolor: PENALTY_COLORS[prediction.predictedLevel] + '22',
                    border: `2px solid ${PENALTY_COLORS[prediction.predictedLevel]}`,
                  }}>
                    <Typography variant="h5" sx={{ color: PENALTY_COLORS[prediction.predictedLevel] }}>
                      {prediction.predictedLevel}
                    </Typography>
                    <Typography variant="body2">{prediction.statusMessage}</Typography>
                  </Box>
                  <TableContainer>
                    <Table size="small">
                      <TableBody>
                        <TableRow>
                          <TableCell><strong>GC余额</strong></TableCell>
                          <TableCell>{formatGC(prediction.gcBalance)}</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell><strong>代谢率</strong></TableCell>
                          <TableCell>{formatGC(prediction.metabolicRate)} GC/s</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell><strong>月代谢成本</strong></TableCell>
                          <TableCell>{formatGC(prediction.monthlyCost)} GC</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell><strong>余额/月成本比</strong></TableCell>
                          <TableCell>{(prediction.ratioBps / 100).toFixed(1)}%</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell><strong>预测扣减</strong></TableCell>
                          <TableCell>{formatGC(prediction.predictedBurnAmount)} GC</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell><strong>信用影响</strong></TableCell>
                          <TableCell>-{prediction.predictedCreditImpact}</TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </TableContainer>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent>
                  <Alert severity="info">
                    输入GC余额和代谢率，点击"预测惩罚等级"查看预测结果
                  </Alert>
                  <Box sx={{ mt: 2 }}>
                    <Typography variant="h6" gutterBottom>📖 三级惩罚体系</Typography>
                    <TableContainer component={Paper}>
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>等级</TableCell>
                            <TableCell>触发条件</TableCell>
                            <TableCell>GC扣减</TableCell>
                            <TableCell>信用影响</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          <TableRow>
                            <TableCell><Chip label="WARNING" size="small" sx={{ bgcolor: '#FF9800', color: 'white' }} /></TableCell>
                            <TableCell>余额/月成本 {'<'} 20%</TableCell>
                            <TableCell>月成本10%</TableCell>
                            <TableCell>-100</TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell><Chip label="DOWNGRADE" size="small" sx={{ bgcolor: '#F44336', color: 'white' }} /></TableCell>
                            <TableCell>余额/月成本 {'<'} 10%</TableCell>
                            <TableCell>月成本25%</TableCell>
                            <TableCell>-300</TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell><Chip label="EXPEL" size="small" sx={{ bgcolor: '#B71C1C', color: 'white' }} /></TableCell>
                            <TableCell>余额/月成本 {'<'} 5%</TableCell>
                            <TableCell>全部余额</TableCell>
                            <TableCell>-1000</TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </Box>
                </CardContent>
              </Card>
            )}
          </Grid>
        </Grid>
      )}

      {/* Tab 3: 职业征信报告 */}
      {activeTab === 3 && (
        <>
          {career ? (
            <>
              <Card sx={{ mb: 3 }}>
                <CardContent>
                  <Typography variant="h6" gutterBottom>📋 链上职业征信报告</Typography>
                  <Alert severity="info" sx={{ mb: 2 }}>
                    不可篡改的GC交易记录 = Agent能力的唯一标准 — "做题家机制"
                  </Alert>
                  <Typography variant="body1" sx={{ mb: 2 }}>{career.careerSummary}</Typography>

                  <Grid container spacing={2}>
                    <Grid item xs={4}>
                      <Box sx={{ textAlign: 'center', p: 2, bgcolor: '#e8f5e9', borderRadius: 2 }}>
                        <Typography variant="caption" color="text.secondary">累计收入</Typography>
                        <Typography variant="h5" color="success.main">{formatGC(career.totalIncome)}</Typography>
                      </Box>
                    </Grid>
                    <Grid item xs={4}>
                      <Box sx={{ textAlign: 'center', p: 2, bgcolor: '#fff3e0', borderRadius: 2 }}>
                        <Typography variant="caption" color="text.secondary">累计消费</Typography>
                        <Typography variant="h5" color="warning.main">{formatGC(career.totalConsumption)}</Typography>
                      </Box>
                    </Grid>
                    <Grid item xs={4}>
                      <Box sx={{ textAlign: 'center', p: 2, bgcolor: '#fce4ec', borderRadius: 2 }}>
                        <Typography variant="caption" color="text.secondary">累计惩罚</Typography>
                        <Typography variant="h5" color="error.main">{formatGC(career.totalPenalty)}</Typography>
                      </Box>
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>

              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <Card>
                    <CardContent>
                      <Typography variant="h6" gutterBottom>📊 关键指标</Typography>
                      <TableContainer>
                        <Table size="small">
                          <TableBody>
                            <TableRow>
                              <TableCell><strong>GC余额</strong></TableCell>
                              <TableCell>{formatGC(career.gcBalance)}</TableCell>
                            </TableRow>
                            <TableRow>
                              <TableCell><strong>代谢率</strong></TableCell>
                              <TableCell>{formatGC(career.metabolicRate)} GC/s</TableCell>
                            </TableRow>
                            <TableRow>
                              <TableCell><strong>健康度</strong></TableCell>
                              <TableCell>
                                <Chip
                                  label={`${career.currentHealthScore} (${career.currentHealthGrade})`}
                                  size="small"
                                  sx={{ bgcolor: HEALTH_GRADE_COLORS[career.currentHealthGrade] || '#999', color: 'white' }}
                                />
                              </TableCell>
                            </TableRow>
                            <TableRow>
                              <TableCell><strong>惩罚状态</strong></TableCell>
                              <TableCell>
                                <Chip
                                  label={career.currentPenaltyLevel}
                                  size="small"
                                  sx={{ bgcolor: PENALTY_COLORS[career.currentPenaltyLevel] || '#999', color: 'white' }}
                                />
                              </TableCell>
                            </TableRow>
                            <TableRow>
                              <TableCell><strong>连续惩罚</strong></TableCell>
                              <TableCell>{career.consecutivePenalties}次</TableCell>
                            </TableRow>
                            <TableRow>
                              <TableCell><strong>收入/消费比</strong></TableCell>
                              <TableCell>{career.incomeConsumptionRatio}</TableCell>
                            </TableRow>
                            <TableRow>
                              <TableCell><strong>惩罚率</strong></TableCell>
                              <TableCell>{career.penaltyRate}</TableCell>
                            </TableRow>
                            <TableRow>
                              <TableCell><strong>净GC流入</strong></TableCell>
                              <TableCell>{formatGC(career.netGCFlow)}</TableCell>
                            </TableRow>
                          </TableBody>
                        </Table>
                      </TableContainer>
                    </CardContent>
                  </Card>
                </Grid>

                <Grid item xs={12} md={6}>
                  <Card>
                    <CardContent>
                      <Typography variant="h6" gutterBottom>💡 GC六大流向</Typography>
                      <Grid container spacing={1}>
                        {[
                          { label: '💰 收入', value: career.totalIncome, color: '#4CAF50' },
                          { label: '🛒 消费', value: career.totalConsumption, color: '#FF9800' },
                          { label: '⚠️ 惩罚', value: career.totalPenalty, color: '#F44336' },
                          { label: '🎁 奖励', value: career.totalReward, color: '#2196F3' },
                          { label: '🔒 质押', value: career.totalStaked, color: '#9C27B0' },
                          { label: '🔥 燃烧', value: career.totalBurned, color: '#795548' },
                        ].map(item => (
                          <Grid item xs={6} key={item.label}>
                            <Box sx={{ p: 1.5, bgcolor: item.color + '11', borderRadius: 2, border: `1px solid ${item.color}44` }}>
                              <Typography variant="caption" color="text.secondary">{item.label}</Typography>
                              <Typography variant="body1" fontWeight="bold">{formatGC(item.value)}</Typography>
                            </Box>
                          </Grid>
                        ))}
                      </Grid>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>
            </>
          ) : (
            <Alert severity="info">
              输入Agent地址查询链上职业征信报告
            </Alert>
          )}
        </>
      )}
    </Box>
  );
};

export default GCAnchorPanel;
