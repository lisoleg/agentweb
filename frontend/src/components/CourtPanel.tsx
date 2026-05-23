/**
 * CourtPanel - V11.0 宪法法院面板
 *
 * 显示宪法审查案件列表、投票进度、判决结果。
 * 支持提交新案件和紧急案件。
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
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  Gavel as GavelIcon,
  Emergency as EmergencyIcon,
  HowToVote as VoteIcon,
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

// ============ Mock Data ============

const initialCases: CourtCase[] = [
  { caseId: 1, amendmentId: 10, filer: '0xAbc...123', reason: '修正案违反核心条款', state: 'VOTING', isEmergency: false, yesVotes: 6500, noVotes: 3500, totalVoters: 12, judgment: 'NONE' },
  { caseId: 2, amendmentId: 11, filer: '0xDef...456', reason: '紧急安全审查', state: 'PENDING', isEmergency: true, yesVotes: 0, noVotes: 0, totalVoters: 0, judgment: 'NONE' },
  { caseId: 3, amendmentId: 8, filer: '0xGhi...789', reason: '修正案程序违规', state: 'RESOLVED', isEmergency: false, yesVotes: 7200, noVotes: 2800, totalVoters: 25, judgment: 'UPHOLD' },
  { caseId: 4, amendmentId: 9, filer: '0xJkl...012', reason: '修正案内容违宪', state: 'RESOLVED', isEmergency: false, yesVotes: 2800, noVotes: 7200, totalVoters: 18, judgment: 'OVERTURN' },
  { caseId: 5, amendmentId: 12, filer: '0xMno...345', reason: '发回重审申请', state: 'RESOLVED', isEmergency: false, yesVotes: 5000, noVotes: 5000, totalVoters: 20, judgment: 'REMAND' },
];

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

// ============ Main Component ============

export default function CourtPanel() {
  const [cases, setCases] = useState<CourtCase[]>(initialCases);
  const [showSubmit, setShowSubmit] = useState(false);
  const [isEmergency, setIsEmergency] = useState(false);
  const [newCase, setNewCase] = useState({ amendmentId: '', reason: '' });

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
          <Chip label="V11.0" color="primary" size="small" />
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
        <Grid item xs={12} sm={4}>
          <Card sx={{ borderLeft: '4px solid', borderColor: 'primary.main' }}>
            <CardContent>
              <Typography variant="overline" color="text.secondary">Voting</Typography>
              <Typography variant="h5" fontWeight="bold" color="primary.main">{votingCases}</Typography>
              <Typography variant="caption">Active voting cases</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Card sx={{ borderLeft: '4px solid', borderColor: 'success.main' }}>
            <CardContent>
              <Typography variant="overline" color="text.secondary">Resolved</Typography>
              <Typography variant="h5" fontWeight="bold" color="success.main">{resolvedCases}</Typography>
              <Typography variant="caption">Judgments rendered</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Card sx={{ borderLeft: '4px solid', borderColor: 'error.main' }}>
            <CardContent>
              <Typography variant="overline" color="text.secondary">Emergency</Typography>
              <Typography variant="h5" fontWeight="bold" color="error.main">{emergencyCases}</Typography>
              <Typography variant="caption">Emergency cases</Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

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
            </TableRow>
          </TableHead>
          <TableBody>
            {cases.map((courtCase) => (
              <TableRow key={courtCase.caseId}>
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
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Info */}
      <Alert severity="info">
        <strong>Judgment Threshold:</strong> 67% approval → UPHOLD; &lt;33% → OVERTURN (marks amendment FAILED); 33%-67% → REMAND (sends back for re-review)
      </Alert>

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
