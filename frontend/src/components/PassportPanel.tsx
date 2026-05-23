/**
 * PassportPanel - V11.0 Agent通行证面板
 *
 * 显示Agent的Φ值、信用分、案件Merkle根、败诉案件数。
 * 支持签发、更新Φ值、更新Merkle根、撤销通行证。
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Chip,
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
  LinearProgress,
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  Badge as BadgeIcon,
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  VerifiedUser as VerifiedIcon,
} from '@mui/icons-material';

// ============ Types ============

interface PassportInfo {
  agent: string;
  phiValue: number;
  creditScore: number;
  caseMerkleRoot: string;
  lostCaseCount: number;
  totalCaseCount: number;
  issuedAt: number;
  lastUpdated: number;
  active: boolean;
}

// ============ Component ============

const PassportPanel: React.FC = () => {
  const [passports, setPassports] = useState<PassportInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [issueDialog, setIssueDialog] = useState(false);
  const [newAgent, setNewAgent] = useState('');
  const [newPhi, setNewPhi] = useState('5000');

  const fetchPassports = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await fetch('/api/v11/passport');
      const json = await resp.json();
      if (json.code === 0) {
        setPassports(json.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch passports:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPassports();
  }, [fetchPassports]);

  const handleIssue = async () => {
    try {
      await fetch('/api/v11/passport/issue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agent: newAgent, phiValue: parseInt(newPhi) }),
      });
      setIssueDialog(false);
      fetchPassports();
    } catch (err) {
      console.error('Failed to issue passport:', err);
    }
  };

  const handleRevoke = async (agent: string) => {
    try {
      await fetch(`/api/v11/passport/${agent}`, { method: 'DELETE' });
      fetchPassports();
    } catch (err) {
      console.error('Failed to revoke passport:', err);
    }
  };

  const creditScoreColor = (score: number) => {
    if (score >= 7000) return 'success';
    if (score >= 4000) return 'warning';
    return 'error';
  };

  const truncateAddr = (addr: string) =>
    addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : '';

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <BadgeIcon /> Agent通行证
          <Chip label={`共 ${passports.length} 个`} size="small" />
        </Typography>
        <Box>
          <Tooltip title="刷新">
            <IconButton onClick={fetchPassports} disabled={loading}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
          <Button
            variant="contained"
            size="small"
            startIcon={<AddIcon />}
            onClick={() => setIssueDialog(true)}
          >
            签发通行证
          </Button>
        </Box>
      </Box>

      {loading && <LinearProgress sx={{ mb: 2 }} />}

      {/* Passports Table */}
      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Agent</TableCell>
              <TableCell>Φ值</TableCell>
              <TableCell>信用分</TableCell>
              <TableCell>败诉/总案件</TableCell>
              <TableCell>状态</TableCell>
              <TableCell>签发时间</TableCell>
              <TableCell>操作</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {passports.map((p) => (
              <TableRow key={p.agent}>
                <TableCell>
                  <Typography variant="body2" fontFamily="monospace">
                    {truncateAddr(p.agent)}
                  </Typography>
                </TableCell>
                <TableCell>{p.phiValue}</TableCell>
                <TableCell>
                  <Chip
                    label={p.creditScore}
                    color={creditScoreColor(p.creditScore) as any}
                    size="small"
                  />
                </TableCell>
                <TableCell>{p.lostCaseCount}/{p.totalCaseCount}</TableCell>
                <TableCell>
                  <Chip
                    label={p.active ? '有效' : '已撤销'}
                    color={p.active ? 'success' : 'default'}
                    size="small"
                    icon={p.active ? <VerifiedIcon /> : undefined}
                  />
                </TableCell>
                <TableCell>
                  {new Date(p.issuedAt).toLocaleDateString()}
                </TableCell>
                <TableCell>
                  {p.active && (
                    <Tooltip title="撤销通行证">
                      <IconButton size="small" color="error" onClick={() => handleRevoke(p.agent)}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {passports.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} align="center">
                  <Typography color="text.secondary" sx={{ py: 2 }}>
                    暂无通行证数据
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Credit Score Explanation */}
      <Alert severity="info" sx={{ mt: 2 }}>
        信用分 = 5000 + 总案件数×100 - 败诉数×200，范围 0-10000
      </Alert>

      {/* Issue Dialog */}
      <Dialog open={issueDialog} onClose={() => setIssueDialog(false)}>
        <DialogTitle>签发Agent通行证</DialogTitle>
        <DialogContent>
          <TextField
            label="Agent地址"
            value={newAgent}
            onChange={(e) => setNewAgent(e.target.value)}
            fullWidth
            sx={{ mt: 1 }}
            placeholder="0x..."
          />
          <TextField
            label="初始Φ值 (0-10000)"
            type="number"
            value={newPhi}
            onChange={(e) => setNewPhi(e.target.value)}
            fullWidth
            sx={{ mt: 2 }}
            inputProps={{ min: 0, max: 10000 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIssueDialog(false)}>取消</Button>
          <Button variant="contained" onClick={handleIssue}>签发</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default PassportPanel;
