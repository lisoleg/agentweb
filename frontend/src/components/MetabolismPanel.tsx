/**
 * MetabolismPanel - V10.0 新陈代谢面板
 *
 * 显示Agent新陈代谢状态：代谢率、冬眠/唤醒、再生。
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
  Snackbar,
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  Biology as BioIcon,
  AcUnit as HibernateIcon,
  LocalFireDepartment as RegenerateIcon,
  TrendingDown as AgingIcon,
  TrendingUp as GrowthIcon,
  Speed as SpeedIcon,
  WakeUp as WakeIcon,
  ElectricBolt as PhiIcon,
  Timer as TimerIcon,
  Work as WorkIcon,
  HowToVote as VoteIcon,
} from '@mui/icons-material';

// ============ Types ============

type MetabolismPhase = 'GROWTH' | 'STABLE' | 'AGING' | 'HIBERNATION' | 'REGENERATION';

interface AgentMetabolism {
  agent: string;
  baseRate: number;
  effectiveRate: number;
  age: number;
  phase: MetabolismPhase;
  hibernating: boolean;
  regenCount: number;
}

// ============ Mock Data ============

const initialAgents: AgentMetabolism[] = [
  { agent: 'Agent-Alpha', baseRate: 7500, effectiveRate: 8200, age: 15, phase: 'GROWTH', hibernating: false, regenCount: 0 },
  { agent: 'Agent-Beta', baseRate: 5000, effectiveRate: 5000, age: 45, phase: 'STABLE', hibernating: false, regenCount: 1 },
  { agent: 'Agent-Gamma', baseRate: 2500, effectiveRate: 1800, age: 80, phase: 'AGING', hibernating: false, regenCount: 2 },
  { agent: 'Agent-Delta', baseRate: 4000, effectiveRate: 400, age: 60, phase: 'HIBERNATION', hibernating: true, regenCount: 0 },
  { agent: 'Agent-Epsilon', baseRate: 6000, effectiveRate: 6000, age: 35, phase: 'REGENERATION', hibernating: false, regenCount: 3 },
];

// ============ Sub-components ============

function PhaseChip({ phase }: { phase: MetabolismPhase }) {
  const config: Record<MetabolismPhase, { color: 'success' | 'info' | 'warning' | 'primary' | 'secondary'; icon: React.ReactNode }> = {
    GROWTH: { color: 'success', icon: <GrowthIcon fontSize="small" /> },
    STABLE: { color: 'info', icon: <SpeedIcon fontSize="small" /> },
    AGING: { color: 'warning', icon: <AgingIcon fontSize="small" /> },
    HIBERNATION: { color: 'primary', icon: <HibernateIcon fontSize="small" /> },
    REGENERATION: { color: 'secondary', icon: <RegenerateIcon fontSize="small" /> },
  };
  const c = config[phase];
  return <Chip icon={c.icon as React.ReactElement} label={phase} color={c.color} size="small" variant="outlined" />;
}

function MetabolismGauge({ value, label }: { value: number; label: string }) {
  const pct = Math.min(100, (value / 10000) * 100);
  const color = pct >= 75 ? 'success' : pct >= 40 ? 'warning' : 'error';
  return (
    <Box sx={{ mb: 1 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
        <Typography variant="caption" color="text.secondary">{label}</Typography>
        <Typography variant="caption" fontWeight="bold">{(value / 100).toFixed(0)}%</Typography>
      </Box>
      <LinearProgress variant="determinate" value={pct} color={color} sx={{ height: 8, borderRadius: 4 }} />
    </Box>
  );
}

// V11.0: Wakeup condition indicator lights
function WakeConditionLight({ label, met, icon }: { label: string; met: boolean; icon: React.ReactNode }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
      <Box
        sx={{
          width: 10,
          height: 10,
          borderRadius: '50%',
          backgroundColor: met ? '#4caf50' : '#bdbdbd',
          boxShadow: met ? '0 0 6px #4caf50' : 'none',
          transition: 'all 0.3s',
        }}
      />
      {icon}
      <Typography variant="caption" color={met ? 'success.main' : 'text.disabled'}>
        {label}
      </Typography>
    </Box>
  );
}

// ============ Main Component ============

export default function MetabolismPanel() {
  const [agents, setAgents] = useState<AgentMetabolism[]>(initialAgents);
  const [wakeToast, setWakeToast] = useState<{ open: boolean; agent: string; success: boolean }>({
    open: false,
    agent: '',
    success: false,
  });

  const refresh = useCallback(() => {
    setAgents(prev => prev.map(a => {
      if (a.hibernating) return a;
      const fluctuation = (Math.random() - 0.5) * 200;
      const newEffective = Math.max(0, Math.min(10000, a.effectiveRate + Math.floor(fluctuation)));
      return { ...a, effectiveRate: newEffective };
    }));
  }, []);

  useEffect(() => {
    const interval = setInterval(refresh, 3000);
    return () => clearInterval(interval);
  }, [refresh]);

  const avgRate = Math.floor(agents.reduce((s, a) => s + a.effectiveRate, 0) / agents.length);
  const hibernatingCount = agents.filter(a => a.hibernating).length;
  const agingCount = agents.filter(a => a.phase === 'AGING').length;

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <BioIcon color="primary" />
          <Typography variant="h6">Metabolism Monitor</Typography>
          <Chip label="V10.0" color="primary" size="small" />
        </Box>
        <Tooltip title="Refresh data">
          <IconButton onClick={refresh} size="small">
            <RefreshIcon />
          </IconButton>
        </Tooltip>
      </Box>

      {/* KPI Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={4}>
          <Card sx={{ borderLeft: '4px solid', borderColor: 'info.main' }}>
            <CardContent>
              <Typography variant="overline" color="text.secondary">Avg Effective Rate</Typography>
              <Typography variant="h5" fontWeight="bold">{(avgRate / 100).toFixed(0)}%</Typography>
              <MetabolismGauge value={avgRate} label="Across all agents" />
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Card sx={{ borderLeft: '4px solid', borderColor: 'primary.main' }}>
            <CardContent>
              <Typography variant="overline" color="text.secondary">Hibernating</Typography>
              <Typography variant="h5" fontWeight="bold" color="primary.main">{hibernatingCount}</Typography>
              <Typography variant="caption">Rate reduced to 10%</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Card sx={{ borderLeft: '4px solid', borderColor: 'warning.main' }}>
            <CardContent>
              <Typography variant="overline" color="text.secondary">Aging Agents</Typography>
              <Typography variant="h5" fontWeight="bold" color="warning.main">{agingCount}</Typography>
              <Typography variant="caption">May need regeneration</Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Agent Metabolism Table */}
      <TableContainer component={Paper} sx={{ mb: 3 }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Agent</TableCell>
              <TableCell>Base Rate</TableCell>
              <TableCell>Effective Rate</TableCell>
              <TableCell>Age</TableCell>
              <TableCell>Phase</TableCell>
              <TableCell>Regen Count</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {agents.map((agent) => (
              <TableRow key={agent.agent}>
                <TableCell fontWeight="bold">{agent.agent}</TableCell>
                <TableCell>{(agent.baseRate / 100).toFixed(0)}%</TableCell>
                <TableCell>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <LinearProgress
                      variant="determinate"
                      value={(agent.effectiveRate / 10000) * 100}
                      color={agent.effectiveRate >= 7500 ? 'success' : agent.effectiveRate >= 4000 ? 'warning' : 'error'}
                      sx={{ height: 6, borderRadius: 3, width: 80 }}
                    />
                    <Typography variant="caption">{(agent.effectiveRate / 100).toFixed(0)}%</Typography>
                  </Box>
                </TableCell>
                <TableCell>{agent.age} epochs</TableCell>
                <TableCell><PhaseChip phase={agent.phase} /></TableCell>
                <TableCell>{agent.regenCount}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Info */}
      <Alert severity="info">
        <strong>Metabolism Phases:</strong> GROWTH (age &lt; 30) → STABLE (rate ≥ 30%) → AGING (rate &lt; 30%) → HIBERNATION (rate = 10%) → REGENERATION (post-wake recovery)
      </Alert>

      {/* V11.0: Wakeup Conditions & Manual Wake */}
      <Card sx={{ mt: 3, borderLeft: '4px solid', borderColor: 'secondary.main' }}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="subtitle1" fontWeight="bold">
              V11.0 Hibernation Wakeup Conditions
            </Typography>
            <Chip label="V11.0" color="secondary" size="small" />
          </Box>

          {/* 4 Wakeup Condition Indicator Lights */}
          <Grid container spacing={2} sx={{ mb: 2 }}>
            <Grid item xs={12} sm={3}>
              <WakeConditionLight
                label="Φ ≥ 3000"
                met={true}
                icon={<PhiIcon sx={{ fontSize: 16 }} color={true ? 'success' : 'disabled'} />}
              />
            </Grid>
            <Grid item xs={12} sm={3}>
              <WakeConditionLight
                label="Timeout ≥ 30d"
                met={false}
                icon={<TimerIcon sx={{ fontSize: 16 }} color={false ? 'success' : 'disabled'} />}
              />
            </Grid>
            <Grid item xs={12} sm={3}>
              <WakeConditionLight
                label="Pending Orders"
                met={false}
                icon={<WorkIcon sx={{ fontSize: 16 }} color={false ? 'success' : 'disabled'} />}
              />
            </Grid>
            <Grid item xs={12} sm={3}>
              <WakeConditionLight
                label="Vote Weight ≥ 1%"
                met={true}
                icon={<VoteIcon sx={{ fontSize: 16 }} color={true ? 'success' : 'disabled'} />}
              />
            </Grid>
          </Grid>

          <Alert severity="info" sx={{ mb: 2 }}>
            Any ONE condition met → Agent can be woken up. 2 of 4 conditions currently met for hibernating agents.
          </Alert>

          {/* Manual Wake Button for Hibernating Agents */}
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            {agents.filter(a => a.hibernating).map(agent => (
              <Button
                key={agent.agent}
                variant="outlined"
                size="small"
                color="secondary"
                startIcon={<WakeIcon />}
                onClick={() => {
                  setAgents(prev => prev.map(a =>
                    a.agent === agent.agent
                      ? { ...a, hibernating: false, phase: 'REGENERATION' as MetabolismPhase, effectiveRate: a.baseRate }
                      : a
                  ));
                  setWakeToast({ open: true, agent: agent.agent, success: true });
                }}
              >
                Wake {agent.agent}
              </Button>
            ))}
          </Box>
        </CardContent>
      </Card>

      {/* Wakeup Result Toast */}
      <Snackbar
        open={wakeToast.open}
        autoHideDuration={3000}
        onClose={() => setWakeToast({ ...wakeToast, open: false })}
        message={wakeToast.success
          ? `${wakeToast.agent} successfully woken up!`
          : `Failed to wake ${wakeToast.agent}`
        }
      />
    </Box>
  );
}
