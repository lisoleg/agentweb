/**
 * DAADashboard — V14.0 DAA度量 + GUI减法仪表盘
 * 3个Tab: DAA度量 | GUI减法 | 政府退后
 *
 * DA-A: Distance-Advanced Along Assignment
 * 不考核忙碌程度，只考核任务实际推进距离
 * GUI减法: 界面交互逐步简化直至消失，能力隐性化
 */

import React, { useState, useEffect } from 'react';
import {
  Box, Card, CardContent, Typography, Grid, Chip,
  Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, Paper, Button, Alert, LinearProgress,
  Tabs, Tab, Divider, Slider, Switch, FormControlLabel,
} from '@mui/material';
import StraightenIcon from '@mui/icons-material/Straighten';
import DesktopAccessDisabledIcon from '@mui/icons-material/DesktopAccessDisabled';
import ReduceCapacityIcon from '@mui/icons-material/ReduceCapacity';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import AssessmentIcon from '@mui/icons-material/Assessment';
import apiClient from '../services/api';

// =============== Types ===============

interface DAAMetric {
  agentId: string;
  assignmentId: string;
  taskType: string;
  totalDistance: number;     // 任务总距离
  advancedDistance: number;   // 已推进距离
  daaScore: number;          // DAA得分 (0-100)
  currentVelocity: number;    // 当前推进速度
  isStale: boolean;          // 是否停滞
  details: {
    subTasksCompleted: number;
    subTasksTotal: number;
    qualityScore: number;
    blockingIssues: number;
  };
  updatedAt: number;
}

interface GUISubtraction {
  agentId: string;
  currentStage: number;      // 0-5, 0=全功能, 5=消失
  stageName: string;
  reductionHistory: Array<{
    stage: number;
    removedElement: string;
    timestamp: number;
    userAcceptance: number;   // 0-1
  }>;
  implicitCapability: string[];  // 已隐性化能力
  lastRemovalAt: number;
}

interface DAAGlobalStats {
  totalAgents: number;
  avgDAAScore: number;
  stalenessRate: number;
  topPerformers: Array<{ agentId: string; daaScore: number }>;
  stageDistribution: Record<number, number>;  // stage -> count
}

// =============== Sub-Components ===============

/** DAA度量Tab */
const DAATab: React.FC = () => {
  const [metrics, setMetrics] = useState<DAAMetric[]>([]);
  const [stats, setStats] = useState<DAAGlobalStats | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [mRes, sRes] = await Promise.all([
        apiClient.get('/v14/daa/metrics'),
        apiClient.get('/v14/daa/stats'),
      ]);
      if (mRes.data?.code === 0) setMetrics(mRes.data.data || []);
      if (sRes.data?.code === 0) setStats(sRes.data.data);
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const getDAAColor = (score: number) => {
    if (score >= 80) return '#4caf50';
    if (score >= 50) return '#ff9800';
    return '#f44336';
  };

  return (
    <Box>
      {stats && (
        <Grid container spacing={2} sx={{ mb: 2 }}>
          {[
            { label: '总Agent', value: stats.totalAgents, icon: <AssessmentIcon />, color: '#1976d2' },
            { label: '平均DAA', value: `${(stats.avgDAAScore * 100).toFixed(1)}%`, icon: <TrendingUpIcon />, color: '#4caf50' },
            { label: '停滞率', value: `${(stats.stalenessRate * 100).toFixed(1)}%`, icon: <StraightenIcon />, color: '#f44336' },
          ].map((item, idx) => (
            <Grid item xs={6} md={4} key={idx}>
              <Card><CardContent sx={{ textAlign: 'center', py: 1.5 }}>
                <Box sx={{ color: item.color, mb: 0.5 }}>{item.icon}</Box>
                <Typography variant="h6">{item.value}</Typography>
                <Typography variant="caption" color="text.secondary">{item.label}</Typography>
              </CardContent></Card>
            </Grid>
          ))}
        </Grid>
      )}

      <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="subtitle2">DAA度量 (Distance-Advanced Along Assignment)</Typography>
        <Button size="small" onClick={fetchData} disabled={loading}>刷新</Button>
      </Box>

      {loading ? <LinearProgress /> : (
        <TableContainer component={Paper} sx={{ maxHeight: 500, overflow: 'auto' }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell>Agent</TableCell>
                <TableCell>任务</TableCell>
                <TableCell>推进距离</TableCell>
                <TableCell>DAA得分</TableCell>
                <TableCell>速度</TableCell>
                <TableCell>停滞</TableCell>
                <TableCell>质量</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {metrics.map(m => (
                <TableRow key={`${m.agentId}-${m.assignmentId}`} hover>
                  <TableCell>{m.agentId}</TableCell>
                  <TableCell>
                    <Typography variant="caption">{m.taskType}</Typography><br />
                    <code>{m.assignmentId.slice(0, 8)}...</code>
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <LinearProgress variant="determinate"
                        value={(m.advancedDistance / m.totalDistance) * 100}
                        sx={{ flex: 1, height: 6, borderRadius: 3,
                          '& .MuiLinearProgress-bar': { bgcolor: getDAAColor(m.daaScore * 100) } }} />
                      <Typography variant="caption">
                        {((m.advancedDistance / m.totalDistance) * 100).toFixed(0)}%
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Chip label={`${(m.daaScore * 100).toFixed(1)}%`} size="small"
                      sx={{ bgcolor: getDAAColor(m.daaScore * 100), color: '#fff' }} />
                  </TableCell>
                  <TableCell>
                    <LinearProgress variant="determinate" value={m.currentVelocity * 100}
                      sx={{ width: 60, height: 4 }} />
                  </TableCell>
                  <TableCell>
                    {m.isStale ?
                      <Chip label="停滞" size="small" color="error" /> :
                      <Chip label="推进中" size="small" color="success" />}
                  </TableCell>
                  <TableCell>{m.details.qualityScore.toFixed(2)}</TableCell>
                </TableRow>
              ))}
              {metrics.length === 0 && (
                <TableRow><TableCell colSpan={7} align="center">暂无DAA度量数据</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
};

/** GUI减法Tab */
const GUITab: React.FC = () => {
  const [subtractions, setSubtractions] = useState<GUISubtraction[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get('/v14/daa/gui-subtraction');
      if (res.data?.code === 0) setSubtractions(res.data.data || []);
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const stageNames = ['全功能', '隐藏高级', '简化流程', '智能预测', '仅提示', '消失'];

  return (
    <Box>
      <Alert severity="info" sx={{ mb: 2 }}>
        <strong>GUI减法引擎</strong>: 界面交互逐步简化直至消失，能力隐性化。政府退后：定规则、供API，前台创造力交给社会Agent。
      </Alert>

      <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="subtitle2">GUI减法进度 (隐式化能力)</Typography>
        <Button size="small" onClick={fetchData} disabled={loading}>刷新</Button>
      </Box>

      {loading ? <LinearProgress /> : (
        <Grid container spacing={2}>
          {subtractions.map(s => (
            <Grid item xs={12} md={6} key={s.agentId}>
              <Card variant="outlined">
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="subtitle2">{s.agentId}</Typography>
                    <Chip label={`阶段 ${s.currentStage}: ${stageNames[s.currentStage] || s.stageName}`}
                      color={s.currentStage >= 4 ? 'success' : 'default'} size="small" />
                  </Box>
                  <LinearProgress
                    variant="determinate"
                    value={(s.currentStage / 5) * 100}
                    sx={{ height: 8, borderRadius: 4, mb: 1,
                      '& .MuiLinearProgress-bar': { bgcolor: s.currentStage >= 4 ? '#4caf50' : '#ff9800' } }}
                  />
                  <Typography variant="caption" color="text.secondary">
                    隐性化能力 ({s.implicitCapability.length}):
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
                    {s.implicitCapability.map((cap, i) => (
                      <Chip key={i} label={cap} size="small" variant="outlined" />
                    ))}
                  </Box>
                  {s.reductionHistory.length > 0 && (
                    <Box sx={{ mt: 1 }}>
                      <Typography variant="caption" color="text.secondary">最近移除:</Typography>
                      {s.reductionHistory.slice(-3).reverse().map((h, i) => (
                        <Typography key={i} variant="caption" display="block" sx={{ fontSize: '0.75rem' }}>
                          - {h.removedElement} (接受度: {(h.userAcceptance * 100).toFixed(0)}%)
                        </Typography>
                      ))}
                    </Box>
                  )}
                </CardContent>
              </Card>
            </Grid>
          ))}
          {subtractions.length === 0 && (
            <Grid item xs={12}><Alert severity="info">暂无GUI减法数据</Alert></Grid>
          )}
        </Grid>
      )}
    </Box>
  );
};

/** 政府退后Tab */
const RetreatTab: React.FC = () => {
  const [retreatStatus, setRetreatStatus] = useState<{
    isRetreating: boolean;
    retreatProgress: number;
    rulesPublished: number;
    apisPublished: number;
    frontendCreativityIndex: number;
  } | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get('/v14/daa/retreat-status');
      if (res.data?.code === 0) setRetreatStatus(res.data.data);
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  return (
    <Box>
      <Alert severity="success" sx={{ mb: 2 }}>
        <strong>政府退后机制</strong>: 定规则、供API，前台创造力交给社会Agent。政府不代替市场做决定，而是创造市场本身。
      </Alert>

      {loading ? <LinearProgress /> : retreatStatus && (
        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>退后状态</Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                  <Typography>政府角色:</Typography>
                  {retreatStatus.isRetreating ?
                    <Chip label="退后中" color="success" /> :
                    <Chip label="主导中" color="warning" />}
                </Box>
                <Typography variant="body2" color="text.secondary" gutterBottom>退后进度</Typography>
                <LinearProgress variant="determinate" value={retreatStatus.retreatProgress * 100}
                  sx={{ height: 10, borderRadius: 5, mb: 1 }} />
                <Typography variant="body2">{`${(retreatStatus.retreatProgress * 100).toFixed(1)}%`}</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>发布统计</Typography>
                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="text.secondary">规则发布</Typography>
                    <Typography variant="h4">{retreatStatus.rulesPublished}</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="text.secondary">API发布</Typography>
                    <Typography variant="h4">{retreatStatus.apisPublished}</Typography>
                  </Grid>
                  <Grid item xs={12}>
                    <Typography variant="body2" color="text.secondary">前台创造力指数</Typography>
                    <LinearProgress
                      variant="determinate"
                      value={retreatStatus.frontendCreativityIndex * 100}
                      sx={{ height: 8, borderRadius: 4 }} />
                    <Typography variant="body2">{`${(retreatStatus.frontendCreativityIndex * 100).toFixed(1)}%`}</Typography>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>中道智能逻辑 (法规×道义抉择)</Typography>
                <Divider sx={{ my: 1 }} />
                <Typography variant="body2" paragraph>
                  政府退后 ≠ 政府消失。政府保留"情"层 (Human-Override) 的中道余量，
                  在法规 (法层) 和道义 (理层) 之间提供柔性缓冲。
                </Typography>
                <Typography variant="body2" paragraph>
                  <strong>算计核</strong> (人类): 处理价值冲突、文化适配、伦理判断 — 机器无法量化的领域。
                  <strong>计算核</strong> (机器): 处理规则执行、数据分析、自动化流程 — 机器擅长的领域。
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  双核协同: 政府制定规则框架 (法层刚性) → Agent协同完善流程 (理层柔性) → 人类保留最终推翻权 (情层中道余量)
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}
    </Box>
  );
};

// =============== Main Panel ===============

const DAADashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState(0);

  return (
    <Box>
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
        <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)}>
          <Tab label="📏 DAA度量" />
          <Tab label="⬜ GUI减法" />
          <Tab label="🏛️ 政府退后" />
        </Tabs>
      </Box>
      {activeTab === 0 && <DAATab />}
      {activeTab === 1 && <GUITab />}
      {activeTab === 2 && <RetreatTab />}
    </Box>
  );
};

export default DAADashboard;
