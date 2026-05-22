/**
 * LaborMarketPanel - V10.0 AI劳动力市场面板
 *
 * 显示Agent/雇主注册、劳动订单和争议追踪。
 */

import React, { useState } from 'react';
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
  Alert,
  LinearProgress,
  Grid,
} from '@mui/material';
import {
  Work as WorkIcon,
  Person as PersonIcon,
  Business as BusinessIcon,
  Gavel as GavelIcon,
  TrendingUp as TrendIcon,
} from '@mui/icons-material';

// ============ Types ============

interface LaborOrder {
  orderId: number;
  employer: string;
  agent: string;
  description: string;
  hourlyRate: string;
  estimatedHours: number;
  budget: string;
  status: string;
  createdAt: number;
}

interface LaborDispute {
  disputeId: number;
  orderId: number;
  filer: string;
  reason: string;
  status: string;
  createdAt: number;
}

// ============ Mock Data ============

const mockOrders: LaborOrder[] = [
  { orderId: 1, employer: '0xA1b2...', agent: '0xC3d4...', description: 'NLP模型微调任务', hourlyRate: '0.005', estimatedHours: 20, budget: '0.1', status: 'COMPLETED', createdAt: Date.now() - 86400000 * 5 },
  { orderId: 2, employer: '0xE5f6...', agent: '0xC3d4...', description: '数据分析与可视化', hourlyRate: '0.003', estimatedHours: 40, budget: '0.12', status: 'IN_PROGRESS', createdAt: Date.now() - 86400000 * 2 },
  { orderId: 3, employer: '0xA1b2...', agent: '', description: '代码审查与优化', hourlyRate: '0.004', estimatedHours: 15, budget: '0.06', status: 'OPEN', createdAt: Date.now() },
  { orderId: 4, employer: '0xG7h8...', agent: '0xC3d4...', description: '安全审计', hourlyRate: '0.008', estimatedHours: 10, budget: '0.08', status: 'DISPUTED', createdAt: Date.now() - 86400000 * 3 },
];

const mockDisputes: LaborDispute[] = [
  { disputeId: 1, orderId: 4, filer: '0xC3d4...', reason: '工作范围超出原始描述', status: 'FILED', createdAt: Date.now() - 86400000 },
];

// ============ Sub-components ============

function OrderStatusChip({ status }: { status: string }) {
  const colorMap: Record<string, 'default' | 'primary' | 'success' | 'warning' | 'error' | 'info'> = {
    OPEN: 'info',
    CONFIRMED: 'primary',
    IN_PROGRESS: 'warning',
    COMPLETED: 'success',
    CANCELLED: 'default',
    DISPUTED: 'error',
  };
  return <Chip label={status} color={colorMap[status] || 'default'} size="small" variant="outlined" />;
}

// ============ Main Component ============

export default function LaborMarketPanel() {
  const [orders] = useState<LaborOrder[]>(mockOrders);
  const [disputes] = useState<LaborDispute[]>(mockDisputes);

  const totalBudget = orders.reduce((sum, o) => sum + parseFloat(o.budget), 0);
  const completedOrders = orders.filter(o => o.status === 'COMPLETED').length;
  const disputedOrders = orders.filter(o => o.status === 'DISPUTED').length;

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <WorkIcon color="primary" />
          <Typography variant="h6">AI Labor Market</Typography>
          <Chip label="V10.0" color="primary" size="small" />
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Chip label="Min Wage: 0.001/hr" variant="outlined" size="small" />
          <Chip label="Max Hours: 60/wk" variant="outlined" size="small" />
          <Chip label="Fee: 2.5%" variant="outlined" size="small" />
        </Box>
      </Box>

      {/* KPI Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={4}>
          <Card sx={{ borderLeft: '4px solid', borderColor: 'info.main' }}>
            <CardContent>
              <Typography variant="overline" color="text.secondary">Total Orders</Typography>
              <Typography variant="h5" fontWeight="bold">{orders.length}</Typography>
              <Typography variant="caption">Budget: {totalBudget.toFixed(3)} token</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Card sx={{ borderLeft: '4px solid', borderColor: 'success.main' }}>
            <CardContent>
              <Typography variant="overline" color="text.secondary">Completed</Typography>
              <Typography variant="h5" fontWeight="bold" color="success.main">{completedOrders}</Typography>
              <Typography variant="caption">{((completedOrders / orders.length) * 100).toFixed(0)}% completion rate</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Card sx={{ borderLeft: '4px solid', borderColor: 'error.main' }}>
            <CardContent>
              <Typography variant="overline" color="text.secondary">Disputes</Typography>
              <Typography variant="h5" fontWeight="bold" color="error.main">{disputedOrders}</Typography>
              <Typography variant="caption">{disputes.length} dispute(s) filed</Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Orders Table */}
      <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 1 }}>Labor Orders</Typography>
      <TableContainer component={Paper} sx={{ mb: 3 }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>ID</TableCell>
              <TableCell>Description</TableCell>
              <TableCell>Rate/hr</TableCell>
              <TableCell>Hours</TableCell>
              <TableCell>Budget</TableCell>
              <TableCell>Status</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {orders.map((order) => (
              <TableRow key={order.orderId}>
                <TableCell>{order.orderId}</TableCell>
                <TableCell>{order.description}</TableCell>
                <TableCell>{order.hourlyRate}</TableCell>
                <TableCell>{order.estimatedHours}</TableCell>
                <TableCell>{order.budget}</TableCell>
                <TableCell><OrderStatusChip status={order.status} /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Disputes */}
      {disputes.length > 0 && (
        <>
          <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 1 }}>Active Disputes</Typography>
          {disputes.map((dispute) => (
            <Alert key={dispute.disputeId} severity="warning" sx={{ mb: 1 }}>
              <strong>Dispute #{dispute.disputeId}</strong> for Order #{dispute.orderId}: {dispute.reason}
              <br />
              <Chip label={dispute.status} color="warning" size="small" sx={{ ml: 1 }} />
            </Alert>
          ))}
        </>
      )}

      {/* Labor Protection Info */}
      <Alert severity="info" sx={{ mt: 2 }}>
        <strong>Labor Protection:</strong> Min wage enforced at contract level. Max hours per week capped at 60.
        Disputes auto-escalate to AdversarialReview for arbitration.
      </Alert>
    </Box>
  );
}
