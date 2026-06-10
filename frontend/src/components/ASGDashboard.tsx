/**
 * V17.0 ASG (Agent Security Gateway) Dashboard
 *
 * 基于 MetaMask Agent Wallet 四道安全防线的完整前端控制台
 * 6个Tab：系统总览 / Agent管理 / 交易门控 / HITL审批 / TEE密钥 / 经济安全池
 */
import React, { useState, useEffect } from 'react';
import {
  Box,
  Tabs,
  Tab,
  Typography,
  Paper,
  Grid,
  Card,
  CardContent,
  LinearProgress,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  Alert,
  Switch,
  FormControlLabel,
  Slider,
  TextField,
  Select,
  MenuItem,
  InputLabel,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  Security as SecurityIcon,
  Shield as ShieldIcon,
  VerifiedUser as VerifiedIcon,
  Lock as LockIcon,
  AccountBalanceWallet as WalletIcon,
  Speed as DashboardIcon,
  Gavel as GavelIcon,
  Visibility as EyeIcon,
  Block as BlockIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
  Send as SendIcon,
  Fingerprint as FingerprintIcon,
  MonetizationOn as MoneyIcon,
} from '@mui/icons-material';

const API_BASE = '/api/v17/asg';

// ====== 类型定义 ======

interface SystemState {
  totalAgents: number;
  activeAgents: number;
  todayTotalRequests: number;
  todayGatePassed: number;
  gateRejectionRate: number;
  economicPool: { totalStaked: number; totalSlashed: number; totalPaidOut: number };
  teeKeyStats: { totalKeys: number; activeKeys: number; exportedKeys: number };
}

interface AgentInfo {
  did: string;
  displayName: string;
  agentType: string;
  trustScore: number;
  status: string;
  mode: string;
  totalOps: number;
}

interface GateStats {
  totalPipelinesRun: number;
  passedCount: number;
  rejectedCount: number;
  passRate: number;
}

interface HITLRequestItem {
  requestId: string;
  status: string;
  riskLevel: string;
  title: string;
  amount: string;
}

// ====== 主组件 ======

export default function ASGDashboard() {
  const [tab, setTab] = useState(0);
  const [systemState, setSystemState] = useState<SystemState | null>(null);
  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [gateStats, setGateStats] = useState<GateStats | null>(null);
  const [hitlRequests, setHitlRequests] = useState<HITLRequestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 加载所有数据
  useEffect(() => {
    fetchAllData();
  }, [tab]);

  const fetchAllData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [statsRes, agentsRes, gateRes] = await Promise.all([
        fetch(`${API_BASE}/stats`).then((r) => r.json()),
        fetch(`${API_BASE}/agents?limit=20`).then((r) => r.json()),
        fetch(`${API_BASE}/gate/stats`).then((r) => r.json()),
      ]);

      if (statsRes.code === 0) setSystemState(statsRes.data);
      if (agentsRes.code === 0) setAgents(agentsRes.data);
      if (gateRes.code === 0) setGateStats(gateRes.data);

      // 加载HITL请求
      try {
        const hitlRes = await fetch(`${API_BASE}/hitl?agentDid=test`).then((r) => r.json());
        if (hitlRes.code === 0 && Array.isArray(hitlRes.data)) {
          setHitlRequests(hitlRes.data);
        }
      } catch {
        // HITL数据可选
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  // ====== 颜色工具函数 ======
  const getRiskColor = (score: number): 'success' | 'warning' | 'error' => {
    if (score < 4) return 'success';
    if (score < 7) return 'warning';
    return 'error';
  };

  const getModeColor = (mode: string): 'default' | 'primary' | 'secondary' => {
    return mode === 'beast' ? 'secondary' : 'primary';
  };

  // ====================================================================
  // Tab 1: 系统总览
  // ====================================================================
  const renderOverview = () => (
    <Box>
      <Typography variant="h5" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <DashboardIcon color="primary" /> ASG 系统总览
      </Typography>

      <Grid container spacing={3}>
        {/* 核心指标卡片 */}
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ bgcolor: '#1a237e', color: '#fff' }}>
            <CardContent>
              <Typography variant="body2" opacity={0.7}>注册Agent总数</Typography>
              <Typography variant="h4">{systemState?.totalAgents || 0}</Typography>
              <Typography variant="body2" opacity={0.7}>活跃: {systemState?.activeAgents || 0}</Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ bgcolor: '#006064', color: '#fff' }}>
            <CardContent>
              <Typography variant="body2" opacity={0.7}>今日请求</Typography>
              <Typography variant="h4">{systemState?.todayTotalRequests || 0}</Typography>
              <LinearProgress
                variant="determinate"
                value={
                  systemState && systemState.todayTotalRequests > 0
                    ? (systemState.todayGatePassed / systemState.todayTotalRequests) * 100
                    : 0
                }
                sx={{ mt: 1, bgcolor: 'rgba(255,255,255,0.3)', '& .Mui-bar': { bgcolor: '#4caf50' } }}
              />
              <Typography variant="caption">通过率: {systemState?.todayGatePassed || 0}/{systemState?.todayTotalRequests || 0}</Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ bgcolor: '#4a148c', color: '#fff' }}>
            <CardContent>
              <Typography variant="body2" opacity={0.7}>门控拦截率</Typography>
              <Typography variant="h4">
                {systemState ? ((systemState.gateRejectionRate || 0) * 100).toFixed(1) : 0}%
              </Typography>
              <Typography variant="body2" opacity={0.7}>
                安全等级: {systemState && systemState.gateRejectionRate < 0.05 ? '正常' : '偏高'}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ bgcolor: '#bf360c', color: '#fff' }}>
            <CardContent>
              <Typography variant="body2" opacity={0.7}>经济池质押</Typography>
              <Typography variant="h4">
                ${(systemState?.economicPool.totalStaked || 0).toLocaleString()}
              </Typography>
              <Typography variant="body2" opacity={0.7}>
                已赔付: ${(systemState?.economicPool.totalPaidOut || 0).toLocaleString()}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        {/* 六层安全架构图 */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>六层纵深防御架构</Typography>
              <Box sx={{
                display: 'flex',
                flexDirection: 'column',
                gap: 1,
                p: 2,
                background: 'linear-gradient(180deg, #e8f5e9 0%, #fff3e0 25%, #fce4ec 50%, #f3e5f5 75%, #e0f2f1 87.5%, #e3f2fd 100%)',
                borderRadius: 2,
              }}>
                {[
                  { name: 'L6 经济安全池', icon: <MoneyIcon />, color: '#1565c0', desc: 'Stake/Slashing/赔付兜底 $50K/月' },
                  { name: 'L5 TEE密钥隔离', icon: <FingerprintIcon />, color: '#6a1b9a', desc: '硬件级私钥隔离 + 助记词导出' },
                  { name: 'L4 人机回环HITL', icon: <VerifiedUserIcon />, color: '#c62828', desc: '异常交易强制2FA + 带外认证' },
                  { name: 'L3 三重门控管线', icon: <ShieldIcon />, color: '#ef6c00', desc: '模拟 → 威胁扫描 → MEV防护' },
                  { name: 'L2 策略沙箱(Guard/Beast)', icon: <SecurityIcon />, color: '#2e7d32', desc: '日限额/白名单/时间窗口' },
                  { name: 'L1 Agent身份(DID+PoH)', icon: <LockIcon />, color: '#37474f', desc: 'DID注册/能力声明/PoH验证' },
                ].map((layer, i) => (
                  <Paper key={i}
                    elevation={0}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 2,
                      p: 1.5,
                      pl: 3 - i * 0.3, // 层叠效果
                      backgroundColor: `${layer.color}15`,
                      borderLeft: `4px solid ${layer.color}`,
                      borderRadius: 1,
                    }}
                  >
                    <Box sx={{ color: layer.color }}>{layer.icon}</Box>
                    <Box flex={1}>
                      <Typography variant="subtitle2" fontWeight="bold">{layer.name}</Typography>
                      <Typography variant="caption" color="text.secondary">{layer.desc}</Typography>
                    </Box>
                    <Chip label={`ACTIVE`} size="small" color="success" />
                  </Paper>
                ))}
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );

  // ====================================================================
  // Tab 2: Agent管理
  // ====================================================================
  const renderAgentManagement = () => (
    <Box>
      <Typography variant="h5" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <LockIcon color="primary" /> Agent 身份管理
      </Typography>

      {/* 注册新Agent表单 */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>注册新Agent</Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={4}>
              <TextField label="显示名称" size="small" fullWidth defaultValue="MyTradingBot" />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField select label="类型" size="small" fullWidth defaultValue="trading_bot">
                <MenuItem value="trading_bot">交易机器人</MenuItem>
                <MenuItem value="yield_optimizer">收益优化器</MenuItem>
                <MenuItem value="payment_processor">支付处理器</MenuItem>
                <MenuItem value="governance_voter">治理投票者</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} sm={4}>
              <FormControlLabel control={<Switch defaultChecked />} label="Guard Mode（默认严格）" />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField label="日消费上限" type="number" size="small" fullWidth defaultValue="10000" InputProps={{ endAdornment: '$' }} />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField label="单笔上限" type="number" size="small" fullWidth defaultValue="1000" InputProps={{ endAdornment: '$' }} />
            </Grid>
            <Grid item xs={12} sm={4}>
              <Button variant="contained" startIcon={<SendIcon />} onClick={() => alert('Agent注册功能需要后端连接')}>
                注册Agent
              </Button>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Agent列表 */}
      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>名称</TableCell>
              <TableCell>类型</TableCell>
              <TableCell>DID</TableCell>
              <TableCell>信任分</TableCell>
              <TableCell>模式</TableCell>
              <TableCell>状态</TableCell>
              <TableCell>操作数</TableCell>
              <TableCell>操作</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {agents.length === 0 ? (
              <TableRow><TableCell colSpan={8} align="center" sx={{ py: 4 }}>暂无已注册的Agent。使用上方表单注册第一个。</TableCell></TableRow>
            ) : agents.map((agent, i) => (
              <TableRow key={i}>
                <TableCell>{agent.displayName}</TableCell>
                <TableCell>{agent.agentType}</TableCell>
                <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>{agent.did.substring(0, 16)}...</TableCell>
                <TableCell>
                  <LinearProgress variant="determinate" value={agent.trustScore * 100} sx={{ width: 60 }} />
                </TableCell>
                <TableCell>
                  <Chip label={agent.mode === 'guard' ? 'GUARD' : 'BEAST'} size="small" color={getModeColor(agent.mode)} />
                </TableCell>
                <TableCell>
                  <Chip
                    label={agent.status.toUpperCase()}
                    size="small"
                    color={agent.status === 'active' ? 'success' : agent.status === 'frozen' ? 'error' : 'default'}
                  />
                </TableCell>
                <TableCell>{agent.totalOps}</TableCell>
                <TableCell>
                  <Tooltip title="切换模式"><IconButton size="small"><SwapHorizIcon /></IconButton></Tooltip>
                  <Tooltip title="冻结"><IconButton size="small" color="error"><BlockIcon /></IconButton></Tooltip>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );

  // ====================================================================
  // Tab 3: 交易门控监控
  // ====================================================================
  const renderGateMonitor = () => (
    <Box>
      <Typography variant="h5" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <ShieldIcon color="primary" /> 交易门控管线监控
      </Typography>

      <Grid container spacing={3}>
        {/* 门控统计 */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>三重审核统计</Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {[
                  { label: '模拟执行(Simulation)', run: gateStats?.stageStats?.simulation?.run || 0, fail: gateStats?.stageStats?.simulation?.failed || 0, color: '#1976d2' },
                  { label: '威胁扫描(Threat Scan)', run: gateStats?.stageStats?.threatScan?.run || 0, flag: gateStats?.stageStats?.threatScan?.flagged || 0, color: '#ed6c02' },
                  { label: 'MEV防护(MEV Protect)', run: gateStats?.stageStats?.mevProtection?.run || 0, risks: gateStats?.stageStats?.mevProtection?.risksDetected || 0, color: '#9c27b0' },
                ].map((s, i) => (
                  <Box key={i}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                      <Typography variant="body2">{s.label}</Typography>
                      <Typography variant="caption">
                        运行: {s.run} | 异常: {(s.fail ?? s.flag ?? s.risks ?? 0)}
                      </Typography>
                    </Box>
                    <LinearProgress
                      variant="determinate"
                      value={(s.run > 0 ? Math.min(100, ((s.fail ?? s.flag ?? s.risks ?? 0) / s.run) * 100) : 0)}
                      sx={{ height: 8, borderRadius: 4 }}
                    />
                  </Box>
                ))}
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* 综合通过率 */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>综合安全态势</Typography>
              <Box sx={{ textAlign: 'center', py: 3 }}>
                <Typography variant="h2" color={getGateStats && gateStats.passRate >= 0.95 ? 'success.main' : gateStats.passRate >= 0.8 ? 'warning.main' : 'error.main'}>
                  {(gateStats ? (gateStats.passRate * 100).toFixed(1) : 0)}%
                </Typography>
                <Typography variant="body2" color="text.secondary">整体通过率</Typography>
                <Typography variant="caption" color="text.secondary">
                  总运行: {gateStats?.totalPipelinesRun || 0} |
                  通过: {gateStats?.passedCount || 0} |
                  拒绝: {gateStats?.rejectedCount || 0}
                </Typography>
              </Box>
              <Alert severity={getGateStats && gateStats.passRate >= 0.9 ? 'success' : 'warning'} sx={{ mt: 2 }}>
                {getGateStats && gateStats.passRate >= 0.99
                  ? '安全状态优秀 — 所有请求均通过门控检查'
                  : getGateStats && gateStats.passRate >= 0.9
                  ? '安全状态良好 — 少量请求被拦截'
                  : '注意：有较多请求被门控拒绝，建议检查策略配置'}
              </Alert>
            </CardContent>
          </Card>
        </Grid>

        {/* 门控流程示意 */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>串联安全门控流程</Typography>
              <Box sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 1,
                flexWrap: 'wrap',
                p: 2,
                backgroundColor: '#fafafa',
                borderRadius: 2,
              }}>
                {['Agent请求', '→', 'L2策略评估', '→', 'L3-1 模拟执行', '→', 'L3-2 威胁扫描', '→', 'L3-3 MEV防护', '→', '通过?', '→(是)', '→ L4-HITL?', '→(否)', '→', '✅ 执行'].map((step, i) =>
                  step.startsWith('→') ? (
                    <Typography key={i} color="text.secondary">{step}</Typography>
                  ) : step.startsWith('L') ? (
                    <Chip key={i} label={step} size="small" color="primary" variant="outlined" />
                  ) : (
                    <Chip key={i} label={step} size="small" />
                  )
                )}
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );

  // ====================================================================
  // Tab 4: HITL 审批队列
  // ====================================================================
  const renderHITLQueue = () => (
    <Box>
      <Typography variant="h5" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <VerifiedUserIcon color="primary" /> 人机回环(HITL) 审批队列
      </Typography>

      <Alert severity="info" sx={{ mb: 2 }}>
        当AI Agent的操作触发高风险条件或Guard Mode时，系统会自动发起HITL请求，需要您手动确认或拒绝。
      </Alert>

      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>请求ID</TableCell>
              <TableCell>标题</TableCell>
              <TableCell>金额</TableCell>
              <TableCell>风险等级</TableCell>
              <TableCell>状态</TableCell>
              <TableCell>创建时间</TableCell>
              <TableCell>过期时间</TableCell>
              <TableCell>操作</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {hitlRequests.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} align="center" sx={{ py: 4 }}>
                  当前无待处理的HITL请求。
                  <br />
                  <Typography variant="caption" color="text.secondary">
                    当Agent提交超出策略范围的操作时，请求将在此处显示。
                  </Typography>
                </TableCell>
              </TableRow>
            ) : hitlRequests.map((req, i) => (
              <TableRow key={i}>
                <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.72rem' }}>{req.requestId.substring(0, 16)}...</TableCell>
                <TableCell>{req.title}</TableCell>
                <TableCell>{req.amount}</TableCell>
                <TableCell>
                  <Chip
                    label={req.riskLevel}
                    size="small"
                    color={req.riskLevel === 'LOW' ? 'success' : req.riskLevel === 'MEDIUM' ? 'info' : req.riskLevel === 'HIGH' ? 'warning' : 'error'}
                  />
                </TableCell>
                <TableCell>
                  <Chip
                    label={req.status.toUpperCase()}
                    size="small"
                    color={req.status === 'pending' ? 'warning' : req.status === 'approved' ? 'success' : 'default'}
                    variant={req.status === 'pending' ? 'filled' : 'outlined'}
                  />
                </TableCell>
                <TableCell>--:--:--</TableCell>
                <TableCell>--:--:--</TableCell>
                <TableCell>
                  {req.status === 'pending' && (
                    <>
                      <Button size="small" color="success" variant="contained" startIcon={<CheckCircleIcon />}>批准</Button>
                      <Button size="small" color="error" variant="outlined" startIcon={<ErrorIcon />} sx={{ ml: 1 }}>拒绝</Button>
                    </>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );

  // ====================================================================
  // Tab 5: TEE 密钥管理
  // ====================================================================
  const renderTEEKeyManagement = () => (
    <Box>
      <Typography variant="h5" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <FingerprintIcon color="primary" /> TEE 密钥管理器
      </Typography>

      <Grid container spacing={3}>
        {/* 密钥统计 */}
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6">密钥概览</Typography>
              <Box sx={{ mt: 2 }}>
                <Typography variant="body2">总密钥数: <b>{systemState?.teeKeyStats.totalKeys || 0}</b></Typography>
                <Typography variant="body2">活跃密钥: <b>{systemState?.teeKeyStats.activeKeys || 0}</b></Typography>
                <Typography variant="body2">已导出: <b>{systemState?.teeKeyStats.exportedKeys || 0}</b></Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* TEE安全说明 */}
        <Grid item xs={12} md={8}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>TEE硬件隔离安全模型</Typography>
              <Alert severity="success" icon={<SecurityIcon />}>
                私钥存储于可信执行环境(TEE)中——即使系统管理员也无法获取您的私钥。
              </Alert>
              <Box sx={{ mt: 2 }}>
                <Typography variant="subtitle2" gutterBottom>核心安全特性：</Typography>
                <ul style={{ margin: 0, paddingLeft: '1.5rem' }}>
                  <li><strong>非托管:</strong> 您拥有助记词和完全主权</li>
                  <li><strong>TEE隔离:</strong> 密钥生成、签名均在硬件隔离区内完成</li>
                  <li><strong>证明机制:</strong> 每次操作附带TEE Attestation证明</li>
                  <li><strong>可审计:</strong> 所有密钥操作记录在链上存证</li>
                </ul>
              </Box>
              <Button variant="outlined" color="secondary" sx={{ mt: 2 }} startIcon={<SendIcon />}>
                发起助记词导出
              </Button>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );

  // ====================================================================
  // Tab 6: 经济安全池
  // ====================================================================
  const renderEconomicPool = () => (
    <Box>
      <Typography variant="h5" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <MoneyIcon color="primary" /> 经济安全池
      </Typography>

      <Grid container spacing={3}>
        {/* 赔付计划 */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>Transaction Protection 计划</Typography>
              <Box sx={{ textAlign: 'center', py: 2 }}>
                <Typography variant="h3" color="primary" fontWeight="bold">$10,000<span style={{ fontSize: '1rem' }}>/月</Typography>
                <Typography variant="body2" color="text.secondary">最高赔付额度</Typography>
              </Box>
              <Alert severity="info" sx={{ mt: 2 }}>
                <Typography variant="body2">
                  凡经ASG门控管线判定为&quot;安全&quot;的交易，
                  若仍造成损失，最高可获得$10,000/月的赔付保障。
                  类似MetaMask Transaction Protection计划。
                </Typography>
              </Alert>
            </CardContent>
          </Card>
        </Grid>

        {/* 质押与Slashing */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>Stake / Slashing 机制</Typography>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow><TableCell>违规类型</TableCell><TableCell>罚没比例</TableCell></TableRow>
                  </TableHead>
                  <TableBody>
                    {[
                      ['隐私泄露(Privacy Breach)', '50%'],
                      ['策略违反(Policy Violation)', '30%'],
                      ['欺诈(Fraudulent Activity)', '100%（全部没收）'],
                      ['共谋攻击(Collusion)', '70%'],
                      ['可用性故障(Availability)', '20%'],
                    ].map(([reason, ratio], i) => (
                      <TableRow key={i}>
                        <TableCell>{reason}</TableCell>
                        <TableCell>
                          <LinearProgress variant="determinate" value={parseInt(ratio)} color="error" sx={{ width: 80 }} />
                          <Typography variant="caption">{ratio}</Typography>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
              <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                举报人奖励：罚没金额 × 10%
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        {/* 赔付申请 */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>赔付申请流程</Typography>
              <Box sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                flexWrap: 'wrap',
                p: 2,
                backgroundColor: '#fff8e1',
                borderRadius: 2,
              }}>
                {['提交申请+证据', '→', '自动验证门控结果', '→', '多签委员会审核', '→', '计算赔付额(三重上限)', '→', '链上转账'].map((step, i) =>
                  typeof step === 'string' && step.includes('→') ? (
                    <Typography key={i}>{step}</Typography>
                  ) : (
                    <Chip key={i} label={step} size="small" color={i === 0 ? 'primary' : undefined} />
                  )
                )}
              </Box>
              <Typography variant="caption" color="text.secondary">
                三重赔付上限：min(月预算剩余, 声称损失额, 关联质押×80%)
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );

  // ====== 缺失图标兼容 ======
  const SwapHorizIcon = () => null;

  return (
    <Box sx={{ p: { xs: 1, md: 3 } }}>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="scrollable" scrollButtons="auto">
        <Tab icon={<DashboardIcon />} label="系统总览" />
        <Tab icon={<LockIcon />} label="Agent管理" />
        <Tab icon={<ShieldIcon />} label="交易门控" />
        <Tab icon={<VerifiedUserIcon />} label="HITL审批" />
        <Tab icon={<FingerprintIcon />} label="TEE密钥" />
        <Tab icon={<MoneyIcon />} label="经济安全池" />
      </Tabs>

      {loading && tab === 0 ? (
        <Box sx={{ textAlign: 'center', py: 4 }}>
          <Typography color="text.secondary">加载中...</Typography>
        </Box>
      ) : (
        <Box sx={{ mt: 2 }}>
          {[
            renderOverview,
            renderAgentManagement,
            renderGateMonitor,
            renderHITLQueue,
            renderTEEKeyManagement,
            renderEconomicPool,
          ][tab]()}
        </Box>
      )}
    </Box>
  );
}
