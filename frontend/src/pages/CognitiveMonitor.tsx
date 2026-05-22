/**
 * V6.0 AGI Cognitive Monitor Page
 * Real-time monitoring dashboard for AGI cognitive modules
 * 
 * Modules covered:
 * - M78 HoTT Reasoning Gateway
 * - M84 Liu Principle Phi Solver
 * - NIS Neural Phi Compressor
 * - Phi-402 Semantic Micropayment
 * - Phi-AP2 Semantic Authorization
 * - PhiAgent NFT Identity
 * - IIT 4.0 Consciousness Verifier
 * - Self-Referential Consensus
 * - Hex Dual Convolution Scheduler
 * - Bio-Phi Interface
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  Chip,
  LinearProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Tabs,
  Tab,
  IconButton,
  Tooltip,
  Badge,
  Alert,
  useTheme,
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  Psychology as CognitionIcon,
  Payment as PaymentIcon,
  VerifiedUser as IdentityIcon,
  Router as GatewayIcon,
  AutoGraph as SolverIcon,
  Compress as CompressorIcon,
  Biotech as BioIcon,
  Gavel as ConsensusIcon,
  Memory as FpgaIcon,
  TrendingUp as TrendIcon,
  Warning as WarningIcon,
  CheckCircle as SuccessIcon,
  Error as ErrorIcon,
  HourglassEmpty as PendingIcon,
} from '@mui/icons-material';

// ============ Types ============

interface HoTTGatewayStatus {
  decision: 'PRIORITY' | 'NORMAL' | 'THROTTLE' | 'REJECT';
  confidence: number;
  proofDepth: number;
  requestsTotal: number;
  accuracy: number;
  avgLatencyMs: number;
  isOnline: boolean;
}

interface LiuSolverStatus {
  phiPast: number;
  phiPresent: number;
  phiFuture: number;
  phiTotal: number;
  confidence: number;
  horizonWeights: { past: number; present: number; future: number };
  isOnline: boolean;
}

interface NISCompressorStatus {
  compressionRatio: number;
  inferenceLatencyMs: number;
  reconstructionError: number;
  inputDim: number;
  latentDim: number;
  mode: 'training' | 'inference' | 'idle';
  isOnline: boolean;
}

interface Phi402PaymentStatus {
  totalSettled: number;
  successRate: number;
  avgFee: number;
  phiFreeRate: number;    // % of requests with Phi >= 0.75 (free)
  premiumRate: number;    // % of requests with Phi < 0.4 (premium)
  pendingSettlements: number;
  isOnline: boolean;
}

interface PhiAgentStatus {
  totalAgents: number;
  avgReputation: number;
  pendingValidations: number;
  nftMinted: number;
  isOnline: boolean;
}

interface ConsensusStatus {
  currentThreshold: number;
  predictionAccuracy: number;
  selfCorrectionCount: number;
  isOnline: boolean;
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel({ children, value, index }: TabPanelProps) {
  return value === index ? <Box sx={{ p: 3 }}>{children}</Box> : null;
}

// ============ Mock Data Hook ============

function useV6MonitorData() {
  const [gateway, setGateway] = useState<HoTTGatewayStatus>({
    decision: 'PRIORITY', confidence: 0.97, proofDepth: 12,
    requestsTotal: 15847, accuracy: 0.973, avgLatencyMs: 4.2, isOnline: true,
  });
  const [solver, setSolver] = useState<LiuSolverStatus>({
    phiPast: 32.1, phiPresent: 45.8, phiFuture: 38.2, phiTotal: 116.1,
    confidence: 0.91, horizonWeights: { past: 0.30, present: 0.40, future: 0.30 }, isOnline: true,
  });
  const [compressor, setCompressor] = useState<NISCompressorStatus>({
    compressionRatio: 0.92, inferenceLatencyMs: 3.8, reconstructionError: 0.034,
    inputDim: 512, latentDim: 64, mode: 'inference', isOnline: true,
  });
  const [payment, setPayment] = useState<Phi402PaymentStatus>({
    totalSettled: 8923, successRate: 0.997, avgFee: 0.00042,
    phiFreeRate: 0.68, premiumRate: 0.07, pendingSettlements: 3, isOnline: true,
  });
  const [agent, setAgent] = useState<PhiAgentStatus>({
    totalAgents: 247, avgReputation: 72.4, pendingValidations: 12,
    nftMinted: 198, isOnline: true,
  });
  const [consensus, setConsensus] = useState<ConsensusStatus>({
    currentThreshold: 0.53, predictionAccuracy: 0.82,
    selfCorrectionCount: 47, isOnline: true,
  });

  const refresh = useCallback(() => {
    // Simulate data refresh with small random fluctuations
    setGateway(prev => ({
      ...prev,
      confidence: Math.min(1, Math.max(0.85, prev.confidence + (Math.random() - 0.5) * 0.02)),
      requestsTotal: prev.requestsTotal + Math.floor(Math.random() * 10),
      accuracy: Math.min(1, Math.max(0.90, prev.accuracy + (Math.random() - 0.5) * 0.005)),
      avgLatencyMs: Math.max(1, prev.avgLatencyMs + (Math.random() - 0.5) * 0.5),
    }));
    setSolver(prev => ({
      ...prev,
      phiPresent: Math.max(0, Math.min(100, prev.phiPresent + (Math.random() - 0.5) * 2)),
      phiFuture: Math.max(0, Math.min(100, prev.phiFuture + (Math.random() - 0.5) * 3)),
      phiTotal: prev.phiPast + prev.phiPresent + prev.phiFuture,
    }));
    setCompressor(prev => ({
      ...prev,
      inferenceLatencyMs: Math.max(1, prev.inferenceLatencyMs + (Math.random() - 0.5) * 0.3),
      reconstructionError: Math.max(0, Math.min(0.1, prev.reconstructionError + (Math.random() - 0.5) * 0.002)),
    }));
    setPayment(prev => ({
      ...prev,
      totalSettled: prev.totalSettled + Math.floor(Math.random() * 5),
      pendingSettlements: Math.max(0, prev.pendingSettlements + (Math.random() > 0.7 ? -1 : 1)),
    }));
  }, []);

  return { gateway, solver, compressor, payment, agent, consensus, refresh };
}

// ============ Sub-components ============

function StatusChip({ online }: { online: boolean }) {
  return (
    <Chip
      icon={online ? <SuccessIcon /> : <ErrorIcon />}
      label={online ? 'Online' : 'Offline'}
      color={online ? 'success' : 'error'}
      size="small"
      variant="outlined"
    />
  );
}

function PhiGauge({ value, max = 100, label }: { value: number; max?: number; label: string }) {
  const pct = Math.min(100, (value / max) * 100);
  const color = pct >= 75 ? 'success' : pct >= 40 ? 'warning' : 'error';
  return (
    <Box sx={{ mb: 1 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
        <Typography variant="caption" color="text.secondary">{label}</Typography>
        <Typography variant="caption" fontWeight="bold">{value.toFixed(1)}</Typography>
      </Box>
      <LinearProgress variant="determinate" value={pct} color={color} sx={{ height: 8, borderRadius: 4 }} />
    </Box>
  );
}

// ============ Main Component ============

export default function CognitiveMonitor() {
  const [tabValue, setTabValue] = useState(0);
  const { gateway, solver, compressor, payment, agent, consensus, refresh } = useV6MonitorData();

  useEffect(() => {
    const interval = setInterval(refresh, 3000);
    return () => clearInterval(interval);
  }, [refresh]);

  return (
    <Box sx={{ p: 2 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h4" fontWeight="bold">
            V6.0 AGI Cognitive Monitor
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Real-time monitoring for AGI cognitive modules + Agent economy settlement layer
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          <Chip label="API V6.0.0" color="primary" size="small" />
          <Chip label={`Φ-BFT: ${(consensus.currentThreshold * 100).toFixed(0)}%`} color="secondary" size="small" />
          <Tooltip title="Refresh data">
            <IconButton onClick={refresh} size="small">
              <RefreshIcon />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* Top-level KPI Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ borderLeft: '4px solid', borderColor: 'success.main' }}>
            <CardContent>
              <Typography variant="overline" color="text.secondary">M78 Gateway Accuracy</Typography>
              <Typography variant="h4" fontWeight="bold" color="success.main">
                {(gateway.accuracy * 100).toFixed(1)}%
              </Typography>
              <Typography variant="caption">HoTT reasoning · {gateway.requestsTotal.toLocaleString()} reqs</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ borderLeft: '4px solid', borderColor: 'info.main' }}>
            <CardContent>
              <Typography variant="overline" color="text.secondary">Φ Three-Horizon Total</Typography>
              <Typography variant="h4" fontWeight="bold" color="info.main">
                {solver.phiTotal.toFixed(1)}
              </Typography>
              <Typography variant="caption">
                Past: {solver.phiPast.toFixed(1)} | Now: {solver.phiPresent.toFixed(1)} | Future: {solver.phiFuture.toFixed(1)}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ borderLeft: '4px solid', borderColor: 'warning.main' }}>
            <CardContent>
              <Typography variant="overline" color="text.secondary">Φ-402 Settlements</Typography>
              <Typography variant="h4" fontWeight="bold" color="warning.main">
                {payment.totalSettled.toLocaleString()}
              </Typography>
              <Typography variant="caption">
                Success: {(payment.successRate * 100).toFixed(1)}% | Free: {(payment.phiFreeRate * 100).toFixed(0)}%
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ borderLeft: '4px solid', borderColor: 'secondary.main' }}>
            <CardContent>
              <Typography variant="overline" color="text.secondary">PhiAgent NFTs</Typography>
              <Typography variant="h4" fontWeight="bold" color="secondary.main">
                {agent.nftMinted}
              </Typography>
              <Typography variant="caption">
                Agents: {agent.totalAgents} | Rep: {agent.avgReputation.toFixed(1)} | Pending: {agent.pendingValidations}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Tabbed Detail Panels */}
      <Paper sx={{ mb: 3 }}>
        <Tabs value={tabValue} onChange={(_, v) => setTabValue(v)} variant="scrollable" scrollButtons="auto">
          <Tab icon={<GatewayIcon />} iconPosition="start" label="M78 HoTT Gateway" />
          <Tab icon={<SolverIcon />} iconPosition="start" label="M84 Liu Solver" />
          <Tab icon={<CompressorIcon />} iconPosition="start" label="NIS Compressor" />
          <Tab icon={<PaymentIcon />} iconPosition="start" label="Phi-402 Payment" />
          <Tab icon={<IdentityIcon />} iconPosition="start" label="PhiAgent Identity" />
          <Tab icon={<ConsensusIcon />} iconPosition="start" label="Consensus" />
        </Tabs>

        {/* Tab 0: M78 HoTT Gateway */}
        <TabPanel value={tabValue} index={0}>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Typography variant="h6" gutterBottom>M78 HoTT Reasoning Gateway</Typography>
              <StatusChip online={gateway.isOnline} />
              <Box sx={{ mt: 2 }}>
                <PhiGauge value={gateway.confidence * 100} label="Decision Confidence" />
                <PhiGauge value={gateway.accuracy * 100} label="Routing Accuracy" />
              </Box>
              <TableContainer sx={{ mt: 2 }}>
                <Table size="small">
                  <TableBody>
                    <TableRow><TableCell>Current Decision</TableCell><TableCell><Chip label={gateway.decision} color={gateway.decision === 'PRIORITY' ? 'success' : gateway.decision === 'REJECT' ? 'error' : 'default'} size="small" /></TableCell></TableRow>
                    <TableRow><TableCell>Proof Computation Depth</TableCell><TableCell>{gateway.proofDepth} steps</TableCell></TableRow>
                    <TableRow><TableCell>Avg Latency</TableCell><TableCell>{gateway.avgLatencyMs.toFixed(1)} ms</TableCell></TableRow>
                    <TableRow><TableCell>Total Requests Processed</TableCell><TableCell>{gateway.requestsTotal.toLocaleString()}</TableCell></TableRow>
                  </TableBody>
                </Table>
              </TableContainer>
            </Grid>
            <Grid item xs={12} md={6}>
              <Typography variant="h6" gutterBottom>Decision Distribution</Typography>
              <Alert severity="info" sx={{ mb: 2 }}>
                HoTT type checking: prove(G) → PRIORITY, wait() → THROTTLE, neutral → NORMAL, contradiction → REJECT
              </Alert>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                <Chip label="PRIORITY: 42%" color="success" />
                <Chip label="NORMAL: 38%" color="info" />
                <Chip label="THROTTLE: 15%" color="warning" />
                <Chip label="REJECT: 5%" color="error" />
              </Box>
              <Typography variant="body2" sx={{ mt: 2 }} color="text.secondary">
                Fallback: Rules-based Φ-Gateway (V2.1) active when M78 service offline.
                Current mode: {gateway.isOnline ? 'HoTT Reasoning' : 'Rules Fallback'}
              </Typography>
            </Grid>
          </Grid>
        </TabPanel>

        {/* Tab 1: M84 Liu Solver */}
        <TabPanel value={tabValue} index={1}>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Typography variant="h6" gutterBottom>M84 Liu Principle Φ Solver</Typography>
              <StatusChip online={solver.isOnline} />
              <Box sx={{ mt: 2 }}>
                <PhiGauge value={solver.phiPast} label="Φ Past (Experience Memory)" />
                <PhiGauge value={solver.phiPresent} label="Φ Present (Real-time IGCTR)" />
                <PhiGauge value={solver.phiFuture} label="Φ Future (Prediction)" />
                <PhiGauge value={solver.phiTotal} max={300} label="Φ Total (Three-Horizon)" />
              </Box>
            </Grid>
            <Grid item xs={12} md={6}>
              <Typography variant="h6" gutterBottom>Horizon Weights</Typography>
              <TableContainer>
                <Table size="small">
                  <TableHead><TableRow><TableCell>Horizon</TableCell><TableCell>Weight</TableCell><TableCell>Φ Value</TableCell></TableRow></TableHead>
                  <TableBody>
                    <TableRow><TableCell>Past (EWMA)</TableCell><TableCell>{(solver.horizonWeights.past * 100).toFixed(0)}%</TableCell><TableCell>{solver.phiPast.toFixed(1)}</TableCell></TableRow>
                    <TableRow><TableCell>Present (IGCTR)</TableCell><TableCell>{(solver.horizonWeights.present * 100).toFixed(0)}%</TableCell><TableCell>{solver.phiPresent.toFixed(1)}</TableCell></TableRow>
                    <TableRow><TableCell>Future (Oracle)</TableCell><TableCell>{(solver.horizonWeights.future * 100).toFixed(0)}%</TableCell><TableCell>{solver.phiFuture.toFixed(1)}</TableCell></TableRow>
                  </TableBody>
                </Table>
              </TableContainer>
              <Alert severity="success" sx={{ mt: 2 }}>
                Three-horizon confidence: {(solver.confidence * 100).toFixed(0)}%
              </Alert>
            </Grid>
          </Grid>
        </TabPanel>

        {/* Tab 2: NIS Compressor */}
        <TabPanel value={tabValue} index={2}>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Typography variant="h6" gutterBottom>NIS Neural Φ Compressor</Typography>
              <StatusChip online={compressor.isOnline} />
              <Box sx={{ mt: 2 }}>
                <PhiGauge value={(1 - compressor.reconstructionError) * 100} label="Reconstruction Fidelity" />
                <PhiGauge value={compressor.compressionRatio * 100} label="Compression Ratio" />
              </Box>
              <TableContainer sx={{ mt: 2 }}>
                <Table size="small">
                  <TableBody>
                    <TableRow><TableCell>Input Dimension</TableCell><TableCell>{compressor.inputDim}</TableCell></TableRow>
                    <TableRow><TableCell>Latent Dimension</TableCell><TableCell>{compressor.latentDim}</TableCell></TableRow>
                    <TableRow><TableCell>Compression Factor</TableCell><TableCell>{compressor.inputDim / compressor.latentDim}×</TableCell></TableRow>
                    <TableRow><TableCell>Inference Latency</TableCell><TableCell>{compressor.inferenceLatencyMs.toFixed(1)} ms</TableCell></TableRow>
                    <TableRow><TableCell>Reconstruction Error</TableCell><TableCell>{compressor.reconstructionError.toFixed(4)}</TableCell></TableRow>
                    <TableRow><TableCell>Mode</TableCell><TableCell><Chip label={compressor.mode} size="small" color={compressor.mode === 'inference' ? 'success' : 'default'} /></TableCell></TableRow>
                  </TableBody>
                </Table>
              </TableContainer>
            </Grid>
            <Grid item xs={12} md={6}>
              <Typography variant="h6" gutterBottom>Complexity Comparison</Typography>
              <TableContainer>
                <Table size="small">
                  <TableHead><TableRow><TableCell>Method</TableCell><TableCell>Complexity</TableCell><TableCell>Latency</TableCell></TableRow></TableHead>
                  <TableBody>
                    <TableRow><TableCell>Brute Force Φ</TableCell><TableCell>O(2^N)</TableCell><TableCell>~100ms</TableCell></TableRow>
                    <TableRow><TableCell>NIS Neural</TableCell><TableCell>O(N log N)</TableCell><TableCell>~{compressor.inferenceLatencyMs.toFixed(0)}ms</TableCell></TableRow>
                    <TableRow sx={{ backgroundColor: 'action.hover' }}><TableCell><strong>Speedup</strong></TableCell><TableCell><strong>Exponential→Linearithmic</strong></TableCell><TableCell><strong>~{Math.round(100 / compressor.inferenceLatencyMs)}×</strong></TableCell></TableRow>
                  </TableBody>
                </Table>
              </TableContainer>
            </Grid>
          </Grid>
        </TabPanel>

        {/* Tab 3: Phi-402 Payment */}
        <TabPanel value={tabValue} index={3}>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Typography variant="h6" gutterBottom>Φ-402 Semantic Micropayment</Typography>
              <StatusChip online={payment.isOnline} />
              <TableContainer sx={{ mt: 2 }}>
                <Table size="small">
                  <TableBody>
                    <TableRow><TableCell>Total Settled</TableCell><TableCell>{payment.totalSettled.toLocaleString()}</TableCell></TableRow>
                    <TableRow><TableCell>Success Rate</TableCell><TableCell><Chip label={`${(payment.successRate * 100).toFixed(1)}%`} color="success" size="small" /></TableCell></TableRow>
                    <TableRow><TableCell>Avg Fee (Φ-Token)</TableCell><TableCell>{payment.avgFee.toFixed(5)}</TableCell></TableRow>
                    <TableRow><TableCell>Φ-Free Rate (≥0.75)</TableCell><TableCell>{(payment.phiFreeRate * 100).toFixed(0)}%</TableCell></TableRow>
                    <TableRow><TableCell>Premium Rate (&lt;0.4)</TableCell><TableCell>{(payment.premiumRate * 100).toFixed(0)}%</TableCell></TableRow>
                    <TableRow><TableCell>Pending Settlements</TableCell><TableCell>{payment.pendingSettlements}</TableCell></TableRow>
                  </TableBody>
                </Table>
              </TableContainer>
            </Grid>
            <Grid item xs={12} md={6}>
              <Typography variant="h6" gutterBottom>Φ Value Gradient Payment Model</Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mt: 1 }}>
                <Alert severity="success" icon={<TrendIcon />}>
                  Φ ≥ 0.75 → PRIORITY + FREE (high semantic value, encourage quality)
                </Alert>
                <Alert severity="info">
                  0.4 ≤ Φ &lt; 0.75 → NORMAL + Standard Rate (base_rate × 1.0)
                </Alert>
                <Alert severity="warning">
                  Φ &lt; 0.4 → THROTTLE + Premium Rate (base_rate ×溢价)
                </Alert>
              </Box>
              <Typography variant="body2" sx={{ mt: 2 }} color="text.secondary">
                Settlement: ERC-3009 TransferWithAuthorization (gasless Φ-Token transfer)
                <br />Settlement contract: Phi402Settlement.sol
              </Typography>
            </Grid>
          </Grid>
        </TabPanel>

        {/* Tab 4: PhiAgent Identity */}
        <TabPanel value={tabValue} index={4}>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Typography variant="h6" gutterBottom>PhiAgent NFT Identity Tri-Registry</Typography>
              <StatusChip online={agent.isOnline} />
              <TableContainer sx={{ mt: 2 }}>
                <Table size="small">
                  <TableBody>
                    <TableRow><TableCell>Total Agents</TableCell><TableCell>{agent.totalAgents}</TableCell></TableRow>
                    <TableRow><TableCell>NFTs Minted</TableCell><TableCell>{agent.nftMinted}</TableCell></TableRow>
                    <TableRow><TableCell>Avg Reputation (Φ-weighted)</TableCell><TableCell>{agent.avgReputation.toFixed(1)}</TableCell></TableRow>
                    <TableRow><TableCell>Pending Validations</TableCell><TableCell>{agent.pendingValidations}</TableCell></TableRow>
                  </TableBody>
                </Table>
              </TableContainer>
            </Grid>
            <Grid item xs={12} md={6}>
              <Typography variant="h6" gutterBottom>Three Registries (ERC-8004 Enhanced)</Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <Card variant="outlined"><CardContent>
                  <Typography variant="subtitle2">Identity Registry (ERC-721)</Typography>
                  <Typography variant="body2">NFT metadata: |Φ|·e^(iθ), capability claims, creation time</Typography>
                </CardContent></Card>
                <Card variant="outlined"><CardContent>
                  <Typography variant="subtitle2">Reputation Registry (Φ-weighted)</Typography>
                  <Typography variant="body2">Score = rawScore × Φ/100 | Anti-sybil: low-Φ ratings auto-downweighted</Typography>
                </CardContent></Card>
                <Card variant="outlined"><CardContent>
                  <Typography variant="subtitle2">Validation Registry (zk+HoTT)</Typography>
                  <Typography variant="body2">zk-Proof privacy verification + HoTT type checking verification</Typography>
                </CardContent></Card>
              </Box>
            </Grid>
          </Grid>
        </TabPanel>

        {/* Tab 5: Consensus */}
        <TabPanel value={tabValue} index={5}>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Typography variant="h6" gutterBottom>Self-Referential Consensus Engine</Typography>
              <StatusChip online={consensus.isOnline} />
              <Box sx={{ mt: 2 }}>
                <PhiGauge value={consensus.currentThreshold * 100} max={60} label="Consensus Threshold (%)" />
                <PhiGauge value={consensus.predictionAccuracy * 100} label="Prediction Accuracy" />
              </Box>
              <TableContainer sx={{ mt: 2 }}>
                <Table size="small">
                  <TableBody>
                    <TableRow><TableCell>Current Threshold</TableCell><TableCell>{(consensus.currentThreshold * 100).toFixed(1)}%</TableCell></TableRow>
                    <TableRow><TableCell>Range</TableCell><TableCell>51% - 60%</TableCell></TableRow>
                    <TableRow><TableCell>Prediction Accuracy</TableCell><TableCell>{(consensus.predictionAccuracy * 100).toFixed(1)}%</TableCell></TableRow>
                    <TableRow><TableCell>Self-Correction Count</TableCell><TableCell>{consensus.selfCorrectionCount}</TableCell></TableRow>
                  </TableBody>
                </Table>
              </TableContainer>
            </Grid>
            <Grid item xs={12} md={6}>
              <Typography variant="h6" gutterBottom>Self-Correction Loop</Typography>
              <Alert severity="info" sx={{ mb: 2 }}>
                threshold(t+1) = threshold(t) + κ × (accuracy_target - accuracy(t))
                <br />κ = 0.1, accuracy_target = 0.80
              </Alert>
              <Typography variant="body2" color="text.secondary">
                When prediction accuracy drops below target, the consensus threshold automatically increases
                (e.g., 51% → 55%), requiring more agreement for decisions. As accuracy recovers,
                the threshold gradually relaxes back toward the baseline.
              </Typography>
            </Grid>
          </Grid>
        </TabPanel>
      </Paper>

      {/* Module Status Summary */}
      <Paper sx={{ p: 2 }}>
        <Typography variant="h6" gutterBottom>V6.0 Module Status Overview</Typography>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Module</TableCell>
                <TableCell>Priority</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Source</TableCell>
                <TableCell>Key Metric</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              <TableRow><TableCell>M78 HoTT Gateway</TableCell><TableCell><Chip label="P0" color="error" size="small" /></TableCell><TableCell><StatusChip online={gateway.isOnline} /></TableCell><TableCell>Taiyi AGI</TableCell><TableCell>97.3% accuracy</TableCell></TableRow>
              <TableRow><TableCell>M84 Liu Solver</TableCell><TableCell><Chip label="P0" color="error" size="small" /></TableCell><TableCell><StatusChip online={solver.isOnline} /></TableCell><TableCell>Taiyi AGI</TableCell><TableCell>Φ={solver.phiTotal.toFixed(1)}</TableCell></TableRow>
              <TableRow><TableCell>NIS Compressor</TableCell><TableCell><Chip label="P0" color="error" size="small" /></TableCell><TableCell><StatusChip online={compressor.isOnline} /></TableCell><TableCell>NIS Theory</TableCell><TableCell>{compressor.inferenceLatencyMs.toFixed(1)}ms latency</TableCell></TableRow>
              <TableRow><TableCell>Φ-402 Payment</TableCell><TableCell><Chip label="P0" color="error" size="small" /></TableCell><TableCell><StatusChip online={payment.isOnline} /></TableCell><TableCell>AEON x402</TableCell><TableCell>{payment.totalSettled} settled</TableCell></TableRow>
              <TableRow><TableCell>Φ-AP2 Authorization</TableCell><TableCell><Chip label="P1" color="warning" size="small" /></TableCell><TableCell><StatusChip online={true} /></TableCell><TableCell>AEON AP2</TableCell><TableCell>3 mandate types</TableCell></TableRow>
              <TableRow><TableCell>PhiAgent Identity</TableCell><TableCell><Chip label="P1" color="warning" size="small" /></TableCell><TableCell><StatusChip online={agent.isOnline} /></TableCell><TableCell>ERC-8004</TableCell><TableCell>{agent.nftMinted} NFTs</TableCell></TableRow>
              <TableRow><TableCell>IIT 4.0 Verifier</TableCell><TableCell><Chip label="P1" color="warning" size="small" /></TableCell><TableCell><StatusChip online={true} /></TableCell><TableCell>IIT 4.0</TableCell><TableCell>Causal sufficiency</TableCell></TableRow>
              <TableRow><TableCell>Self-Ref Consensus</TableCell><TableCell><Chip label="P2" color="info" size="small" /></TableCell><TableCell><StatusChip online={consensus.isOnline} /></TableCell><TableCell>Taiyi Oracle</TableCell><TableCell>τ={consensus.currentThreshold.toFixed(2)}</TableCell></TableRow>
              <TableRow><TableCell>Hex Dual Conv</TableCell><TableCell><Chip label="P2" color="info" size="small" /></TableCell><TableCell><StatusChip online={true} /></TableCell><TableCell>Taiyi AGI</TableCell><TableCell>6 FPGA templates</TableCell></TableRow>
              <TableRow><TableCell>Bio-Φ Interface</TableCell><TableCell><Chip label="P2" color="info" size="small" /></TableCell><TableCell><StatusChip online={true} /></TableCell><TableCell>IIT+Physiology</TableCell><TableCell>Protocol only</TableCell></TableRow>
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </Box>
  );
}
