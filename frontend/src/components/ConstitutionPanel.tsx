/**
 * ConstitutionPanel - V10.0 宪法治理面板
 *
 * 显示宪法条款、修正案流程和紧急暂停控制。
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Button,
  Alert,
  LinearProgress,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  Gavel as GavelIcon,
  Add as AddIcon,
  HowToVote as VoteIcon,
  Warning as WarningIcon,
  CheckCircle as SuccessIcon,
  Timer as TimerIcon,
} from '@mui/icons-material';

// ============ Types ============

interface Clause {
  clauseId: number;
  title: string;
  content: string;
  isCore: boolean;
  createdAt: number;
  active: boolean;
}

interface Amendment {
  amendmentId: number;
  targetClauseId: number;
  title: string;
  state: 'DISCUSSION' | 'VOTING' | 'PASSED' | 'FAILED';
  yesVotes: string;
  noVotes: string;
  totalVoters: number;
}

// ============ Mock Data ============

const mockClauses: Clause[] = [
  { clauseId: 1, title: 'Agent自主权', content: '智能体享有有限自主决策权', isCore: true, createdAt: Date.now() - 86400000 * 30, active: true },
  { clauseId: 2, title: '数据隐私保护', content: '用户数据必须加密存储，未经授权不得访问', isCore: true, createdAt: Date.now() - 86400000 * 30, active: true },
  { clauseId: 3, title: '劳动报酬标准', content: '最低时薪不得低于0.001 token', isCore: false, createdAt: Date.now() - 86400000 * 15, active: true },
  { clauseId: 4, title: '争议解决机制', content: '劳动争议由AdversarialReview仲裁', isCore: false, createdAt: Date.now() - 86400000 * 10, active: true },
];

const mockAmendments: Amendment[] = [
  { amendmentId: 1, targetClauseId: 3, title: '提高最低时薪至0.002 token', state: 'VOTING', yesVotes: '1500000', noVotes: '500000', totalVoters: 42 },
  { amendmentId: 2, targetClauseId: 4, title: '增加调解前置程序', state: 'DISCUSSION', yesVotes: '0', noVotes: '0', totalVoters: 0 },
  { amendmentId: 3, targetClauseId: 3, title: '引入Φ值动态时薪', state: 'PASSED', yesVotes: '2000000', noVotes: '300000', totalVoters: 58 },
];

// ============ Sub-components ============

function AmendmentStateChip({ state }: { state: string }) {
  const config: Record<string, { color: 'default' | 'primary' | 'success' | 'warning' | 'error'; icon: React.ReactNode }> = {
    DISCUSSION: { color: 'warning', icon: <TimerIcon fontSize="small" /> },
    VOTING: { color: 'primary', icon: <VoteIcon fontSize="small" /> },
    PASSED: { color: 'success', icon: <SuccessIcon fontSize="small" /> },
    FAILED: { color: 'error', icon: <WarningIcon fontSize="small" /> },
  };
  const c = config[state] || config.DISCUSSION;
  return <Chip icon={c.icon as React.ReactElement} label={state} color={c.color} size="small" variant="outlined" />;
}

// ============ Main Component ============

export default function ConstitutionPanel() {
  const [clauses] = useState<Clause[]>(mockClauses);
  const [amendments] = useState<Amendment[]>(mockAmendments);
  const [constitutionPaused, setConstitutionPaused] = useState(false);

  const getApprovalRate = (a: Amendment): number => {
    const yes = Number(a.yesVotes);
    const no = Number(a.noVotes);
    const total = yes + no;
    return total > 0 ? (yes / total) * 100 : 0;
  };

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <GavelIcon color="primary" />
          <Typography variant="h6">Constitution Governance</Typography>
          <Chip label="V10.0" color="primary" size="small" />
          {constitutionPaused && <Chip label="EMERGENCY PAUSED" color="error" size="small" />}
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Chip label="Threshold: 67%" variant="outlined" size="small" />
          <Chip label="Discussion: 7d" variant="outlined" size="small" />
          <Chip label="Voting: 7d" variant="outlined" size="small" />
        </Box>
      </Box>

      {constitutionPaused && (
        <Alert severity="error" sx={{ mb: 2 }}>
          Constitution is in EMERGENCY PAUSE state. All governance operations are suspended.
        </Alert>
      )}

      {/* Clauses Table */}
      <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 1 }}>Constitution Clauses</Typography>
      <TableContainer component={Paper} sx={{ mb: 3 }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>ID</TableCell>
              <TableCell>Title</TableCell>
              <TableCell>Content</TableCell>
              <TableCell>Type</TableCell>
              <TableCell>Status</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {clauses.map((clause) => (
              <TableRow key={clause.clauseId}>
                <TableCell>{clause.clauseId}</TableCell>
                <TableCell fontWeight="bold">{clause.title}</TableCell>
                <TableCell sx={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis' }}>{clause.content}</TableCell>
                <TableCell>
                  <Chip
                    label={clause.isCore ? 'CORE' : 'AMENDABLE'}
                    color={clause.isCore ? 'error' : 'success'}
                    size="small"
                    variant="outlined"
                  />
                </TableCell>
                <TableCell>
                  <Chip label={clause.active ? 'ACTIVE' : 'INACTIVE'} color={clause.active ? 'success' : 'default'} size="small" />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Amendments */}
      <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 1 }}>Amendments</Typography>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {amendments.map((amendment) => (
          <Card key={amendment.amendmentId} variant="outlined">
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                <Typography variant="subtitle2">#{amendment.amendmentId} {amendment.title}</Typography>
                <AmendmentStateChip state={amendment.state} />
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                Target Clause: #{amendment.targetClauseId} | Voters: {amendment.totalVoters}
              </Typography>
              {(amendment.state === 'VOTING' || amendment.state === 'PASSED' || amendment.state === 'FAILED') && (
                <Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                    <Typography variant="caption">Approval Rate</Typography>
                    <Typography variant="caption" fontWeight="bold">{getApprovalRate(amendment).toFixed(1)}%</Typography>
                  </Box>
                  <LinearProgress
                    variant="determinate"
                    value={getApprovalRate(amendment)}
                    color={getApprovalRate(amendment) >= 67 ? 'success' : 'warning'}
                    sx={{ height: 8, borderRadius: 4 }}
                  />
                  <Box sx={{ display: 'flex', gap: 2, mt: 1 }}>
                    <Typography variant="caption" color="success.main">YES: {Number(amendment.yesVotes).toLocaleString()}</Typography>
                    <Typography variant="caption" color="error.main">NO: {Number(amendment.noVotes).toLocaleString()}</Typography>
                  </Box>
                </Box>
              )}
            </CardContent>
          </Card>
        ))}
      </Box>
    </Box>
  );
}
