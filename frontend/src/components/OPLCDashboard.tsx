import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Paper, Typography, Grid, Card, CardContent,
  Button, Chip, LinearProgress, Alert, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, IconButton,
  Tooltip, Tabs, Tab, Accordion, AccordionSummary, AccordionDetails
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import HowToVoteIcon from '@mui/icons-material/HowToVote';
import SecurityIcon from '@mui/icons-material/Security';
import SpeedIcon from '@mui/icons-material/Speed';
import ScienceIcon from '@mui/icons-material/Science';
import VerifiedUserIcon from '@mui/icons-material/VerifiedUser';
import WarningIcon from '@mui/icons-material/Warning';

const API_BASE = '/api/v15/oplc';

// ============================================================================
// 类型定义
// ============================================================================

interface Transaction {
  id: string;
  parents: string[];
  creator: string;
  lamportTimestamp: number;
  aggregatedVote: number; // +1, 0, -1
  voteCount: number;
  finalized: boolean;
  createdAt: string;
}

interface BlockInfo {
  blockId: string;
  transactionCount: number;
  joinHash: string;
  confirmed: boolean;
  lamportTimestamp: number;
  createdAt: string;
}

interface HealthReport {
  status: 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY';
  uptime: number;
  metrics: {
    relationActionS: number;
    phaseCoupling: number;
    topologicalImpedance: number;
    entropy: number;
    activeVotes: number;
    pendingRounds: number;
    totalBlocks: number;
    impedanceLevel: string;
  };
}

// ============================================================================
// 主面板组件
// ============================================================================

export default function OPLCDashboard() {
  const [activeTab, setActiveTab] = useState(0);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [blocks, setBlocks] = useState<BlockInfo[]>([]);
  const [health, setHealth] = useState<HealthReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 刷新所有数据
  const refreshAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [txRes, blockRes, healthRes] = await Promise.all([
        fetch(`${API_BASE}/transactions`),
        fetch(`${API_BASE}/maximal-elements`),
        fetch(`${API_BASE}/health`)
      ]);

      if (!txRes.ok || !blockRes.ok) throw new Error('API request failed');

      const txData = await txRes.json();
      const blockData = await blockRes.json();
      const healthData = await healthRes.json();

      setTransactions(txData.transactions || []);
      setBlocks(blockData.blocks || []);
      setHealth(healthData);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load data';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refreshAll(); }, [refreshAll]);

  // 创建交易
  const handleCreateTransaction = async () => {
    try {
      const res = await fetch(`${API_BASE}/transaction`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data: { type: 'demo', source: 'OPLCDashboard' },
          parentIds: []
        })
      });
      if (res.ok) {
        refreshAll();
      }
    } catch {}
  };

  // 运行共识
  const handleRunConsensus = async () => {
    try {
      await fetch(`${API_BASE}/consensus/run`, { method: 'POST' });
      refreshAll();
    } catch {}
  };

  // 投票标签颜色映射
  const getVoteColor = (vote: number): 'success' | 'warning' | 'error' | 'default' => {
    switch (vote) {
      case 1: return 'success';   // +1 Positive → 绿色
      case -1: return 'error';   // -1 Negative/Odd → 红色
      default: return 'default'; // 0 Neutral → 灰色
    }
  };

  const getVoteLabel = (vote: number): string => {
    return vote === 1 ? '+1 正' : vote === -1 ? '-1 奇' : '0 中';
  };

  // 健康状态颜色
  const getHealthColor = (status: string): 'success' | 'warning' | 'error' => {
    if (status === 'HEALTHY') return 'success';
    if (status === 'DEGRADED') return 'warning';
    return 'error';
  };

  return (
    <Box sx={{ p: 3 }}>
      {/* 标题栏 */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h4" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <AccountTreeIcon fontSize="large" color="primary" />
          奇正格链 OPLC V15.0 控制台
        </Typography>
        <Chip label="三进制逻辑 · 偏序格 · OP-BFT" color="primary" variant="outlined" />
      </Box>

      {/* 错误提示 */}
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {/* 健康状态卡片 */}
      {health && (
        <Alert severity={getHealthColor(health.status)} sx={{ mb: 3 }}>
          <Typography variant="subtitle2">
            系统状态: <strong>{health.status}</strong> |
            区块数: <strong>{health.metrics.totalBlocks}</strong> |
            活跃投票: <strong>{health.metrics.activeVotes}</strong> |
            阻抗等级: <strong>{health.metrics.impedanceLevel}</strong> |
            熵值: {(health.metrics.entropy * 100).toFixed(1)}%
          </Typography>
        </Alert>
      )}

      {/* Tab 导航 */}
      <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)} sx={{ mb: 3 }}>
        <Tab icon={<AccountTreeIcon />} label="偏序格浏览器" />
        <Tab icon={<HowToVoteIcon />} label="三进制投票" />
        <Tab icon={<SecurityIcon />} label="OP-BFT 共识" />
        <Tab icon={<ScienceIcon />} label="定理验证" />
        <Tab icon={<SpeedIcon />} label="系统监控" />
      </Tabs>

      {/* 操作按钮行 */}
      <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
        <Button variant="contained" startIcon={<AccountTreeIcon />} onClick={handleCreateTransaction}>
          创建交易
        </Button>
        <Button variant="contained" color="secondary" startIcon={<SecurityIcon />} onClick={handleRunConsensus}>
          运行 OP-BFT 共识
        </Button>
        <Button variant="outlined" onClick={refreshAll} disabled={loading}>
          {loading ? '加载中...' : '刷新'}
        </Button>
      </Box>

      {/* ===== Tab 1: 偏序格浏览器 ===== */}
      {activeTab === 0 && (
        <Grid container spacing={2}>
          {/* 极大元集（区块链视图）*/}
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 2 }}>
              <Typography variant="h6" gutterBottom>极大元集（区块）</Typography>
              <TableContainer>
                <Table size="small">
                  <TableHead><TableRow>
                    <TableCell>Block ID</TableCell>
                    <TableCell align="right">交易数</TableCell>
                    <TableCell>Lamport</TableCell>
                    <TableCell>状态</TableCell>
                  </TableRow></TableHead>
                  <TableBody>
                    {blocks.length === 0 ? (
                      <TableRow><TableCell colSpan={4} align="center">暂无极大元</TableCell></TableRow>
                    ) : blocks.map(b => (
                      <TableRow key={b.blockId}>
                        <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
                          {b.blockId.slice(0, 16)}...
                        </TableCell>
                        <TableCell align="right">{b.transactionCount}</TableCell>
                        <TableCell>{b.lamportTimestamp}</TableCell>
                        <TableCell>
                          <Chip label={b.confirmed ? '已确认' : '待定'} size="small"
                            color={b.confirmed ? 'success' : 'default'} variant="outlined" />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          </Grid>

          {/* 交易列表 */}
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 2 }}>
              <Typography variant="h6" gutterBottom>Poset 交易 ({transactions.length})</Typography>
              <TableContainer sx={{ maxHeight: 400 }}>
                <Table size="small">
                  <TableHead><TableRow>
                    <TableCell>ID (截断)</TableCell>
                    <TableCell align="center">投票</TableCell>
                    <TableCell align="center">状态</TableCell>
                    <TableCell align="right">Lamport</TableCell>
                  </TableRow></TableHead>
                  <TableBody>
                    {transactions.slice(0, 20).map(tx => (
                      <TableRow key={tx.id}>
                        <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.7rem' }}>
                          {tx.id.slice(0, 10)}...
                        </TableCell>
                        <TableCell align="center">
                          <Chip label={getVoteLabel(tx.aggregatedVote)} size="small"
                            color={getVoteColor(tx.aggregatedVote)} variant="filled" />
                        </TableCell>
                        <TableCell align="center">
                          {tx.finalized ? '✅ Finalized' : '⏳ Pending'}
                        </TableCell>
                        <TableCell align="right">{tx.lamportTimestamp}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          </Grid>
        </Grid>
      )}

      {/* ===== Tab 2: 三进制投票 ===== */}
      {activeTab === 1 && (
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <HowToVoteIcon /> 三进制投票状态空间
              </Typography>
              <Grid container spacing={2}>
                {[
                  { val: '+1', label: 'Positive（正）', desc: '验证通过，确认交易有效', color: '#4caf50' as const },
                  { val: '0', label: 'Neutral（中）', desc: '中立/未就绪，等待更多信息', color: '#9e9e9e' as const },
                  { val: '-1', label: 'Negative/Odd（奇）', desc: '揭发！需附带 Merkle Proof 作恶证据', color: '#f44336' as const },
                ].map(v => (
                  <Grid item xs={12} md={4} key={v.val}>
                    <Card sx={{
                      borderLeft: `4px solid ${v.color}`,
                      backgroundColor: `${v.color}08`
                    }}>
                      <CardContent>
                        <Typography variant="h5" sx={{ color: v.color, fontWeight: 'bold' }}>
                          {v.val}
                        </Typography>
                        <Typography variant="subtitle1">{v.label}</Typography>
                        <Typography variant="body2" color="text.secondary">{v.desc}</Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>

              {/* 投票统计 */}
              <Box mt={3}>
                <Typography variant="subtitle1">当前投票分布</Typography>
                {transactions.length > 0 ? (
                  <Box>
                    {(() => {
                      const pos = transactions.filter(t => t.aggregatedVote === 1).length;
                      const neg = transactions.filter(t => t.aggregatedVote === -1).length;
                      const neu = transactions.filter(t => t.aggregatedVote === 0).length;
                      const total = Math.max(transactions.length, 1);
                      return (
                        <>
                          <LinearProgress
                            variant="determinate"
                            value={(pos / total) * 100}
                            sx={{ height: 20, borderRadius: 2, my: 1, backgroundColor: '#eee',
                              '& .Mui-progress-bar': { backgroundColor: '#4caf50' }
                            }}
                          />
                          <Grid container spacing={1} justifyContent="space-between">
                            <Grid item><Chip label={`+1: ${pos}`} color="success" size="small" /></Grid>
                            <Grid item><Chip label={`0: ${neu}`} size="small" /></Grid>
                            <Grid item><Chip label={`-1: ${neg}`} color="error" size="small" /></Grid>
                            <Grid item><span style={{fontFamily:'monospace'}}>总计: {total}</span></Grid>
                          </Grid>
                        </>
                      );
                    })()}
                  </Box>
                ) : (
                  <Typography color="text.secondary">暂无交易数据，请先创建交易</Typography>
                )}
              </Box>
            </Paper>
          </Grid>
        </Grid>
      )}

      {/* ===== Tab 3: OP-BFT 共识 ===== */}
      {activeTab === 2 && (
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>
            <SecurityIcon sx={{ mr: 1 }} /> OP-BFT 共识流程
          </Typography>
          <Accordion defaultExpanded>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography>共识协议六阶段</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Grid container spacing={2}>
                {[
                  { phase: '① Propose', desc: 'Leader 提出候选交易集（来自极大元集）', icon: '📤' },
                  { phase: '② Ternary-Vote', desc: '所有节点投 +1/0/-1 三进制票', icon: '🗳️' },
                  { phase: '③ Verify', desc: '-1 票的 Merkle Proof 证据验证（O(n)复杂度）', icon: '🔍' },
                  { phase: '④ Aggregate', desc: '加权聚合 + 阈值判断', icon: '📊' },
                  { phase: '⑤ Decide', desc: 'Accept / Reject / Next-Round', icon: '⚖️' },
                  { phase: '⑥ Reconcile', desc: '冲突时 join 合并，不丢弃任何分支', icon: '🔗' },
                ].map(p => (
                  <Grid item xs={12} sm={6} md={4} key={p.phase}>
                    <Card variant="outlined" sx={{ p: 2, height: '100%' }}>
                      <Typography variant="subtitle1" fontWeight="bold">
                        {p.icon} {p.phase}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">{p.desc}</Typography>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            </AccordionDetails>
          </Accordion>

          <Accordion>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography>定理保证</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <Card sx={{ p: 2, borderLeft: '4px solid #4caf50' }}>
                    <Typography variant="subtitle1" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <VerifiedUserIcon color="success" /> 定理 3.1 — 安全性 (Safety)
                    </Typography>
                    <Typography variant="body2" sx={{ mt: 1 }}>
                      每个极大元是唯一的。不存在两笔不同的极大元包含同一笔交易。
                      保证无双花攻击。由 Poset meet/join 的数学性质保证。
                    </Typography>
                  </Card>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Card sx={{ p: 2, borderLeft: '4px solid #2196f3' }}>
                    <Typography variant="subtitle1" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <SpeedIcon color="info" /> 定理 3.2 — 活性 (Liveness)
                    </Typography>
                    <Typography variant="body2" sx={{ mt: 1 }}>
                      共识在有限轮次内终止（maxRounds=20 上界）。超时自动按净分值结算。
                      调解机制确保不因分叉而永久阻塞。
                    </Typography>
                  </Card>
                </Grid>
              </Grid>
            </AccordionDetails>
          </Accordion>
        </Paper>
      )}

      {/* ===== Tab 4 & 5: 简化版展示 ===== */}
      {activeTab === 3 && (
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom><ScienceIcon sx={{ mr: 1 }} /> 定理验证状态</Typography>
          <Alert severity="info">
            点击「运行 OP-BFT 共识」后，此处将显示定理 3.1（安全性）和定理 3.2（活性）的验证结果。
            <br />
            安全性检查：遍历所有极大元，确认每笔交易最多属于一个极大元。<br />
            活性检查：确认共识轮次不超过 maxRounds 上界（20轮）。
          </Alert>
          <Box mt={2}>
            <Button variant="contained" color="primary" onClick={handleRunConsensus}
              startIcon={<SecurityIcon />}>
              运行验证测试
            </Button>
          </Box>
        </Paper>
      )}

      {activeTab === 4 && health && (
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom><SpeedIcon sx={{ mr: 1 }} /> Φ 流贯动力学监控</Typography>
          <Grid container spacing={2}>
            {[
              { label: '关系作用量 S', value: health.metrics.relationActionS.toFixed(0), unit: '' },
              { label: '相位耦合', value: (health.metrics.phaseCoupling * 100).toFixed(1), unit: '%' },
              { label: '拓扑阻抗', value: health.metrics.topologicalImpedance.toFixed(2), unit: '' },
              { label: '系统熵', value: (health.metrics.entropy * 100).toFixed(1), unit: '%' },
              { label: '活跃投票', value: String(health.metrics.activeVotes), unit: '' },
              { label: '待定轮次', value: String(health.metrics.pendingRounds), unit: '' },
            ].map(m => (
              <Grid item xs={12} sm={6} md={2} key={m.label}>
                <Box textAlign="center" sx={{ p: 2 }}>
                  <Typography variant="caption" color="text.secondary">{m.label}</Typography>
                  <Typography variant="h5" fontWeight="bold">
                    {m.value}<span style={{fontSize:'0.7em'}}>{m.unit}</span>
                  </Typography>
                </Box>
              </Grid>
            ))}
          </Grid>
        </Paper>
      )}
    </Box>
  );
}
