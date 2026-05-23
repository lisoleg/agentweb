/**
 * CourtPanel - V12.0 宪法法院增强面板
 *
 * V11: 显示宪法审查案件列表、投票进度、判决结果
 * V12 增强功能:
 *   - 推理链DAG可视化 (JudgmentAnalysisEngine)
 *   - 意图查询 (Natural Language Query)
 *   - 沙盘预演面板 (JudgmentSimulator what-if)
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Chip,
  LinearProgress,
  Grid,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Alert,
  IconButton,
  Tooltip,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Switch,
  FormControlLabel,
  Tabs,
  Tab,
  Divider,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Badge,
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  Gavel as GavelIcon,
  Emergency as EmergencyIcon,
  HowToVote as VoteIcon,
  Psychology as PsychologyIcon,
  Schema as SchemaIcon,
  PlayArrow as PlayArrowIcon,
  ExpandMore as ExpandMoreIcon,
  Analytics as AnalyticsIcon,
  AutoAwesome as AutoAwesomeIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  RemoveCircleOutline as NeutralIcon,
  Search as SearchIcon,
  Insights as InsightsIcon,
} from '@mui/icons-material';

// ============ Types ============

type CaseState = 'PENDING' | 'VOTING' | 'RESOLVED' | 'DISMISSED';
type JudgmentType = 'NONE' | 'UPHOLD' | 'OVERTURN' | 'REMAND';

interface CourtCase {
  caseId: number;
  amendmentId: number;
  filer: string;
  reason: string;
  state: CaseState;
  isEmergency: boolean;
  yesVotes: number;
  noVotes: number;
  totalVoters: number;
  judgment: JudgmentType;
}

// V12 Analysis Types
interface VotingCluster {
  label: string;
  voterCount: number;
  totalPower: string;
  avgPower: number;
  supportRatio: number;
}

interface AnomalyDetection {
  isAnomalous: boolean;
  anomalyScore: number;
  details: string;
}

interface ImpactPrediction {
  judgment: JudgmentType;
  probability: number;
  impactDescription: string;
  affectedClauses: string[];
}

interface CaseAnalysis {
  clusters: VotingCluster[];
  anomalies: AnomalyDetection[];
  impactPredictions: ImpactPrediction[];
  summary: string;
}

interface WhatIfScenario {
  description: string;
  yesRate: number;
  judgment: JudgmentType;
  probability: number;
}

interface SimulationResult {
  caseId: number;
  currentYesRate: number;
  simulatedYesRate: number;
  predictedJudgment: JudgmentType;
  judgmentProbability: number;
  timeRemaining: number;
  whatIfScenarios: WhatIfScenario[];
  impactAssessment: string;
}

interface QueryResult {
  query: string;
  interpretation: string;
  results: Array<{
    caseId: number;
    relevance: number;
    summary: string;
  }>;
}

// ============ Mock Data ============

const initialCases: CourtCase[] = [
  { caseId: 1, amendmentId: 10, filer: '0xAbc...123', reason: '修正案违反核心条款', state: 'VOTING', isEmergency: false, yesVotes: 6500, noVotes: 3500, totalVoters: 12, judgment: 'NONE' },
  { caseId: 2, amendmentId: 11, filer: '0xDef...456', reason: '紧急安全审查', state: 'PENDING', isEmergency: true, yesVotes: 0, noVotes: 0, totalVoters: 0, judgment: 'NONE' },
  { caseId: 3, amendmentId: 8, filer: '0xGhi...789', reason: '修正案程序违规', state: 'RESOLVED', isEmergency: false, yesVotes: 7200, noVotes: 2800, totalVoters: 25, judgment: 'UPHOLD' },
  { caseId: 4, amendmentId: 9, filer: '0xJkl...012', reason: '修正案内容违宪', state: 'RESOLVED', isEmergency: false, yesVotes: 2800, noVotes: 7200, totalVoters: 18, judgment: 'OVERTURN' },
  { caseId: 5, amendmentId: 12, filer: '0xMno...345', reason: '发回重审申请', state: 'RESOLVED', isEmergency: false, yesVotes: 5000, noVotes: 5000, totalVoters: 20, judgment: 'REMAND' },
];

const mockAnalysis: CaseAnalysis = {
  clusters: [
    { label: '低Φ(0-1000)', voterCount: 2, totalPower: '250', avgPower: 125, supportRatio: 0 },
    { label: '中Φ(1000-5000)', voterCount: 1, totalPower: '3000', avgPower: 3000, supportRatio: 1 },
    { label: '高Φ(5000+)', voterCount: 2, totalPower: '13000', avgPower: 6500, supportRatio: 1 },
  ],
  anomalies: [
    { isAnomalous: false, anomalyScore: 0, details: '未检测到投票异常' },
  ],
  impactPredictions: [
    { judgment: 'UPHOLD', probability: 0.969, impactDescription: '修正案维持有效，现有治理结构不变', affectedClauses: [] },
    { judgment: 'REMAND', probability: 0.025, impactDescription: '发回重审，需补充证据', affectedClauses: ['第3条'] },
    { judgment: 'OVERTURN', probability: 0.006, impactDescription: '修正案被推翻，恢复原始条款', affectedClauses: ['第1条', '第3条'] },
  ],
  summary: '裁决分析: 最可能判决=UPHOLD，概率=96.9%。 高Φ段支持率=100.0%。',
};

const mockSimulation: SimulationResult = {
  caseId: 1,
  currentYesRate: 65.0,
  simulatedYesRate: 71.4,
  predictedJudgment: 'UPHOLD',
  judgmentProbability: 0.97,
  timeRemaining: 864000,
  whatIfScenarios: [
    { description: '支持率+10%', yesRate: 75.0, judgment: 'UPHOLD', probability: 0.99 },
    { description: '支持率-10%', yesRate: 55.0, judgment: 'REMAND', probability: 0.77 },
    { description: '达到67%阈值', yesRate: 67.0, judgment: 'UPHOLD', probability: 0.95 },
  ],
  impactAssessment: '修正案维持有效。现有治理结构不变，社区共识得到确认。',
};

// ============ Sub-components ============

function CaseStateChip({ state }: { state: CaseState }) {
  const config: Record<CaseState, { color: 'default' | 'primary' | 'success' | 'error'; label: string }> = {
    PENDING: { color: 'default', label: '待批准' },
    VOTING: { color: 'primary', label: '投票中' },
    RESOLVED: { color: 'success', label: '已判决' },
    DISMISSED: { color: 'error', label: '已驳回' },
  };
  const c = config[state];
  return <Chip label={c.label} color={c.color} size="small" />;
}

function JudgmentChip({ judgment }: { judgment: JudgmentType }) {
  const config: Record<JudgmentType, { color: 'default' | 'success' | 'error' | 'warning'; label: string }> = {
    NONE: { color: 'default', label: '-' },
    UPHOLD: { color: 'success', label: '维持' },
    OVERTURN: { color: 'error', label: '推翻' },
    REMAND: { color: 'warning', label: '发回' },
  };
  const c = config[judgment];
  return <Chip label={c.label} color={c.color} size="small" variant="outlined" />;
}

function VotingProgress({ yesVotes, noVotes }: { yesVotes: number; noVotes: number }) {
  const total = yesVotes + noVotes;
  const pct = total > 0 ? (yesVotes / total) * 100 : 0;
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
      <LinearProgress
        variant="determinate"
        value={pct}
        color={pct >= 67 ? 'success' : pct >= 33 ? 'warning' : 'error'}
        sx={{ height: 8, borderRadius: 4, flex: 1 }}
      />
      <Typography variant="caption" fontWeight="bold" sx={{ minWidth: 36 }}>
        {pct.toFixed(0)}%
      </Typography>
    </Box>
  );
}

// ============ V12: Reasoning DAG Visualization ============

function ReasoningDAG({ analysis }: { analysis: CaseAnalysis }) {
  return (
    <Box>
      {/* Clusters */}
      <Typography variant="subtitle2" sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 0.5 }}>
        <SchemaIcon fontSize="small" color="primary" />
        Φ加权投票聚类
      </Typography>
      <Grid container spacing={1} sx={{ mb: 2 }}>
        {analysis.clusters.map((cluster, idx) => (
          <Grid item xs={12} sm={4} key={idx}>
            <Card variant="outlined" sx={{
              bgcolor: cluster.supportRatio >= 0.8 ? 'success.50' :
                       cluster.supportRatio >= 0.5 ? 'warning.50' : 'error.50',
              borderColor: cluster.supportRatio >= 0.8 ? 'success.main' :
                           cluster.supportRatio >= 0.5 ? 'warning.main' : 'error.main',
            }}>
              <CardContent sx={{ py: 1, px: 1.5, '&:last-child': { pb: 1 } }}>
                <Typography variant="caption" fontWeight="bold">{cluster.label}</Typography>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.5 }}>
                  <Typography variant="caption" color="text.secondary">
                    {cluster.voterCount}人
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Φ={cluster.totalPower}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
                  <LinearProgress
                    variant="determinate"
                    value={cluster.supportRatio * 100}
                    color={cluster.supportRatio >= 0.8 ? 'success' : cluster.supportRatio >= 0.5 ? 'warning' : 'error'}
                    sx={{ height: 6, borderRadius: 3, flex: 1 }}
                  />
                  <Typography variant="caption" fontWeight="bold">
                    {(cluster.supportRatio * 100).toFixed(0)}%
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* DAG Flow Visualization */}
      <Box sx={{
        p: 1.5,
        border: '1px dashed',
        borderColor: 'divider',
        borderRadius: 1,
        mb: 2,
        fontFamily: 'monospace',
        fontSize: '0.75rem',
        whiteSpace: 'pre',
        overflowX: 'auto',
        color: 'text.secondary',
        bgcolor: 'grey.50',
      }}>
{`  ┌──────────┐     ┌──────────┐     ┌──────────┐
  │ 低Φ段    │     │ 中Φ段    │     │ 高Φ段    │
  │ 反对0%   │     │ 支持100% │────▶│ 支持100% │
  └────┬─────┘     └────┬─────┘     └────┬─────┘
       │                │                │
       ▼                ▼                ▼
  ┌────────────────────────────────────────────┐
  │          Φ加权聚合 (30%+25%+25%+20%)       │
  └──────────────────┬─────────────────────────┘
                     │
              ┌──────▼──────┐
              │  异常检测    │
              │  Score: 0   │ ✅ 无异常
              └──────┬──────┘
                     │
              ┌──────▼──────┐
              │  影响预测    │
              │  UPHOLD 97%  │──▶ 维持有效
              └─────────────┘`}
      </Box>

      {/* Anomalies */}
      <Typography variant="subtitle2" sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 0.5 }}>
        <WarningIcon fontSize="small" color="warning" />
        异常检测
      </Typography>
      <List dense>
        {analysis.anomalies.map((anomaly, idx) => (
          <ListItem key={idx} sx={{ py: 0 }}>
            <ListItemIcon sx={{ minWidth: 28 }}>
              {anomaly.isAnomalous ? (
                <WarningIcon color="error" fontSize="small" />
              ) : (
                <CheckCircleIcon color="success" fontSize="small" />
              )}
            </ListItemIcon>
            <ListItemText
              primary={anomaly.details}
              secondary={anomaly.isAnomalous ? `异常分数: ${anomaly.anomalyScore}` : undefined}
              primaryTypographyProps={{ variant: 'body2' }}
              secondaryTypographyProps={{ variant: 'caption' }}
            />
          </ListItem>
        ))}
      </List>

      {/* Impact Predictions */}
      <Typography variant="subtitle2" sx={{ mt: 1, mb: 1, display: 'flex', alignItems: 'center', gap: 0.5 }}>
        <InsightsIcon fontSize="small" color="info" />
        裁决影响预测
      </Typography>
      {analysis.impactPredictions.map((pred, idx) => (
        <Box key={idx} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
          <JudgmentChip judgment={pred.judgment} />
          <LinearProgress
            variant="determinate"
            value={pred.probability * 100}
            sx={{ height: 6, borderRadius: 3, flex: 1 }}
            color={idx === 0 ? 'primary' : 'default'}
          />
          <Typography variant="caption" fontWeight="bold" sx={{ minWidth: 40 }}>
            {(pred.probability * 100).toFixed(1)}%
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ flex: 2 }}>
            {pred.impactDescription}
          </Typography>
        </Box>
      ))}
    </Box>
  );
}

// ============ V12: Intent Query Panel ============

function IntentQueryPanel() {
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<QueryResult | null>(null);
  const [loading, setLoading] = useState(false);

  const handleQuery = () => {
    if (!query.trim()) return;
    setLoading(true);
    // Simulate API call
    setTimeout(() => {
      setResult({
        query,
        interpretation: `意图解析: 查询与"${query}"相关的裁决案件`,
        results: [
          { caseId: 1, relevance: 0.95, summary: '修正案违反核心条款 - 投票进行中' },
          { caseId: 3, relevance: 0.72, summary: '修正案程序违规 - 已判决UPHOLD' },
          { caseId: 5, relevance: 0.45, summary: '发回重审申请 - 已判决REMAND' },
        ],
      });
      setLoading(false);
    }, 800);
  };

  const sampleQueries = [
    '哪些案件正在投票？',
    '最近推翻的修正案',
    '高Φ投票者都支持什么？',
    '紧急案件的处理结果',
  ];

  return (
    <Box>
      <Typography variant="subtitle2" sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 0.5 }}>
        <AutoAwesomeIcon fontSize="small" color="secondary" />
        意图驱动查询 (6GNetGPT Intent-Driven)
      </Typography>
      <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
        用自然语言查询裁决数据，AI自动解析意图并匹配结果
      </Typography>

      {/* Quick Query Chips */}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 1.5 }}>
        {sampleQueries.map((sq) => (
          <Chip
            key={sq}
            label={sq}
            size="small"
            variant="outlined"
            onClick={() => setQuery(sq)}
            sx={{ cursor: 'pointer' }}
          />
        ))}
      </Box>

      {/* Input */}
      <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
        <TextField
          size="small"
          placeholder="输入自然语言查询..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleQuery()}
          fullWidth
          InputProps={{
            startAdornment: <SearchIcon color="action" sx={{ mr: 1 }} fontSize="small" />,
          }}
        />
        <Button
          variant="contained"
          size="small"
          onClick={handleQuery}
          disabled={loading || !query.trim()}
          startIcon={<AutoAwesomeIcon />}
        >
          查询
        </Button>
      </Box>

      {/* Result */}
      {result && (
        <Card variant="outlined">
          <CardContent sx={{ py: 1.5 }}>
            <Typography variant="caption" color="primary" fontWeight="bold">
              {result.interpretation}
            </Typography>
            <Divider sx={{ my: 1 }} />
            {result.results.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                未找到相关案件
              </Typography>
            ) : (
              result.results.map((r) => (
                <Box key={r.caseId} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                  <Chip label={`#${r.caseId}`} size="small" variant="outlined" />
                  <LinearProgress
                    variant="determinate"
                    value={r.relevance * 100}
                    sx={{ height: 4, borderRadius: 2, width: 60 }}
                    color="primary"
                  />
                  <Typography variant="caption">{(r.relevance * 100).toFixed(0)}%</Typography>
                  <Typography variant="body2" sx={{ flex: 1 }}>{r.summary}</Typography>
                </Box>
              ))
            )}
          </CardContent>
        </Card>
      )}
    </Box>
  );
}

// ============ V12: Simulation Sandbox ============

function SimulationSandbox() {
  const [selectedCaseId, setSelectedCaseId] = useState<number>(1);
  const [supportChange, setSupportChange] = useState<number>(0);
  const [simulation, setSimulation] = useState<SimulationResult | null>(null);
  const [simulating, setSimulating] = useState(false);

  const runSimulation = () => {
    setSimulating(true);
    // Simulate API call to /api/v12/court/simulate
    setTimeout(() => {
      const baseRate = mockSimulation.currentYesRate;
      const newRate = Math.min(100, Math.max(0, baseRate + supportChange));
      let predictedJudgment: JudgmentType = 'REMAND';
      if (newRate >= 67) predictedJudgment = 'UPHOLD';
      else if (newRate < 33) predictedJudgment = 'OVERTURN';

      setSimulation({
        ...mockSimulation,
        caseId: selectedCaseId,
        simulatedYesRate: newRate,
        predictedJudgment,
        judgmentProbability: newRate >= 67 ? 0.9 + (newRate - 67) / 330 : newRate < 33 ? 0.9 + (33 - newRate) / 330 : 0.5,
        whatIfScenarios: [
          { description: '支持率+10%', yesRate: Math.min(100, newRate + 10), judgment: (newRate + 10) >= 67 ? 'UPHOLD' : 'REMAND', probability: 0.8 },
          { description: '支持率-10%', yesRate: Math.max(0, newRate - 10), judgment: (newRate - 10) < 33 ? 'OVERTURN' : (newRate - 10) >= 67 ? 'UPHOLD' : 'REMAND', probability: 0.75 },
          { description: '达到67%阈值', yesRate: 67, judgment: 'UPHOLD', probability: 0.95 },
        ],
      });
      setSimulating(false);
    }, 600);
  };

  const formatTime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    return `${days}天${hours}小时`;
  };

  return (
    <Box>
      <Typography variant="subtitle2" sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 0.5 }}>
        <PsychologyIcon fontSize="small" color="info" />
        判决沙盘预演 (Digital Twin Simulation)
      </Typography>
      <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
        模拟不同投票场景，预测裁决结果和影响（6GNetGPT数字孪生思想）
      </Typography>

      {/* Simulation Controls */}
      <Card variant="outlined" sx={{ mb: 2 }}>
        <CardContent sx={{ py: 1.5 }}>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} sm={4}>
              <TextField
                label="案件ID"
                type="number"
                size="small"
                value={selectedCaseId}
                onChange={(e) => setSelectedCaseId(Number(e.target.value))}
                fullWidth
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                label="支持率变化 (%)"
                type="number"
                size="small"
                value={supportChange}
                onChange={(e) => setSupportChange(Number(e.target.value))}
                fullWidth
                InputProps={{
                  inputProps: { min: -100, max: 100 },
                }}
                helperText="正=增加支持，负=减少支持"
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <Button
                variant="contained"
                fullWidth
                onClick={runSimulation}
                disabled={simulating}
                startIcon={<PlayArrowIcon />}
                sx={{ height: 40 }}
              >
                {simulating ? '模拟中...' : '运行沙盘'}
              </Button>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Simulation Results */}
      {simulation && (
        <Box>
          {/* Current vs Simulated */}
          <Grid container spacing={1} sx={{ mb: 2 }}>
            <Grid item xs={6}>
              <Card variant="outlined" sx={{ textAlign: 'center', py: 1 }}>
                <Typography variant="overline" color="text.secondary">当前支持率</Typography>
                <Typography variant="h6" fontWeight="bold">
                  {simulation.currentYesRate.toFixed(1)}%
                </Typography>
              </Card>
            </Grid>
            <Grid item xs={6}>
              <Card variant="outlined" sx={{
                textAlign: 'center',
                py: 1,
                borderColor: simulation.predictedJudgment === 'UPHOLD' ? 'success.main' :
                             simulation.predictedJudgment === 'OVERTURN' ? 'error.main' : 'warning.main',
              }}>
                <Typography variant="overline" color="text.secondary">模拟支持率</Typography>
                <Typography variant="h6" fontWeight="bold" color={
                  simulation.predictedJudgment === 'UPHOLD' ? 'success.main' :
                  simulation.predictedJudgment === 'OVERTURN' ? 'error.main' : 'warning.main'
                }>
                  {simulation.simulatedYesRate.toFixed(1)}%
                </Typography>
              </Card>
            </Grid>
          </Grid>

          {/* Prediction */}
          <Card sx={{ mb: 2, borderLeft: '4px solid', borderColor: 'primary.main' }}>
            <CardContent sx={{ py: 1.5 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <Typography variant="subtitle2">预测判决</Typography>
                <JudgmentChip judgment={simulation.predictedJudgment} />
                <Typography variant="caption" color="text.secondary">
                  置信度 {(simulation.judgmentProbability * 100).toFixed(1)}%
                </Typography>
              </Box>
              <Typography variant="body2" color="text.secondary">
                {simulation.impactAssessment}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                剩余投票时间: {formatTime(simulation.timeRemaining)}
              </Typography>
            </CardContent>
          </Card>

          {/* What-If Scenarios */}
          <Typography variant="subtitle2" sx={{ mb: 1 }}>What-If 场景分析</Typography>
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>场景</TableCell>
                  <TableCell>支持率</TableCell>
                  <TableCell>预测判决</TableCell>
                  <TableCell>置信度</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {simulation.whatIfScenarios.map((scenario, idx) => (
                  <TableRow key={idx}>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        {scenario.yesRate > simulation.currentYesRate ? (
                          <TrendingUpIcon color="success" fontSize="small" />
                        ) : scenario.yesRate < simulation.currentYesRate ? (
                          <TrendingDownIcon color="error" fontSize="small" />
                        ) : (
                          <NeutralIcon color="action" fontSize="small" />
                        )}
                        {scenario.description}
                      </Box>
                    </TableCell>
                    <TableCell>{scenario.yesRate.toFixed(1)}%</TableCell>
                    <TableCell><JudgmentChip judgment={scenario.judgment} /></TableCell>
                    <TableCell>{(scenario.probability * 100).toFixed(1)}%</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      )}
    </Box>
  );
}

// ============ Main Component ============

export default function CourtPanel() {
  const [cases, setCases] = useState<CourtCase[]>(initialCases);
  const [showSubmit, setShowSubmit] = useState(false);
  const [isEmergency, setIsEmergency] = useState(false);
  const [newCase, setNewCase] = useState({ amendmentId: '', reason: '' });
  const [activeTab, setActiveTab] = useState(0);
  const [selectedCaseForAnalysis, setSelectedCaseForAnalysis] = useState<number | null>(null);

  const refresh = useCallback(() => {
    // In production, fetch from API
  }, []);

  const handleSubmit = () => {
    setShowSubmit(false);
    setNewCase({ amendmentId: '', reason: '' });
    setIsEmergency(false);
  };

  const votingCases = cases.filter(c => c.state === 'VOTING').length;
  const resolvedCases = cases.filter(c => c.state === 'RESOLVED').length;
  const emergencyCases = cases.filter(c => c.isEmergency).length;

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <GavelIcon color="primary" />
          <Typography variant="h6">Constitution Court</Typography>
          <Chip label="V12.0" color="secondary" size="small" />
          <Chip label="6G-Σ" variant="outlined" size="small" />
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Tooltip title="Refresh">
            <IconButton onClick={refresh} size="small">
              <RefreshIcon />
            </IconButton>
          </Tooltip>
          <Button
            variant="contained"
            size="small"
            startIcon={<GavelIcon />}
            onClick={() => setShowSubmit(true)}
          >
            Submit Case
          </Button>
        </Box>
      </Box>

      {/* KPI Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={3}>
          <Card sx={{ borderLeft: '4px solid', borderColor: 'primary.main' }}>
            <CardContent>
              <Typography variant="overline" color="text.secondary">Voting</Typography>
              <Typography variant="h5" fontWeight="bold" color="primary.main">{votingCases}</Typography>
              <Typography variant="caption">Active voting cases</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={3}>
          <Card sx={{ borderLeft: '4px solid', borderColor: 'success.main' }}>
            <CardContent>
              <Typography variant="overline" color="text.secondary">Resolved</Typography>
              <Typography variant="h5" fontWeight="bold" color="success.main">{resolvedCases}</Typography>
              <Typography variant="caption">Judgments rendered</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={3}>
          <Card sx={{ borderLeft: '4px solid', borderColor: 'error.main' }}>
            <CardContent>
              <Typography variant="overline" color="text.secondary">Emergency</Typography>
              <Typography variant="h5" fontWeight="bold" color="error.main">{emergencyCases}</Typography>
              <Typography variant="caption">Emergency cases</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={3}>
          <Card sx={{ borderLeft: '4px solid', borderColor: 'secondary.main' }}>
            <CardContent>
              <Typography variant="overline" color="text.secondary">AI Analysis</Typography>
              <Typography variant="h5" fontWeight="bold" color="secondary.main">
                <Badge badgeContent="NEW" color="secondary">
                  <PsychologyIcon fontSize="small" />
                </Badge>
              </Typography>
              <Typography variant="caption">内生AI裁决引擎</Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* V12: Tab Navigation */}
      <Tabs
        value={activeTab}
        onChange={(_, v) => setActiveTab(v)}
        variant="scrollable"
        scrollButtons="auto"
        sx={{ mb: 2, borderBottom: 1, borderColor: 'divider' }}
      >
        <Tab label="案件列表" icon={<GavelIcon />} iconPosition="start" />
        <Tab label="推理链DAG" icon={<SchemaIcon />} iconPosition="start" />
        <Tab label="意图查询" icon={<AutoAwesomeIcon />} iconPosition="start" />
        <Tab label="沙盘预演" icon={<PsychologyIcon />} iconPosition="start" />
      </Tabs>

      {/* Tab Content */}
      {activeTab === 0 && (
        <Box>
          {/* Cases Table */}
          <TableContainer component={Paper} sx={{ mb: 3 }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>ID</TableCell>
                  <TableCell>Amendment</TableCell>
                  <TableCell>Filer</TableCell>
                  <TableCell>Reason</TableCell>
                  <TableCell>State</TableCell>
                  <TableCell>Emergency</TableCell>
                  <TableCell>Voting Progress</TableCell>
                  <TableCell>Judgment</TableCell>
                  <TableCell>V12</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {cases.map((courtCase) => (
                  <TableRow key={courtCase.caseId} hover>
                    <TableCell>#{courtCase.caseId}</TableCell>
                    <TableCell>A-{courtCase.amendmentId}</TableCell>
                    <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.8em' }}>
                      {courtCase.filer}
                    </TableCell>
                    <TableCell>{courtCase.reason}</TableCell>
                    <TableCell><CaseStateChip state={courtCase.state} /></TableCell>
                    <TableCell>
                      {courtCase.isEmergency ? (
                        <EmergencyIcon color="error" fontSize="small" />
                      ) : '-'}
                    </TableCell>
                    <TableCell sx={{ minWidth: 150 }}>
                      {courtCase.state === 'VOTING' || courtCase.state === 'RESOLVED' ? (
                        <VotingProgress yesVotes={courtCase.yesVotes} noVotes={courtCase.noVotes} />
                      ) : '-'}
                    </TableCell>
                    <TableCell><JudgmentChip judgment={courtCase.judgment} /></TableCell>
                    <TableCell>
                      {(courtCase.state === 'VOTING' || courtCase.state === 'RESOLVED') && (
                        <Tooltip title="查看推理链">
                          <IconButton
                            size="small"
                            color="secondary"
                            onClick={() => {
                              setSelectedCaseForAnalysis(courtCase.caseId);
                              setActiveTab(1);
                            }}
                          >
                            <AnalyticsIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          {/* Info */}
          <Alert severity="info">
            <strong>Judgment Threshold:</strong> 67% approval → UPHOLD; &lt;33% → OVERTURN (marks amendment FAILED); 33%-67% → REMAND (sends back for re-review)
          </Alert>
        </Box>
      )}

      {activeTab === 1 && (
        <Box>
          {selectedCaseForAnalysis ? (
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <Chip label={`Case #${selectedCaseForAnalysis}`} color="primary" />
                <Typography variant="body2" color="text.secondary">
                  裁决推理链分析
                </Typography>
                <Button size="small" onClick={() => setSelectedCaseForAnalysis(null)}>
                  清除选择
                </Button>
              </Box>
              <ReasoningDAG analysis={mockAnalysis} />
            </Box>
          ) : (
            <Alert severity="info" sx={{ mb: 2 }}>
              请从案件列表中点击 <AnalyticsIcon fontSize="small" sx={{ verticalAlign: 'middle' }} /> 按钮选择要分析的案件
            </Alert>
          )}
        </Box>
      )}

      {activeTab === 2 && <IntentQueryPanel />}
      {activeTab === 3 && <SimulationSandbox />}

      {/* Submit Case Dialog */}
      <Dialog open={showSubmit} onClose={() => setShowSubmit(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Submit Constitutional Case</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <FormControlLabel
              control={<Switch checked={isEmergency} onChange={(e) => setIsEmergency(e.target.checked)} />}
              label="Emergency Case"
            />
            <TextField
              label="Amendment ID"
              type="number"
              value={newCase.amendmentId}
              onChange={(e) => setNewCase({ ...newCase, amendmentId: e.target.value })}
              fullWidth
              size="small"
            />
            <TextField
              label="Reason"
              multiline
              rows={3}
              value={newCase.reason}
              onChange={(e) => setNewCase({ ...newCase, reason: e.target.value })}
              fullWidth
              size="small"
            />
            {isEmergency && (
              <Alert severity="warning">
                Emergency cases require owner approval before voting begins.
              </Alert>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowSubmit(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSubmit}>Submit</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
