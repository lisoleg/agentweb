/**
 * RelayPanel — V12.0 通算一体分布式中继管理面板
 * 中继节点列表 + 注册 + 智能路由 + 动态费率
 */

import React, { useState, useEffect } from 'react';
import {
  Box, Card, CardContent, Typography, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, Paper,
  Chip, Button, TextField, Select, MenuItem, FormControl,
  InputLabel, Grid, Alert, LinearProgress,
} from '@mui/material';
import { apiClient } from '../services/api';

interface RelayNode {
  address: string;
  stakeAmount: string;
  computeCapacity: number;
  reputationScore: number;
  feeRate: number;
  isActive: boolean;
  supportedChains: number[];
}

interface FeeSchedule {
  baseFee: number;
  congestionFactor: number;
  computeFactor: number;
  totalMultiplier: number;
  updatedAt: string;
}

const RelayPanel: React.FC = () => {
  const [nodes, setNodes] = useState<RelayNode[]>([]);
  const [feeSchedule, setFeeSchedule] = useState<FeeSchedule | null>(null);
  const [loading, setLoading] = useState(false);

  // 注册表单
  const [computeCapacity, setComputeCapacity] = useState(5000);
  const [feeRate, setFeeRate] = useState(100);
  const [targetChain, setTargetChain] = useState(1);

  // 路由查询
  const [routeSource, setRouteSource] = useState(1);
  const [routeTarget, setRouteTarget] = useState(137);
  const [routeResult, setRouteResult] = useState<any>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [nodesRes, feesRes] = await Promise.all([
        apiClient.get('/v12/relay/nodes'),
        apiClient.get('/v12/relay/fees'),
      ]);
      if (nodesRes.data?.code === 0) setNodes(nodesRes.data.data.nodes || []);
      if (feesRes.data?.code === 0) setFeeSchedule(feesRes.data.data);
    } catch (err) {
      console.error('Failed to load relay data:', err);
    }
    setLoading(false);
  };

  const handleRoute = async () => {
    try {
      const res = await apiClient.post('/v12/relay/route', {
        sourceChainId: routeSource,
        targetChainId: routeTarget,
        taskType: 'MESSAGE_RELAY',
        strategy: 'BALANCED',
      });
      if (res.data?.code === 0) setRouteResult(res.data.data);
    } catch (err) {
      console.error('Route query failed:', err);
    }
  };

  const getStatusColor = (isActive: boolean, reputation: number) => {
    if (!isActive) return 'default';
    if (reputation >= 8000) return 'success';
    if (reputation >= 4000) return 'warning';
    return 'error';
  };

  const getStatusLabel = (isActive: boolean, reputation: number) => {
    if (!isActive) return '离线';
    if (reputation >= 8000) return '优质';
    if (reputation >= 4000) return '正常';
    return '低质';
  };

  return (
    <Box>
      <Typography variant="h5" gutterBottom>
        🌐 通算一体分布式中继网络
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        6GNetGPT"分布式算力+众筹协作"思想 — 中继节点=消息传递+边缘算力
      </Typography>

      {/* 费率仪表盘 */}
      {feeSchedule && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6">📊 动态费率</Typography>
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={3}>
                <Typography variant="body2" color="text.secondary">基础费率</Typography>
                <Typography variant="h6">{feeSchedule.baseFee} bps</Typography>
              </Grid>
              <Grid item xs={3}>
                <Typography variant="body2" color="text.secondary">拥堵因子</Typography>
                <Typography variant="h6">{feeSchedule.congestionFactor}x</Typography>
              </Grid>
              <Grid item xs={3}>
                <Typography variant="body2" color="text.secondary">计算因子</Typography>
                <Typography variant="h6">{feeSchedule.computeFactor}x</Typography>
              </Grid>
              <Grid item xs={3}>
                <Typography variant="body2" color="text.secondary">总乘数</Typography>
                <Typography variant="h6" color="primary">{feeSchedule.totalMultiplier} bps</Typography>
              </Grid>
            </Grid>
            <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
              更新于: {feeSchedule.updatedAt}
            </Typography>
          </CardContent>
        </Card>
      )}

      {/* 智能路由 */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6">🧭 智能路由</Typography>
          <Grid container spacing={2} sx={{ mt: 1 }} alignItems="center">
            <Grid item xs={3}>
              <TextField label="源链ID" value={routeSource} onChange={e => setRouteSource(Number(e.target.value))} size="small" fullWidth />
            </Grid>
            <Grid item xs={3}>
              <TextField label="目标链ID" value={routeTarget} onChange={e => setRouteTarget(Number(e.target.value))} size="small" fullWidth />
            </Grid>
            <Grid item xs={3}>
              <Button variant="contained" onClick={handleRoute} fullWidth>查询路由</Button>
            </Grid>
          </Grid>
          {routeResult && (
            <Alert severity="success" sx={{ mt: 2 }}>
              最优中继: {routeResult.primaryRelay?.slice(0, 10)}... | 
              估算费率: {routeResult.estimatedFee} bps | 
              可靠性: {(routeResult.reliabilityScore * 100).toFixed(1)}%
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* 中继节点列表 */}
      <Card>
        <CardContent>
          <Typography variant="h6">📡 中继节点</Typography>
          {loading && <LinearProgress sx={{ mt: 1 }} />}
          <TableContainer component={Paper} sx={{ mt: 2 }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>地址</TableCell>
                  <TableCell>算力</TableCell>
                  <TableCell>声誉</TableCell>
                  <TableCell>费率</TableCell>
                  <TableCell>状态</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {nodes.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} align="center">
                      <Typography variant="body2" color="text.secondary">
                        暂无中继节点（合约部署后显示）
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  nodes.map((node, idx) => (
                    <TableRow key={idx}>
                      <TableCell>{node.address.slice(0, 10)}...</TableCell>
                      <TableCell>{node.computeCapacity}</TableCell>
                      <TableCell>
                        <LinearProgress
                          variant="determinate"
                          value={node.reputationScore / 100}
                          color={node.reputationScore >= 8000 ? 'success' : node.reputationScore >= 4000 ? 'warning' : 'error'}
                          sx={{ width: 100 }}
                        />
                      </TableCell>
                      <TableCell>{node.feeRate} bps</TableCell>
                      <TableCell>
                        <Chip
                          label={getStatusLabel(node.isActive, node.reputationScore)}
                          color={getStatusColor(node.isActive, node.reputationScore) as any}
                          size="small"
                        />
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>
    </Box>
  );
};

export default RelayPanel;
