/**
 * LiLiFaPanel — V14.0 情理法三层决策引擎面板
 * 3个Tab: 决策请求 | 规则库 | 历史追溯
 *
 * 法(Protocol)刚性契约 + 理(Procedure)柔性流程 + 情(Human-Override)中道余量
 */

import React, { useState, useEffect } from 'react';
import {
  Box, Card, CardContent, Typography, Grid, Chip,
  Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, Paper, Button, Alert, LinearProgress,
  Tabs, Tab, Divider, Select, MenuItem,
} from '@mui/material';
import GavelIcon from '@mui/icons-material/Gavel';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import FavoriteIcon from '@mui/icons-material/Favorite';
import HistoryIcon from '@mui/icons-material/History';
import ShieldIcon from '@mui/icons-material/Shield';
import apiClient from '../services/api';

// =============== Types ===============

interface DecisionRequest {
  requestId: string;
  agentId: string;
  layer: 'FA' | 'LI' | 'QING';
  description: string;
  status: 'PENDING' | 'LAYER1_REVIEW' | 'LAYER2_REVIEW' | 'HUMAN_REVIEW' | 'APPROVED' | 'REJECTED' | 'OVERRIDDEN';
  createdAt: number;
  resolvedAt?: number;
  finalDecision?: string;
}

interface Rule {
  ruleId: string;
  type: 'LAW' | 'PROCEDURE' | 'HUMAN_OVERRIDE';
  title: string;
  content: string;
  isActive: boolean;
  priority: number;
  createdAt: number;
}

interface DecisionStats {
  totalRequests: number;
  byLayer: Record<string, number>;
  approved: number;
  rejected: number;
  overridden: number;
  avgProcessingTime: number;
}

// =============== Sub-Components ===============

/** 决策请求Tab */
const RequestsTab: React.FC = () => {
  const [requests, setRequests] = useState<DecisionRequest[]>([]);
  const [stats, setStats] = useState<DecisionStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [layerFilter, setLayerFilter] = useState<string>('ALL');

  const fetchData = async () => {
    setLoading(true);
    try {
      const [reqRes, statsRes] = await Promise.all([
        apiClient.get('/v14/li-li-fa/requests'),
        apiClient.get('/v14/li-li-fa/stats'),
      ]);
      if (reqRes.data?.code === 0) setRequests(reqRes.data.data || []);
      if (statsRes.data?.code === 0) setStats(statsRes.data.data);
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const filtered = layerFilter === 'ALL' ? requests :
    requests.filter(r => r.layer === layerFilter);

  const getLayerColor = (l: string) => {
    if (l === 'FA') return '#f44336';
    if (l === 'LI') return '#2196f3';
    return '#4caf50';
  };

  const getStatusColor = (s: string): any => {
    if (s === 'APPROVED') return 'success';
    if (s === 'REJECTED') return 'error';
    if (s === 'OVERRIDDEN') return 'warning';
    if (s === 'HUMAN_REVIEW') return 'info';
    return 'default';
  };

  return (
    <Box>
      {stats && (
        <Grid container spacing={2} sx={{ mb: 2 }}>
          {[
            { label: '总请求', value: stats.totalRequests, color: '#1976d2' },
            { label: '法层(刚性)', value: stats.byLayer?.FA || 0, color: '#f44336' },
            { label: '理层(柔性)', value: stats.byLayer?.LI || 0, color: '#2196f3' },
            { label: '情层(余量)', value: stats.byLayer?.QING || 0, color: '#4caf50' },
            { label: '被推翻', value: stats.overridden, color: '#ff9800' },
          ].map((item, idx) => (
            <Grid item xs={6} md={2.4} key={idx}>
              <Card><CardContent sx={{ textAlign: 'center', py: 1.5 }}>
                <Typography variant="h6" sx={{ color: item.color }}>{item.value}</Typography>
                <Typography variant="caption" color="text.secondary">{item.label}</Typography>
              </CardContent></Card>
            </Grid>
          ))}
        </Grid>
      )}

      <Box sx={{ mb: 2, display: 'flex', gap: 1, alignItems: 'center' }}>
        <Typography variant="subtitle2">筛选:</Typography>
        {['ALL', 'FA', 'LI', 'QING'].map(l => (
          <Chip key={l} label={l === 'ALL' ? '全部' : l === 'FA' ? '法' : l === 'LI' ? '理' : '情'}
            onClick={() => setLayerFilter(l)} color={layerFilter === l ? 'primary' : 'default'} size="small" />
        ))}
        <Button size="small" onClick={fetchData} disabled={loading}>刷新</Button>
      </Box>

      {loading ? <LinearProgress /> : (
        <TableContainer component={Paper} sx={{ maxHeight: 500, overflow: 'auto' }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell>请求ID</TableCell>
                <TableCell>Agent</TableCell>
                <TableCell>层级</TableCell>
                <TableCell>描述</TableCell>
                <TableCell>状态</TableCell>
                <TableCell>创建时间</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filtered.map(r => (
                <TableRow key={r.requestId} hover>
                  <TableCell><code>{r.requestId.slice(0, 12)}...</code></TableCell>
                  <TableCell>{r.agentId}</TableCell>
                  <TableCell>
                    <Chip label={r.layer} size="small"
                      sx={{ bgcolor: getLayerColor(r.layer), color: '#fff' }} />
                  </TableCell>
                  <TableCell sx={{ maxWidth: 250, overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.description}</TableCell>
                  <TableCell><Chip label={r.status} size="small" color={getStatusColor(r.status)} /></TableCell>
                  <TableCell>{new Date(r.createdAt * 1000).toLocaleString()}</TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={7} align="center">暂无决策请求</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
};

/** 规则库Tab */
const RulesTab: React.FC = () => {
  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get('/v14/li-li-fa/rules');
      if (res.data?.code === 0) setRules(res.data.data || []);
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const getTypeIcon = (t: string) => {
    if (t === 'LAW') return <GavelIcon fontSize="small" />;
    if (t === 'PROCEDURE') return <MenuBookIcon fontSize="small" />;
    return <FavoriteIcon fontSize="small" />;
  };

  const getTypeColor = (t: string) => {
    if (t === 'LAW') return '#f44336';
    if (t === 'PROCEDURE') return '#2196f3';
    return '#4caf50';
  };

  return (
    <Box>
      <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="subtitle2">情理法规则库 (太乙AGI双核: 计算核+算计核)</Typography>
        <Button size="small" onClick={fetchData} disabled={loading}>刷新</Button>
      </Box>
      {loading ? <LinearProgress /> : (
        <Grid container spacing={2}>
          {rules.map(rule => (
            <Grid item xs={12} md={6} key={rule.ruleId}>
              <Card variant="outlined" sx={{ borderLeft: 4, borderColor: getTypeColor(rule.type) }}>
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                    <Typography variant="subtitle2">{rule.title}</Typography>
                    <Chip label={rule.isActive ? '启用' : '停用'} size="small"
                      color={rule.isActive ? 'success' : 'default'} />
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
                    {getTypeIcon(rule.type)}
                    <Typography variant="caption" color="text.secondary">
                      {rule.type === 'LAW' ? '法(Protocol)刚性契约' :
                        rule.type === 'PROCEDURE' ? '理(Procedure)柔性流程' : '情(Human-Override)中道余量'}
                    </Typography>
                  </Box>
                  <Typography variant="body2" sx={{ fontSize: '0.85rem' }}>{rule.content}</Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                    优先级: {rule.priority} | 创建: {new Date(rule.createdAt * 1000).toLocaleDateString()}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
          {rules.length === 0 && (
            <Grid item xs={12}><Alert severity="info">暂无规则，情理法引擎等待初始化</Alert></Grid>
          )}
        </Grid>
      )}
    </Box>
  );
};

/** 历史追溯Tab */
const HistoryTab: React.FC = () => {
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get('/v14/li-li-fa/history');
      if (res.data?.code === 0) setHistory(res.data.data || []);
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  return (
    <Box>
      <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="subtitle2">中道智能决策历史 (法规×道义抉择)</Typography>
        <Button size="small" onClick={fetchData} disabled={loading}>刷新</Button>
      </Box>
      {loading ? <LinearProgress /> : (
        <TableContainer component={Paper}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell>请求ID</TableCell>
                <TableCell>最终决策</TableCell>
                <TableCell>各层意见</TableCell>
                <TableCell>推翻原因</TableCell>
                <TableCell>解决时间</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {history.map((h: any) => (
                <TableRow key={h.requestId} hover>
                  <TableCell><code>{h.requestId.slice(0, 12)}...</code></TableCell>
                  <TableCell>
                    <Chip label={h.finalDecision} size="small"
                      color={h.finalDecision === 'APPROVED' ? 'success' : h.finalDecision === 'OVERRIDDEN' ? 'warning' : 'error'} />
                  </TableCell>
                  <TableCell>
                    <Box sx={{ fontSize: '0.8rem' }}>
                      {h.layerOpinions?.map((op: any, i: number) => (
                        <div key={i}>
                          <strong>{op.layer}:</strong> {op.opinion.slice(0, 50)}...
                        </div>
                      ))}
                    </Box>
                  </TableCell>
                  <TableCell sx={{ maxWidth: 200, fontSize: '0.8rem' }}>{h.overrideReason || '-'}</TableCell>
                  <TableCell>{h.resolvedAt ? new Date(h.resolvedAt * 1000).toLocaleString() : '-'}</TableCell>
                </TableRow>
              ))}
              {history.length === 0 && (
                <TableRow><TableCell colSpan={5} align="center">暂无历史记录</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
};

// =============== Main Panel ===============

const LiLiFaPanel: React.FC = () => {
  const [activeTab, setActiveTab] = useState(0);

  return (
    <Box>
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
        <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)}>
          <Tab label="📋 决策请求" />
          <Tab label="📚 规则库" />
          <Tab label="🕒 历史追溯" />
        </Tabs>
      </Box>
      {activeTab === 0 && <RequestsTab />}
      {activeTab === 1 && <RulesTab />}
      {activeTab === 2 && <HistoryTab />}
    </Box>
  );
};

export default LiLiFaPanel;
