/**
 * PPCL Dashboard — 隐私保护共识层控制台 (V16.0)
 *
 * 5个Tab：
 * 1. 📊 透明性债务仪表盘 — 四类成本可视化+Φ-度量雷达图
 * 2. 🔐 加密记录浏览器 — 记录列表/字段访问级别/完整性验证
 * 3. 👁️ View Key 管理器 — 颁发/使用/撤销View Key + 披露日志
 * 4. 🛡️ ZK 合规验证器 — 资金来源证明/制裁筛查/旅行规则
 * 5. ⚙️ 三层健康报告 — L1/L2/L3状态+系统配置
 */

import React, { useState, useCallback } from 'react';
import {
  Box,
  Tabs,
  Tab,
  Paper,
  Typography,
  Grid,
  Card,
  CardContent,
  LinearProgress,
  Chip,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Switch,
  FormControlLabel,
  Alert,
  Divider,
  alpha,
} from '@mui/material';
import SecurityIcon from '@mui/icons-material/Security';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import VerifiedUserIcon from '@mui/icons-material/VerifiedUser';
import AssessmentIcon from '@mui/icons-material/Assessment';
import SettingsIcon from '@mui/icons-material/Settings';

// ============================================================================
// 类型定义
// ============================================================================

interface DebtMetrics {
  totalTransparencyDebt: number;
  privacyImprovementPotential: number;
  commercialGameCost: { score: number; exposedSupplierNetwork: boolean; exposedCashFlowPattern: boolean; estimatedIntelLeakage: number };
  complianceGovernanceCost: { score: number; dataLeakRiskLevel: string; travelRuleGap: boolean };
  securityRiskCost: { score: number; personalSafetyRisk: string };
  designCost: { score: number; boundaryClarity: number };
}

interface EncryptedRecord {
  recordId: string;
  recordType: string;
  ownerHash: string;
  merkleCommitment: string;
  fieldCount: number;
  createdAt: string;
}

interface ViewKeyInfo {
  keyId: string;
  targetRecordId: string;
  grantedTo: string;
  status: string;
  purpose: string;
  validUntil: string;
}

interface ComplianceResult {
  requestId: string;
  overallPassed: boolean;
  checks: Array<{ type: string; passed: boolean; proofId?: string }>;
}

// ============================================================================
// 主组件
// ============================================================================

export default function PPLCDashboard() {
  const [activeTab, setActiveTab] = useState(0);

  // 模拟数据（实际应从API获取）
  const [debtMetrics, setDebtMetrics] = useState<DebtMetrics>({
    totalTransparencyDebt: 0.58,
    privacyImprovementPotential: 0.68,
    commercialGameCost: { score: 0.62, exposedSupplierNetwork: true, exposedCashFlowPattern: true, estimatedIntelLeakage: 0.65 },
    complianceGovernanceCost: { score: 0.45, dataLeakRiskLevel: 'MEDIUM', travelRuleGap: false },
    securityRiskCost: { score: 0.55, personalSafetyRisk: 'MEDIUM' },
    designCost: { score: 0.38, boundaryClarity: 0.75 },
  });

  const [records] = useState<EncryptedRecord[]>([
    { recordId: 'ppcl-tx-001', recordType: 'transfer', ownerHash: '0xabc1...f3d4', merkleCommitment: 'sha256:a1b2c3...', fieldCount: 5, createdAt: '2026-06-04T10:00:00Z' },
    { recordId: 'ppcl-tx-002', recordType: 'payment', ownerHash: '0xdef5...6g7h', merkleCommitment: 'sha256:d4e5f6...', fieldCount: 4, createdAt: '2026-06-04T11:30:00Z' },
    { recordId: 'ppcl-tx-003', recordType: 'salary', ownerHash: '0xghi8...9ijk', merkleCommitment: 'sha256:g7h8i9...', fieldCount: 6, createdAt: '2026-06-04T14:00:00Z' },
  ]);

  const [viewKeys] = useState<ViewKeyInfo[]>([
    { keyId: 'vk-a1b2c3', targetRecordId: 'ppcl-tx-001', grantedTo: 'auditor@firm.com', status: 'ACTIVE', purpose: 'AUDIT', validUntil: '2026-07-04' },
    { keyId: 'vk-d4e5f6', targetRecordId: '*', grantedTo: 'regulator@gov.org', status: 'ACTIVE', purpose: 'REGULATORY', validUntil: '2026-12-31' },
    { keyId: 'vk-g7h8i9', targetRecordId: 'ppcl-tx-002', grantedTo: 'vendor@partner.com', status: 'REVOKED', purpose: 'COUNTERPARTY', validUntil: '' },
  ]);

  // ============================================================================
  // Tab 1: 透明性债务仪表盘
  // ============================================================================

  const renderDebtDashboard = () => (
    <Box>
      <Typography variant="h6" gutterBottom>📊 透明性债务仪表盘 (Transparency Debt Dashboard)</Typography>
      <Alert severity="info" sx={{ mb: 2 }}>
        基于《稳定币需要隐身》(PANews) 四类成本模型 × V15.0 Φ度量体系的量化分析
      </Alert>

      {/* 总分卡片 */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} md={3}>
          <Card sx={{ bgcolor: theme => debtMetrics.totalTransparencyDebt > 0.7 ? alpha(theme.palette.error.light, 0.3)
            : debtMetrics.totalTransparencyDebt > 0.4 ? alpha(theme.palette.warning.light, 0.3)
            : alpha(theme.palette.success.light, 0.3), borderLeft: `4px solid` }}>
            <CardContent>
              <Typography variant="overline" color="text.secondary">总透明性债务</Typography>
              <Typography variant="h3" fontWeight="bold">
                {(debtMetrics.totalTransparencyDebt * 100).toFixed(1)}%
              </Typography>
              <LinearProgress
                variant="determinate"
                value={debtMetrics.totalTransparencyDebt * 100}
                color={debtMetrics.totalTransparencyDebt > 0.7 ? 'error' : debtMetrics.totalTransparencyDebt > 0.4 ? 'warning' : 'success'}
                sx={{ mt: 1 }}
              />
              <Typography variant="caption" color="text.secondary">0=无债务 | 1=最大暴露</Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={3}>
          <Card sx={{ bgcolor: theme => alpha(theme.palette.info.light, 0.2) }}>
            <CardContent>
              <Typography variant="overline" color="text.secondary">PPCL改善潜力</Typography>
              <Typography variant="h3" fontWeight="bold" color="info.main">
                {(debtMetrics.privacyImprovementPotential * 100).toFixed(1)}%
              </Typography>
              <LinearProgress variant="determinate" value={debtMetrics.privacyImprovementPotential * 100} color="info" sx={{ mt: 1 }} />
              <Typography variant="caption" color="text.secondary">部署PPCL后预估降低</Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography variant="overline" color="text.secondary">商业博弈风险</Typography>
              <Typography variant="h4" fontWeight="bold" color={debtMetrics.commercialGameCost.score > 0.5 ? 'error.main' : 'success.main'}>
                {(debtMetrics.commercialGameCost.score * 100).toFixed(0)}%
              </Typography>
              <Box sx={{ mt: 1 }}>
                {debtMetrics.commercialGameCost.exposedSupplierNetwork && <Chip label="供应商网络可推断" size="small" color="warning" sx={{ mr: 0.5 }} />}
                {debtMetrics.commercialGameCost.exposedCashFlowPattern && <Chip label="现金流可推断" size="small" color="error" />}
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography variant="overline" color="text.secondary">安全风险</Typography>
              <Typography variant="h4" fontWeight="bold" color={debtMetrics.securityRiskCost.score > 0.5 ? 'error.main' : 'warning.main'}>
                {debtMetrics.securityRiskCost.personalSafetyRisk}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                得分: {(debtMetrics.securityRiskCost.score * 100).toFixed(0)}%
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* 四类成本详细表格 */}
      <Typography variant="subtitle1" gutterBottom>四类透明性债务明细</Typography>
      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow sx={{ bgcolor: '#1a237e', '& .MuiTableCell-head': { color: '#fff' } }}>
              <TableCell>成本类型</TableCell>
              <TableCell align="center">得分</TableCell>
              <TableCell>核心指标</TableCell>
              <TableCell>状态</TableCell>
              <TableCell align="center">PPCL缓解策略</TableCell>
              <TableCell align="center">预估降低</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            <TableRow hover>
              <TableCell><strong>商业博弈成本</strong></TableCell>
              <TableCell align="center"><LinearProgress variant="determinate" value={debtMetrics.commercialGameCost.score * 100} sx={{ width: 80 }} /></TableCell>
              <TableCell>情报泄露: {(debtMetrics.commercialGameCost.estimatedIntelLeakage * 100).toFixed(0)}%</TableCell>
              <TableCell><Chip label={debtMetrics.commercialGameCost.score > 0.5 ? '高危' : '可控'} color={debtMetrics.commercialGameCost.score > 0.5 ? 'error' : 'success'} size="small" /></TableCell>
              <TableCell align="center">加密记录(L1)</TableCell>
              <TableCell align="center"><Chip label="-85%" color="success" size="small" /></TableCell>
            </TableRow>
            <TableRow hover>
              <TableCell><strong>合规治理成本</strong></TableCell>
              <TableCell align="center"><LinearProgress variant="determinate" value={debtMetrics.complianceGovernanceCost.score * 100} sx={{ width: 80 }} /></TableCell>
              <TableCell>风险等级: {debtMetrics.complianceGovernanceCost.dataLeakRiskLevel}</TableCell>
              <TableCell><Chip label={debtMetrics.complianceGovernanceCost.travelRuleGap ? '有缺口' : '完整'} color={debtMetrics.complianceGovernanceCost.travelRuleGap ? 'warning' : 'success'} size="small" /></TableCell>
              <TableCell align="center">ZK合规(L3)</TableCell>
              <TableCell align="center"><Chip label="-60%" color="success" size="small" /></TableCell>
            </TableRow>
            <TableRow hover>
              <TableCell><strong>安全人身风险</strong></TableCell>
              <TableCell align="center"><LinearProgress variant="determinate" value={debtMetrics.securityRiskCost.score * 100} sx={{ width: 80 }} /></TableCell>
              <TableCell>安全级别: {debtMetrics.securityRiskCost.personalSafetyRisk}</TableCell>
              <TableCell><Chip label={debtMetrics.securityRiskCost.score > 0.5 ? '需关注' : '正常'} color={debtMetrics.securityRiskCost.score > 0.5 ? 'warning' : 'success'} size="small" /></TableCell>
              <TableCell align="center">View Key(L2)</TableCell>
              <TableCell align="center"><Chip label="-70%" color="success" size="small" /></TableCell>
            </TableRow>
            <TableRow hover>
              <TableCell><strong>制度设计成本</strong></TableCell>
              <TableCell align="center"><LinearProgress variant="determinate" value={debtMetrics.designCost.score * 100} sx={{ width: 80 }} /></TableCell>
              <TableCell>边界清晰度: {(debtMetrics.designCost.boundaryClarity * 100).toFixed(0)}%</TableCell>
              <TableCell><Chip label={debtMetrics.designCost.boundaryClarity > 0.7 ? '良好' : '模糊'} color={debtMetrics.designCost.boundaryClarity > 0.7 ? 'success' : 'warning'} size="small" /></TableCell>
              <TableCell align="center">分级披露(L2)</TableCell>
              <TableCell align="center"><Chip label="-50%" color="info" size="small" /></TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );

  // ============================================================================
  // Tab 2: 加密记录浏览器
  // ============================================================================

  const [selectedRecord, setSelectedRecord] = useState<string | null>(null);
  const [newRecordType, setNewRecordType] = useState('transfer');

  const renderRecordBrowser = () => (
    <Box>
      <Typography variant="h6" gutterBottom>🔐 加密记录浏览器 (Encrypted Record Browser)</Typography>
      <Alert severity="success" sx={{ mb: 2 }}>
        L1 默认保密：所有记录以加密形式存储。公开信息仅包含哈希承诺值(Merkle Commitment)，明文永不持久化。
      </Alert>

      {/* 创建新记录 */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Typography variant="subtitle2" gutterBottom>创建加密记录</Typography>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} sm={3}>
            <FormControl fullWidth size="small">
              <InputLabel>记录类型</InputLabel>
              <Select value={newRecordType} label="记录类型" onChange={e => setNewRecordType(e.target.value)}>
                <MenuItem value="transfer">转账 (Transfer)</MenuItem>
                <MenuItem value="payment">付款 (Payment)</MenuItem>
                <MenuItem value="salary">工资 (Salary)</MenuItem>
                <MenuItem value="settlement">结算 (Settlement)</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={3}>
            <TextField label="字段 (JSON)" size="small" fullWidth defaultValue='{"amount":50000,"to":"vendor-001"}' />
          </Grid>
          <Grid item xs={12} sm={3}>
            <FormControlLabel control={<Switch defaultChecked />} label="默认加密" />
          </Grid>
          <Grid item xs={12} sm={3}>
            <Button variant="contained" color="primary" fullWidth startIcon={<SecurityIcon />}>创建加密记录</Button>
          </Grid>
        </Grid>
      </Paper>

      {/* 记录列表 */}
      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow sx={{ bgcolor: '#263238', '& .MuiTableCell-head': { color: '#fff' } }}>
              <TableCell>记录ID</TableCell>
              <TableCell>类型</TableCell>
              <TableCell>所有者</TableCell>
              <TableCell>Merkle Commitment</TableCell>
              <TableCell align="center">字段数</TableCell>
              <TableCell>创建时间</TableCell>
              <TableCell align="center">操作</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {records.map((r) => (
              <TableRow
                key={r.recordId}
                hover
                selected={selectedRecord === r.recordId}
                onClick={() => setSelectedRecord(selectedRecord === r.recordId ? null : r.recordId)}
                sx={{ cursor: 'pointer' }}
              >
                <TableCell><code>{r.recordId}</code></TableCell>
                <TableCell><Chip label={r.recordType} size="small" color="primary" /></TableCell>
                <TableCell><code>{r.ownerHash}</code></TableCell>
                <TableCell><code style={{ fontSize: '0.75rem' }}>{r.merkleCommitment}</code></TableCell>
                <TableCell align="center">{r.fieldCount}</TableCell>
                <TableCell>{r.createdAt}</TableCell>
                <TableCell align="center">
                  <Button size="small" onClick={(e) => { e.stopPropagation(); }}>验证</Button>
                  <Button size="small" color="secondary" onClick={(e) => { e.stopPropagation(); }}>详情</Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* 字段访问级别概览（选中时显示） */}
      {selectedRecord && (
        <Paper sx={{ p: 2, mt: 2, bgcolor: theme => alpha(theme.palette.primary.main, 0.05) }}>
          <Typography variant="subtitle2" gutterBottom>
            字段访问级别概览 — {selectedRecord}
          </Typography>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>字段名</TableCell>
                  <TableCell align="center">访问级别</TableCell>
                  <TableCell align="center">加密方式</TableCell>
                  <TableCell>说明</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {['amount', 'recipient', 'memo', 'timestamp', 'sender'].map((field, i) => (
                  <TableRow key={field}>
                    <TableCell><code>{field}</code></TableCell>
                    <TableCell align="center">
                      <Chip
                        label={[undefined, 'PUBLIC', 'VIEW_KEY', 'OWNER', 'SYSTEM'][i % 5]}
                        size="small"
                        color={['default', 'success', 'info', 'warning', 'error'][i % 5] as 'success' | 'info' | 'warning' | 'error'}
                      />
                    </TableCell>
                    <TableCell align="center">AES-256-GCM</TableCell>
                    <TableCell variant="body2" color="text.secondary">
                      {i < 2 ? '审计方可解密' : i < 4 ? '仅所有者' : '系统内部'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}
    </Box>
  );

  // ============================================================================
  // Tab 3: View Key 管理器
  // ============================================================================

  const [vkPurpose, setVkPurpose] = useState('AUDIT');
  const [grantTo, setGrantTo] = useState('');

  const renderViewKeyManager = () => (
    <Box>
      <Typography variant="h6" gutterBottom>👁️ View Key 管理器 (Selective Disclosure Manager)</Typography>
      <Alert severity="warning" sx={{ mb: 2 }}>
        L2 选择性披露：通过 View Key 实现最小化信息披露。类比 Aleo 的 view key + snarkOS v4 增强机制。
      </Alert>

      {/* 颁发新 View Key */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Typography variant="subtitle2" gutterBottom>颁发 View Key</Typography>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} sm={3}>
            <TextField label="目标记录ID (*=全部)" size="small" fullWidth defaultValue="*" />
          </Grid>
          <Grid item xs={12} sm={3}>
            <TextField label="授权给 (身份)" size="small" fullWidth value={grantTo} onChange={e => setGrantTo(e.target.value)} placeholder="auditor@firm.com" />
          </Grid>
          <Grid item xs={12} sm={2}>
            <FormControl fullWidth size="small">
              <InputLabel>用途</InputLabel>
              <Select value={vkPurpose} label="用途" onChange={e => setVkPurpose(e.target.value)}>
                <MenuItem value="AUDIT">审计</MenuItem>
                <MenuItem value="REGULATORY">监管</MenuItem>
                <MenuItem value="COUNTERPARTY">交易对手</MenuItem>
                <MenuItem value="RISK_CONTROL">风控</MenuItem>
                <MenuItem value="DISPUTE">争议解决</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={2}>
            <TextField label="有效天数" size="small" fullWidth type="number" defaultValue={30} />
          </Grid>
          <Grid item xs={12} sm={2}>
            <Button variant="contained" color="secondary" fullWidth startIcon={<VisibilityOffIcon />} disabled={!grantTo}>
              颁发
            </Button>
          </Grid>
        </Grid>
      </Paper>

      {/* 已颁发 View Key 列表 */}
      <Typography variant="subtitle2" gutterBottom>已颁发的 View Key ({viewKeys.length})</Typography>
      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow sx={{ bgcolor: '#4a148c', '& .MuiTableCell-head': { color: '#fff' } }}>
              <TableCell>Key ID</TableCell>
              <TableCell>目标记录</TableCell>
              <TableCell>授予对象</TableCell>
              <TableCell>用途</TableCell>
              <TableCell align="center">状态</TableCell>
              <TableCell>有效期至</TableCell>
              <TableCell align="center">操作</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {viewKeys.map((vk) => (
              <TableRow key={vk.keyId} hover>
                <TableCell><code>{vk.keyId}</code></TableCell>
                <TableCell><code>{vk.targetRecordId}</code></TableCell>
                <TableCell>{vk.grantedTo}</TableCell>
                <TableCell>
                  <Chip
                    label={vk.purpose}
                    size="small"
                    color={
                      vk.purpose === 'AUDIT' ? 'info'
                      : vk.purpose === 'REGULATORY' ? 'error'
                      : vk.purpose === 'COUNTERPARTY' ? 'success'
                      : 'default'
                    }
                  />
                </TableCell>
                <TableCell align="center">
                  <Chip
                    label={vk.status}
                    size="small"
                    color={vk.status === 'ACTIVE' ? 'success' : vk.status === 'REVOKED' ? 'error' : 'default'}
                    variant={vk.status === 'ACTIVE' ? 'filled' : 'outlined'}
                  />
                </TableCell>
                <TableCell>{vk.validUntil || '-'}</TableCell>
                <TableCell align="center">
                  {vk.status === 'ACTIVE' && (
                    <Button size="small" color="error">撤销</Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Divider sx={{ my: 2 }} />

      {/* 披露日志预览 */}
      <Typography variant="subtitle2" gutterBottom>📋 最近披露日志</Typography>
      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>时间</TableCell>
              <TableCell>View Key</TableCell>
              <TableCell>访问者</TableCell>
              <TableCell>目标记录</TableCell>
              <TableCell>用途</TableCell>
              <TableCell>ZK证明</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            <TableRow>
              <TableCell>2026-06-04 15:30</TableCell>
              <TableCell><code>vk-a1b2c3</code></TableCell>
              <TableCell>auditor@firm.com</TableCell>
              <TableCell><code>ppcl-tx-001</code></TableCell>
              <TableCell><Chip label="AUDIT" size="small" color="info" /></TableCell>
              <TableCell><Chip label="已验证 ✓" size="small" color="success" /></TableCell>
            </TableRow>
            <TableRow>
              <TableCell>2026-06-04 14:15</TableCell>
              <TableCell><code>vk-d4e5f6</code></TableCell>
              <TableCell>regulator@gov.org</TableCell>
              <TableCell><code>*</code> (全部)</TableCell>
              <TableCell><Chip label="REGULATORY" size="small" color="error" /></TableCell>
              <TableCell><Chip label="已验证 ✓" size="small" color="success" /></TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );

  // ============================================================================
  // Tab 4: ZK 合规验证器
  // ============================================================================

  const [entityId, setEntityId] = useState('');
  const [complianceResult, setComplianceResult] = useState<ComplianceResult | null>(null);

  const handleComplianceCheck = useCallback(() => {
    if (!entityId) return;
    // 模拟API调用
    setComplianceResult({
      requestId: `cc-${Date.now()}`,
      overallPassed: Math.random() > 0.2,
      checks: [
        { type: 'SANCTION', passed: true, proofId: 'zk-ss-xxx' },
        { type: 'AML', passed: Math.random() > 0.15 },
        { type: 'KYC', passed: true, proofId: 'zk-id-yyy' },
        { type: 'TRAVEL_RULE', passed: entityId.length > 10, proofId: 'zk-tr-zzz' },
      ],
    });
  }, [entityId]);

  const renderZKCompliance = () => (
    <Box>
      <Typography variant="h6" gutterBottom>🛡️ ZK 合规验证器 (Zero-Knowledge Compliance Verifier)</Typography>
      <Alert severity="info" sx={{ mb: 2 }}>
        L3 合规连接：基于 Privacy Pools 思路，在不暴露原始数据的前提下完成 AML/KYC/制裁筛查/旅行规则合规验证。
      </Alert>

      {/* 合规检查面板 */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Typography variant="subtitle2" gutterBottom>执行合规检查</Typography>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} sm={5}>
            <TextField
              label="实体ID / 地址 / 交易哈希"
              size="small"
              fullWidth
              value={entityId}
              onChange={e => setEntityId(e.target.value)}
              placeholder="输入待检查的实体标识..."
            />
          </Grid>
          <Grid item xs={12} sm={5}>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              {['SANCTION', 'AML', 'KYC', 'TRAVEL_RULE'].map(check => (
                <Chip key={check} label={check} size="small" color="primary" variant="outlined" />
              ))}
            </Box>
          </Grid>
          <Grid item xs={12} sm={2}>
            <Button
              variant="contained"
              color="success"
              fullWidth
              startIcon={<VerifiedUserIcon />}
              onClick={handleComplianceCheck}
              disabled={!entityId}
            >
              执行检查
            </Button>
          </Grid>
        </Grid>
      </Paper>

      {/* 结果展示 */}
      {complianceResult && (
        <Paper sx={{
          p: 2,
          mb: 3,
          bgcolor: theme => alpha(
            complianceResult.overallPassed ? theme.palette.success.light : theme.palette.error.light,
            0.15
          ),
          border: `2px solid ${complianceResult.overallPassed ? '#4caf50' : '#f44336'}`,
        }}>
          <Typography variant="subtitle2" gutterBottom>
            检查结果: {complianceResult.overallAllowed ? '✅ 全部通过' : '⚠️ 存在异常'}
            <Chip
              label={`Request: ${complianceResult.requestId.slice(-8)}`}
              size="small"
              sx={{ ml: 1 }}
              variant="outlined"
            />
          </Typography>

          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>检查项</TableCell>
                  <TableCell align="center">结果</TableCell>
                  <TableCell>ZK Proof</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {complianceResult.checks.map((check) => (
                  <TableRow key={check.type}>
                    <TableCell>
                      <strong>{check.type === 'SANCTION' ? '制裁名单筛查' :
                        check.type === 'AML' ? '反洗钱监测' :
                        check.type === 'KYC' ? 'KYC资质验证' :
                        '旅行规则'}</strong>
                    </TableCell>
                    <TableCell align="center">
                      <Chip
                        label={check.passed ? '✓ PASS' : '✗ FAIL'}
                        size="small"
                        color={check.passed ? 'success' : 'error'}
                      />
                    </TableCell>
                    <TableCell>
                      {check.proofId ? (
                        <code style={{ fontSize: '0.8rem' }}>{check.proofId}</code>
                      ) : (
                        <Typography variant="body2" color="text.secondary">—</Typography>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}

      {/* ZK 证明类型说明 */}
      <Typography variant="subtitle2" gutterBottom>支持的 ZK 证明类型</Typography>
      <Grid container spacing={1}>
        {[
          { type: 'FUNDS_ORIGIN', name: '资金来源清洁', desc: '证明资金不来自已知非法地址' },
          { type: 'SANCTION_SCREENING', name: '制裁名单不在列', desc: '证明实体不在OFAC/UN制裁名单中' },
          { type: 'IDENTITY_VERIFICATION', name: 'KYC资质', desc: '证明已完成KYC但不暴露PII' },
          { type: 'TRAVEL_RULE_COMPLIANCE', name: '旅行规则', desc: 'FATF旅行规则信息传递证明' },
          { type: 'THRESHOLD_ACCESS', name: '阈值访问', desc: '证明View Key使用在授权范围内' },
          { type: 'BALANCE_PROOF', name: '余额范围', desc: '证明余额≥X但不暴露精确值' },
        ].map(zk => (
          <Grid item xs={12} sm={6} md={4} key={zk.type}>
            <Card variant="outlined" sx={{ p: 1.5 }}>
              <Typography variant="caption" color="primary" fontWeight="bold">{zk.type}</Typography>
              <Typography variant="body2">{zk.name}</Typography>
              <Typography variant="caption" color="text.secondary">{zk.desc}</Typography>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  );

  // ============================================================================
  // Tab 5: 三层健康报告
  // ============================================================================

  const [encryptDefault, setEncryptDefault] = useState(true);

  const renderHealthReport = () => (
    <Box>
      <Typography variant="h6" gutterBottom>⚙️ 三层能力健康报告 (Three-Layer Health Report)</Typography>

      <Grid container spacing={2}>
        {/* L1 状态 */}
        <Grid item xs={12} md={4}>
          <Card sx={{
            height: '100%',
            borderTop: `4px solid #1976d2`,
            bgcolor: theme => alpha(theme.palette.primary.main, 0.05),
          }}>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                <Typography variant="subtitle1" fontWeight="bold">L1: 默认保密</Typography>
                <Chip label="ACTIVE" color="success" size="small" />
              </Box>
              <Typography variant="body2" color="text.secondary" paragraph>
                加密记录引擎 (RecordModelEngine)
              </Typography>
              <Divider sx={{ my: 1 }} />
              <Grid container spacing={1}>
                <Grid item xs={6}><Typography variant="caption">总记录数:</Typography></Grid>
                <Grid item xs={6}><Typography variant="caption" fontWeight="bold">{records.length}</Typography></Grid>
                <Grid item xs={6}><Typography variant="caption">默认加密:</Typography></Grid>
                <Grid item xs={6}>
                  <Switch checked={encryptDefault} onChange={e => setEncryptDefault(e.target.checked)} size="small" />
                </Grid>
                <Grid item xs={6}><Typography variant="caption">平均字段数:</Typography></Grid>
                <Grid item xs={6}><Typography variant="caption" fontWeight="bold">5.0</Typography></Grid>
                <Grid item xs={6}><Typography variant="caption">算法:</Typography></Grid>
                <Grid item xs={6}><Typography variant="caption" fontFamily="monospace">AES-256-GCM</Typography></Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        {/* L2 状态 */}
        <Grid item xs={12} md={4}>
          <Card sx={{
            height: '100%',
            borderTop: `4px solid #7b1fa2`,
            bgcolor: theme => alpha('#7b1fa2', 0.05),
          }}>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                <Typography variant="subtitle1" fontWeight="bold">L2: 选择性披露</Typography>
                <Chip label="ACTIVE" color="success" size="small" />
              </Box>
              <Typography variant="body2" color="text.secondary" paragraph>
                视图密钥管理器 (ViewKeyManager)
              </Typography>
              <Divider sx={{ my: 1 }} />
              <Grid container spacing={1}>
                <Grid item xs={6}><Typography variant="caption">活跃Key:</Typography></Grid>
                <Grid item xs={6}><Typography variant="caption" fontWeight="bold" color="success.main">{viewKeys.filter(k => k.status === 'ACTIVE').length}</Typography></Grid>
                <Grid item xs={6}><Typography variant="caption">已撤销:</Typography></Grid>
                <Grid item xs={6}><Typography variant="caption" fontWeight="bold" color="error">{viewKeys.filter(k => k.status === 'REVOKED').length}</Typography></Grid>
                <Grid item xs={6}><Typography variant="caption">披露日志:</Typography></Grid>
                <Grid item xs={6}><Typography variant="caption" fontWeight="bold">128 条</Typography></Grid>
                <Grid item xs={6}><Typography variant="caption">撤销就绪:</Typography></Grid>
                <Grid item xs={6}><Chip label="YES" color="success" size="small" /></Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        {/* L3 状态 */}
        <Grid item xs={12} md={4}>
          <Card sx={{
            height: '100%',
            borderTop: `4px solid #c62828`,
            bgcolor: theme => alpha('#c62828', 0.05),
          }}>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                <Typography variant="subtitle1" fontWeight="bold">L3: 合规连接</Typography>
                <Chip label="ACTIVE" color="success" size="small" />
              </Box>
              <Typography variant="body2" color="text.secondary" paragraph>
                零知识合规引擎 (ZKComplianceEngine)
              </Typography>
              <Divider sx={{ my: 1 }} />
              <Grid container spacing={1}>
                <Grid item xs={6}><Typography variant="caption">合规通过率:</Typography></Grid>
                <Grid item xs={6}><Typography variant="caption" fontWeight="bold" color="success.main">94.5%</Typography></Grid>
                <Grid item xs={6}><Typography variant="caption">ZK证明生成:</Typography></Grid>
                <Grid item xs={6}><Typography variant="caption" fontWeight="bold">1,247</Typography></Grid>
                <Grid item xs={6}><Typography variant="caption">数据源:</Typography></Grid>
                <Grid item xs={6}><Typography variant="caption" fontWeight="bold">2 个活跃</Typography></Grid>
                <Grid item xs={6}><Typography variant="caption">平均延迟:</Typography></Grid>
                <Grid item xs={6}><Typography variant="caption" fontWeight="bold">18ms</Typography></Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* 综合状态 */}
      <Paper sx={{ p: 2, mt: 3, bgcolor: theme => alpha(theme.palette.grey[100], 0.5) }}>
        <Typography variant="subtitle2" gutterBottom>V16.0 PPCL 系统概览</Typography>
        <Grid container spacing={2}>
          <Grid item xs={6} md={3}>
            <Typography variant="overline">版本</Typography>
            <Typography variant="h6" fontWeight="bold" color="primary">V16.0.0</Typography>
          </Grid>
          <Grid item xs={6} md={3}>
            <Typography variant="overline">当前债务分数</Typography>
            <Typography variant="h6" fontWeight="bold" color={debtMetrics.totalTransparencyDebt > 0.5 ? 'warning.main' : 'success.main'}>
              {(debtMetrics.totalTransparencyDebt * 100).toFixed(1)}%
            </Typography>
          </Grid>
          <Grid item xs={6} md={3}>
            <Typography variant="overline">改善潜力</Typography>
            <Typography variant="h6" fontWeight="bold" color="info.main">
              {(debtMetrics.privacyImprovementPotential * 100).toFixed(1)}%
            </Typography>
          </Grid>
          <Grid item xs={6} md={3}>
            <Typography variant="overline">建议</Typography>
            <Typography variant="body2" fontWeight="bold">
              {debtMetrics.totalTransparencyDebt > 0.6 ? '建议部署全套PPCL' : '持续监控优化'}
            </Typography>
          </Grid>
        </Grid>
      </Paper>
    </Box>
  );

  // ============================================================================
  // 主渲染
  // ============================================================================

  return (
    <Box sx={{ p: { xs: 1, md: 3 } }}>
      <Typography variant="h5" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <SecurityIcon color="primary" /> PPCL 隐私保护共识层 (V16.0)
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        基于《稳定币需要隐身》三层隐私模型 — L1:默认保密 → L2:选择性披露 → L3:合规连接
      </Typography>

      <Paper sx={{ mb: 2 }}>
        <Tabs
          value={activeTab}
          onChange={(_, v) => setActiveTab(v)}
          variant="scrollableButtons"
          scrollButtons="auto"
        >
          <Tab icon={<AssessmentIcon />} label="透明性债务仪表盘" id="tab-0" />
          <Tab icon={<SecurityIcon />} label="🔐 加密记录浏览器" id="tab-1" />
          <Tab icon={<VisibilityOffIcon />} label="👁️ View Key管理器" id="tab-2" />
          <Tab icon={<VerifiedUserIcon />} label="🛡️ ZK合规验证" id="tab-3" />
          <Tab icon={<SettingsIcon />} label="⚙️ 三层健康报告" id="tab-4" />
        </Tabs>
      </Paper>

      {/* Tab Panels */}
      {activeTab === 0 && renderDebtDashboard()}
      {activeTab === 1 && renderRecordBrowser()}
      {activeTab === 2 && renderViewKeyManager()}
      {activeTab === 3 && renderZKCompliance()}
      {activeTab === 4 && renderHealthReport()}
    </Box>
  );
}
