// Four-Token Page (四元 Token 管理)
// Implements: 算元 (Calc-Token), 智元 (Wit-Token), 词元 (Word-Token), 通证 (Pass-Token)
// Based on papers:
//   ① 联邦宇宙的化身合体 (Four-Token Unified Field Theory)
//   ② 7G、AgentWeb 与 FPGA 优先 (Φ-field Carrier)
//   ③ 联邦宇宙即未来 (Fediverse as Φ-field Natural Channel)

import React, { useState, useEffect, useCallback } from 'react";
import {
  Box,
  Paper,
  Typography,
  Button,
  Card,
  CardContent,
  CardActions,
  Grid,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  LinearProgress,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  List,
  ListItem,
  ListItemText,
  Divider
} from '@mui/material";
import ExpandMoreIcon from '@mui/icons-material/ExpandMore";

interface Token {
  id: string;
  tokenId: string;
  type: string;
  subType?: string;
  amount?: number;
  status: string;
  genesisActivity?: string;
  issuedAt: string;
  consumedAt?: string;
  settledAt?: string;
  expiredAt?: string;
  recycledAt?: string;
}

interface TokenIssuance {
  id: string;
  activityId: string;
  tokenType: string;
  amount?: number;
  phaseWinding?: number;
  windingNumber?: number;
  issuedAt: string;
}

export default function TokenFour() {
  const [tabValue, setTabValue] = useState(0);
  const [tokens, setTokens] = useState<Token[]>([]);
  const [issuances, setIssuances] = useState<TokenIssuance[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Offer/Accept dialog
  const [offerDialogOpen, setOfferDialogOpen] = useState(false);
  const [acceptDialogOpen, setAcceptDialogOpen] = useState(false);
  const [offerActor, setOfferActor] = useState('');
  const [offerTarget, setOfferTarget] = useState('');
  const [offerData, setOfferData] = useState('');

  // =============== Load Data ===============
  const loadTokens = useCallback(async () => {
    try {
      setLoading(true);
      // This would call GET /api/fediverse/tokens (to be implemented)
      // For now, simulate with mock data
      const mockTokens: Token[] = [
        {
          id: '1',
          tokenId: 'https://agentweb.example/tokens/abc123',
          type: 'CALC',
          subType: 'Calc-AI-Call',
          amount: 10,
          status: 'Active',
          issuedAt: new Date().toISOString()
        },
        {
          id: '2',
          tokenId: 'https://agentweb.example/tokens/def456',
          type: 'WIT',
          subType: 'Wit-RWA',
          amount: 50.0,
          status: 'Settled',
          issuedAt: new Date(Date.now() - 86400000).toISOString(),
          settledAt: new Date().toISOString()
        },
        {
          id: '3',
          tokenId: 'https://agentweb.example/tokens/ghi789',
          type: 'WORD',
          subType: 'Word-LLM-Context',
          amount: 1000,
          status: 'Consumed',
          issuedAt: new Date(Date.now() - 172800000).toISOString(),
          consumedAt: new Date(Date.now() - 86400000).toISOString()
        },
        {
          id: '4',
          tokenId: 'https://agentweb.example/tokens/jkl012',
          type: 'PASS',
          subType: 'Pass-DID-Session',
          status: 'Active',
          issuedAt: new Date().toISOString()
        }
      ];
      setTokens(mockTokens);
    } catch (err: any) {
      setError(err.message || 'Failed to load tokens');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadIssuances = useCallback(async () => {
    try {
      setLoading(true);
      // This would call GET /api/fediverse/token-issuances (to be implemented)
      const mockIssuances: TokenIssuance[] = [
        {
          id: '1',
          activityId: 'act1',
          tokenType: 'CALC',
          amount: 10,
          phaseWinding: 1.2,
          windingNumber: 1,
          issuedAt: new Date().toISOString()
        }
      ];
      setIssuances(mockIssuances);
    } catch (err: any) {
      setError(err.message || 'Failed to load issuances');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTokens();
    loadIssuances();
  }, [loadTokens, loadIssuances]);

  // =============== Handlers ===============
  const handleOffer = async () => {
    try {
      setLoading(true);
      // This would call POST /api/fediverse/offer
      console.log('Offer:', offerActor, '→', offerTarget, offerData);
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      alert(`✓ Offer created!\n\nBased on 论文①: 相位梯度累积中...\nWaiting for Accept to trigger 交易即发行`);
      
      setOfferDialogOpen(false);
      setOfferActor('');
      setOfferTarget('');
      setOfferData('');
      loadTokens();
    } catch (err: any) {
      setError(err.message || 'Failed to create offer');
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async (issuanceId: string) => {
    try {
      setLoading(true);
      // This would call POST /api/fediverse/accept
      console.log('Accepting issuance:', issuanceId);
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      alert(`✓ Token issued by transaction (交易即发行)!\n\nBased on 论文①: 相位满周 → 拓扑相变 → Token 被创造`);
      
      loadTokens();
    } catch (err: any) {
      setError(err.message || 'Failed to accept offer');
    } finally {
      setLoading(false);
    }
  };

  const handleConsume = async (tokenId: string) => {
    try {
      setLoading(true);
      // This would call POST /api/fediverse/consume
      console.log('Consuming token:', tokenId);
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      alert(`✓ Token consumed (波核耗散)!\n\nBased on 论文①: 算元/词元 回收（能量回归背景场)`);
      
      loadTokens();
    } catch (err: any) {
      setError(err.message || 'Failed to consume token');
    } finally {
      setLoading(false);
    }
  };

  const handleReward = async (tokenId: string) => {
    try {
      setLoading(true);
      // This would call POST /api/fediverse/reward
      console.log('Rewarding with token:', tokenId);
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      alert(`✓ Reward distributed (粒核转移)!\n\nBased on 论文①: 智元/通证 回收（结算/转移)`);
      
      loadTokens();
    } catch (err: any) {
      setError(err.message || 'Failed to reward');
    } finally {
      setLoading(false);
    }
  };

  // =============== Render ===============
  if (loading && tokens.length === 0) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="80vh">
        <LinearProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3, maxWidth: 1200, margin: '0 auto' }}>
      {/* Header */}
      <Typography variant="h4" gutterBottom>
        四元 Token 系统 (Four-Token System)
      </Typography>
      <Typography variant="subtitle1" color="text.secondary" paragraph>
        基于论文①："一现象，三视界"的算元、智元、词元、通证统一场论<br/>
        交易即发行 (Issue by Transaction) | 流转即回收 (Recycling as Flow)
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Tabs */}
      <Grid container spacing={3} sx={{ mt: 2 }}>
        <Grid item xs={12} display="flex" justifyContent="flex-end">
          <Button
            variant="contained"
            onClick={() => setOfferDialogOpen(true)}
          >
            发起 Offer (交易即发行)
          </Button>
        </Grid>

        {/* Token Type Cards */}
        <Grid item xs={12} md={6} lg={3}>
          <Card>
            <CardContent>
              <Typography variant="h6" color="primary">算元 (Calc-Token)</Typography>
              <Chip label="波核 (Wave Kernel)" color="primary" size="small" sx={{ mt: 1, mb: 1 }} />
              <Typography variant="body2" paragraph>
                连续、耗散、过程性<br/>
                AI 调用额度、电量
              </Typography>
              <Typography variant="subtitle2" gutterBottom>
                生命周期
              </Typography>
              <LinearProgress variant="determinate" value={70} sx={{ mb: 1 }} />
              <Typography variant="caption">
                交易即发行 → 活跃 → <strong>流转即回收 (Consume)</strong>
              </Typography>
            </CardContent>
            <CardActions>
              <Button size="small" onClick={() => handleOffer('alice', 'traffic-ai')}>
                发起 Offer
              </Button>
            </CardActions>
          </Card>
        </Grid>

        <Grid item xs={12} md={6} lg={3}>
          <Card>
            <CardContent>
              <Typography variant="h6" color="primary">智元 (Wit-Token)</Typography>
              <Chip label="粒核 (Particle Kernel)" color="secondary" size="small" sx={{ mt: 1, mb: 1 }} />
              <Typography variant="body2" paragraph>
                离散、稳定、结果性<br/>
                链上结算、RWA 资产
              </Typography>
              <Typography variant="subtitle2" gutterBottom>
                生命周期
              </Typography>
              <LinearProgress variant="determinate" value={50} sx={{ mb: 1 }} />
              <Typography variant="caption">
                交易即发行 → 活跃 → <strong>流转即回收 (Reward/Settle)</strong>
              </Typography>
            </CardContent>
            <CardActions>
              <Button size="small" onClick={() => handleReward('token1')}>
                发放 Reward
              </Button>
            </CardActions>
          </Card>
        </Grid>

        <Grid item xs={12} md={6} lg={3}>
          <Card>
            <CardContent>
              <Typography variant="h6" color="primary">词元 (Word-Token)</Typography>
              <Chip label="波核 (Wave Kernel)" color="primary" size="small" sx={{ mt: 1, mb: 1 }} />
              <Typography variant="body2" paragraph>
                信息密度、上下文、流<br/>
                LLM 上下文、数据流
              </Typography>
              <Typography variant="subtitle2" gutterBottom>
                生命周期
              </Typography>
              <LinearProgress variant="determinate" value={60} sx={{ mb: 1 }} />
              <Typography variant="caption">
                交易即发行 → 活跃 → <strong>流转即回收 (Consume/Archive)</strong>
              </Typography>
            </CardContent>
            <CardActions>
              <Button size="small" onClick={() => handleConsume('token3')}>
                消耗 (Consume)
              </Button>
            </CardActions>
          </Card>
        </Grid>

        <Grid item xs={12} md={6} lg={3}>
          <Card>
            <CardContent>
              <Typography variant="h6" color="primary">通证 (Pass-Token)</Typography>
              <Chip label="粒核 (Particle Kernel)" color="secondary" size="small" sx={{ mt: 1, mb: 1 }} />
              <Typography variant="body2" paragraph>
                确权、准入、边界<br/>
                DID、会员权益、会话凭证
              </Typography>
              <Typography variant="subtitle2" gutterBottom>
                生命周期
              </Typography>
              <LinearProgress variant="determinate" value={40} sx={{ mb: 1 }} />
              <Typography variant="caption">
                交易即发行 → 活跃 → <strong>流转即回收 (Expire/Revoke)</strong>
              </Typography>
            </CardContent>
            <CardActions>
              <Button size="small" onClick={() => handleConsume('token4')}>
                过期 (Expire)
              </Button>
            </CardActions>
          </Card>
        </Grid>

        {/* Token List */}
        <Grid item xs={12}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              Token 列表 (Lifecycle Management)
            </Typography>
            <List>
              {tokens.map((token, index) => (
                <React.Fragment key={token.id}>
                  <ListItem alignItems="flex-start">
                    <ListItemText
                      primary={
                        <span>
                          <strong>{token.type}</strong> - {token.tokenId}
                          <Chip label={token.status} size="small" color={getStatusColor(token.status)} sx={{ ml: 1 }} />
                        </span>
                      }
                      secondary={
                        <span>
                          SubType: {token.subType || 'N/A'}<br/>
                          Amount: {token.amount || 'N/A'}<br/>
                          Issued: {new Date(token.issuedAt).toLocaleString()}<br/>
                          {token.consumedAt && `Consumed: ${new Date(token.consumedAt).toLocaleString()}`}
                          {token.settledAt && `Settled: ${new Date(token.settledAt).toLocaleString()}`}
                          <br/>
                          <em>Based on 论文①: JIT issuance (交易即发行) + Phase winding detection</em>
                        </span>
                      }
                    />
                    <Box>
                      {(token.type === 'CALC' || token.type === 'WORD') && token.status === 'Active' && (
                        <Button size="small" onClick={() => handleConsume(token.id)}>
                          消耗 (Consume)
                        </Button>
                      )}
                      {token.type === 'WIT' && token.status === 'Active' && (
                        <Button size="small" onClick={() => handleReward(token.id)}>
                          结算 (Settle)
                        </Button>
                      )}
                    </Box>
                  </ListItem>
                  {index < tokens.length - 1 && <Divider variant="inset" component="li" />}
                </React.Fragment>
              ))}
            </List>
          </Paper>
        </Grid>

        {/* Token Issuance List (交易即发行) */}
        <Grid item xs={12}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              Token 发行记录 (交易即发行)
            </Typography>
            <Typography variant="body2" color="text.secondary" paragraph>
              基于论文①：Token 通过交易（相位缠绕）被创造，而非预先铸造
            </Typography>
            <List>
              {issuances.map((issuance, index) => (
                <React.Fragment key={issuance.id}>
                  <ListItem alignItems="flex-start">
                    <ListItemText
                      primary={
                        <span>
                          <strong>{issuance.tokenType}</strong> - Activity: {issuance.activityId}
                          <Chip label={`Phase: ${issuance.phaseWinding?.toFixed(2) || 'N/A'}`} size="small" color="primary" sx={{ ml: 1 }} />
                          <Chip label={`Winding: ${issuance.windingNumber || 'N/A'}`} size="small" color="secondary" sx={{ ml: 1 }} />
                        </span>
                      }
                      secondary={
                        <span>
                          Amount: {issuance.amount || 'N/A'}<br/>
                          Issued: {new Date(issuance.issuedAt).toLocaleString()}<br/>
                          <em>Based on 论文①: 缠绕数 (Winding Number) >=1 → 拓扑相变 → Token 发行</em>
                        </span>
                      }
                    />
                    <Box>
                      <Button size="small" onClick={() => handleAccept(issuance.id)}>
                        接受 Accept (触发发行)
                      </Button>
                    </Box>
                  </ListItem>
                  {index < issuances.length - 1 && <Divider variant="inset" component="li" />}
                </React.Fragment>
              ))}
            </List>
          </Paper>
        </Grid>
      </Grid>

      {/* Offer Dialog */}
      <Dialog open={offerDialogOpen} onClose={() => setOfferDialogOpen(false)}>
        <DialogTitle>发起 Offer (交易即发行)</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Actor (发送者)"
            fullWidth
            value={offerActor}
            onChange={(e) => setOfferActor(e.target.value)}
            sx={{ mb: 2 }}
          />
          <TextField
            margin="dense"
            label="Target (接收者)"
            fullWidth
            value={offerTarget}
            onChange={(e) => setOfferTarget(e.target.value)}
            sx={{ mb: 2 }}
          />
          <TextField
            margin="dense"
            label="Offer Data (JSON)"
            fullWidth
            multiline
            rows={4}
            value={offerData}
            onChange={(e) => setOfferData(e.target.value)}
            helperText='Example: {"type":"Calc-Token", "amount":10}'
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOfferDialogOpen(false)}>取消</Button>
          <Button onClick={handleOffer} variant="contained">发起 Offer</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

// =============== Helper Functions ===============

function getStatusColor(status: string): "default" | "primary" | "secondary" | "error" | "info" | "success" | "warning" {
  switch (status) {
    case 'Null': return 'default';
    case 'Issued': return 'info';
    case 'Active': return 'success';
    case 'Consumed': return 'warning';
    case 'Settled': return 'secondary';
    case 'Expired': return 'error';
    case 'Recycled': return 'default';
    default: return 'default';
  }
}
