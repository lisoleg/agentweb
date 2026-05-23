/**
 * BridgePanel - V11.0 跨链桥接V2面板
 *
 * 显示Passport信息、链列表选择、迁徙状态Stepper、Φ衰减显示。
 */

import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Chip,
  Grid,
  Stepper,
  Step,
  StepLabel,
  Alert,
  IconButton,
  Tooltip,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  SwapHoriz as BridgeIcon,
  AccountBalance as ChainIcon,
  VerifiedUser as PassportIcon,
} from '@mui/icons-material';

// ============ Types ============

type MigrationState = 'NONE' | 'LOCKED' | 'MINTED' | 'MIGRATED';

interface PassportInfo {
  phiValue: number;
  creditScore: number;
  caseMerkleRoot: string;
  lostCaseCount: number;
}

interface ChainInfo {
  chainId: number;
  name: string;
  active: boolean;
}

// ============ Mock Data ============

const mockChains: ChainInfo[] = [
  { chainId: 1, name: 'Ethereum', active: true },
  { chainId: 42161, name: 'Arbitrum', active: true },
  { chainId: 10, name: 'Optimism', active: true },
  { chainId: 137, name: 'Polygon', active: true },
];

const mockPassport: PassportInfo = {
  phiValue: 8500,
  creditScore: 6200,
  caseMerkleRoot: '0xabc...def',
  lostCaseCount: 3,
};

// ============ Sub-components ============

const migrationSteps = ['锁定资产', '目标链铸造', '迁徙完成'];

function PassportCard({ passport }: { passport: PassportInfo }) {
  return (
    <Card sx={{ borderLeft: '4px solid', borderColor: 'secondary.main' }}>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <PassportIcon color="secondary" />
          <Typography variant="subtitle1" fontWeight="bold">Agent Passport</Typography>
        </Box>
        <Grid container spacing={1}>
          <Grid item xs={6}>
            <Typography variant="caption" color="text.secondary">Φ Value</Typography>
            <Typography variant="body1" fontWeight="bold">{(passport.phiValue / 100).toFixed(0)}%</Typography>
          </Grid>
          <Grid item xs={6}>
            <Typography variant="caption" color="text.secondary">Credit Score</Typography>
            <Typography variant="body1" fontWeight="bold">{passport.creditScore}</Typography>
          </Grid>
          <Grid item xs={6}>
            <Typography variant="caption" color="text.secondary">Lost Cases</Typography>
            <Typography variant="body2">{passport.lostCaseCount}</Typography>
          </Grid>
          <Grid item xs={6}>
            <Typography variant="caption" color="text.secondary">Merkle Root</Typography>
            <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.75em' }}>
              {passport.caseMerkleRoot}
            </Typography>
          </Grid>
        </Grid>
      </CardContent>
    </Card>
  );
}

function DecayDisplay({ sourcePhi, decayRate }: { sourcePhi: number; decayRate: number }) {
  const decayedPhi = Math.floor((sourcePhi * decayRate) / 10000);
  const decayPercent = ((1 - decayRate / 10000) * 100).toFixed(1);
  return (
    <Alert severity="warning" sx={{ mb: 2 }}>
      <strong>Φ Decay:</strong> {sourcePhi} → {decayedPhi} (decay rate: {decayRate/100}%, loss: {decayPercent}%)
    </Alert>
  );
}

// ============ Main Component ============

export default function BridgePanel() {
  const [migrationState, setMigrationState] = useState<number>(0);
  const [showDialog, setShowDialog] = useState(false);
  const [targetChain, setTargetChain] = useState<number>(42161);
  const [amount, setAmount] = useState('');
  const [decayRate] = useState(9500);

  const activeStep = migrationState;  // 0=NONE, 1=LOCKED, 2=MINTED, 3=MIGRATED

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <BridgeIcon color="primary" />
          <Typography variant="h6">Cross-Chain Migration V2</Typography>
          <Chip label="V11.0" color="primary" size="small" />
        </Box>
        <Tooltip title="Refresh">
          <IconButton size="small">
            <RefreshIcon />
          </IconButton>
        </Tooltip>
      </Box>

      <Grid container spacing={3}>
        {/* Left: Passport Info */}
        <Grid item xs={12} md={4}>
          <PassportCard passport={mockPassport} />
        </Grid>

        {/* Right: Migration Status */}
        <Grid item xs={12} md={8}>
          {/* Decay Display */}
          <DecayDisplay sourcePhi={mockPassport.phiValue} decayRate={decayRate} />

          {/* Migration Stepper */}
          <Card sx={{ mb: 2 }}>
            <CardContent>
              <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 2 }}>
                Migration Status
              </Typography>
              <Stepper activeStep={activeStep} alternativeLabel>
                {migrationSteps.map((label) => (
                  <Step key={label}>
                    <StepLabel>{label}</StepLabel>
                  </Step>
                ))}
              </Stepper>
            </CardContent>
          </Card>

          {/* Chain List */}
          <Card sx={{ mb: 2 }}>
            <CardContent>
              <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
                Supported Chains
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                {mockChains.map((chain) => (
                  <Chip
                    key={chain.chainId}
                    icon={<ChainIcon />}
                    label={chain.name}
                    color={chain.active ? 'success' : 'default'}
                    variant={chain.active ? 'filled' : 'outlined'}
                    size="small"
                  />
                ))}
              </Box>
            </CardContent>
          </Card>

          {/* Action Button */}
          <Button
            variant="contained"
            fullWidth
            startIcon={<BridgeIcon />}
            onClick={() => setShowDialog(true)}
          >
            Start Cross-Chain Migration
          </Button>
        </Grid>
      </Grid>

      {/* Migration Dialog */}
      <Dialog open={showDialog} onClose={() => setShowDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Cross-Chain Migration with Passport</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <Alert severity="info">
              Passport data will be carried to the target chain with Φ decay applied.
            </Alert>
            <FormControl fullWidth size="small">
              <InputLabel>Target Chain</InputLabel>
              <Select
                value={targetChain}
                label="Target Chain"
                onChange={(e) => setTargetChain(e.target.value as number)}
              >
                {mockChains.filter(c => c.active).map((chain) => (
                  <MenuItem key={chain.chainId} value={chain.chainId}>
                    {chain.name} (ID: {chain.chainId})
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              label="Amount (tokens)"
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              fullWidth
              size="small"
            />
            <DecayDisplay sourcePhi={mockPassport.phiValue} decayRate={decayRate} />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowDialog(false)}>Cancel</Button>
          <Button variant="contained" onClick={() => { setShowDialog(false); setMigrationState(1); }}>
            Lock & Migrate
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
