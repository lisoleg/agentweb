// Fediverse Page (ActivityPub Protocol)
// Implements: 联邦宇宙 (Fediverse) based on ActivityPub protocol
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
  TextFiled,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Avatar,
  Chip,
  Card,
  CardContent,
  CardActions,
  Grid,
  Tab,
  Tabs,
  Alert,
  CircularProgress
} from '@mui/material";
import { api } from '../services/api";

interface Actor {
  id: string;
  did: string;
  username: string;
  type: string;
  inbox: string;
  outbox: string;
  calcToken: number;
  witToken: string;
  wordTokenUsed: number;
  passToken: string;
}

interface Activity {
  id: string;
  type: string;
  actor: string;
  object?: string;
  publishedAt: string;
}

export default function Fediverse() {
  const [tabValue, setTabValue] = useState(0);
  const [actors, setActors] = useState<Actor[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Create Actor dialog
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newType, setNewType] = useState('Person');
  
  // Follow dialog
  const [followDialogOpen, setFollowDialogOpen] = useState(false);
  const [followUsername, setFollowUsername] = useState('');
  const [followTarget, setFollowTarget] = useState('');

  // =============== Load Data ===============
  const loadActors = useCallback(async () => {
    try {
      setLoading(true);
      // This would call GET /api/fediverse/actor/:username
      // For now, simulate with mock data
      const mockActors: Actor[] = [
        {
          id: '1',
          did: 'did:agentweb:abc123',
          username: 'alice',
          type: 'Person',
          inbox: '/api/fediverse/inbox/alice',
          outbox: '/api/fediverse/outbox/alice',
          calcToken: 100,
          witToken: '50.0',
          wordTokenUsed: 0,
          passToken: 'pass_abc'
        },
        {
          id: '2',
          did: 'did:agentweb:def456',
          username: 'bob',
          type: 'Person',
          inbox: '/api/fediverse/inbox/bob',
          outbox: '/api/fediverse/outbox/bob',
          calcToken: 50,
          witToken: '25.0',
          wordTokenUsed: 10,
          passToken: 'pass_def'
        },
        {
          id: '3',
          did: 'did:agentweb:789xyz',
          username: 'traffic-ai',
          type: 'Service',
          inbox: '/api/fediverse/inbox/traffic-ai',
          outbox: '/api/fediverse/outbox/traffic-ai',
          calcToken: 1000,
          witToken: '500.0',
          wordTokenUsed: 500,
          passToken: 'pass_789'
        }
      ];
      setActors(mockActors);
    } catch (err: any) {
      setError(err.message || 'Failed to load actors');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadActivities = useCallback(async () => {
    try {
      setLoading(true);
      // This would call GET /api/fediverse/outbox/:username
      const mockActivities: Activity[] = [
        {
          id: 'act1',
          type: 'Create',
          actor: 'alice',
          object: 'Note: Hello Fediverse!',
          publishedAt: new Date().toISOString()
        },
        {
          id: 'act2',
          type: 'Follow',
          actor: 'alice',
          object: 'bob',
          publishedAt: new Date(Date.now() - 3600000).toISOString()
        },
        {
          id: 'act3',
          type: 'Offer',
          actor: 'alice',
          object: 'traffic-ai',
          publishedAt: new Date(Date.now() - 7200000).toISOString()
        }
      ];
      setActivities(mockActivities);
    } catch (err: any) {
      setError(err.message || 'Failed to load activities');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadActors();
    loadActivities();
  }, [loadActors, loadActivities]);

  // =============== Handlers ===============
  const handleCreateActor = async () => {
    try {
      setLoading(true);
      // This would call POST /api/fediverse/actor
      console.log('Creating actor:', newUsername, newType);
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      alert(`✓ Actor created successfully!\n\nUsername: ${newUsername}\nType: ${newType}\n\nBased on 论文①: 四元 Token 已初始化 (算元: 0, 智元: 0, 词元: 0, 通证: null)`);
      
      setCreateDialogOpen(false);
      setNewUsername('');
      loadActors();
    } catch (err: any) {
      setError(err.message || 'Failed to create actor');
    } finally {
      setLoading(false);
    }
  };

  const handleFollow = async () => {
    try {
      setLoading(true);
      // This would call POST /api/fediverse/follow
      console.log('Following:', followUsername, '→', followTarget);
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      alert(`✓ Followed successfully!\n\n${followUsername} now follows ${followTarget}\n\nBased on 论文②: Φ 流贯算子 (Ftel Operator) established`);
      
      setFollowDialogOpen(false);
      setFollowUsername('');
      setFollowTarget('');
      loadActivities();
    } catch (err: any) {
      setError(err.message || 'Failed to follow');
    } finally {
      setLoading(false);
    }
  };

  const handleOffer = async (actorUsername: string, targetUsername: string) => {
    try {
      setLoading(true);
      // This would call POST /api/fediverse/offer
      console.log('Offer:', actorUsername, '→', targetUsername);
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      alert(`✓ Offer created!\n\n${actorUsername} offered to ${targetUsername}\n\nBased on 论文①: 相位梯度累积中... Waiting for Accept to trigger 交易即发行`);
      
      loadActivities();
    } catch (err: any) {
      setError(err.message || 'Failed to create offer');
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async (actorUsername: string, offerActivityId: string) => {
    try {
      setLoading(true);
      // This would call POST /api/fediverse/accept
      console.log('Accept:', actorUsername, '→', offerActivityId);
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      alert(`✓ Accept created! Token issued!\n\nBased on 论文①: 交易即发行 (Issuance by Transaction)\n相位满周 → 拓扑相变 → Token 被创造`);
      
      loadActivities();
    } catch (err: any) {
      setError(err.message || 'Failed to accept offer');
    } finally {
      setLoading(false);
    }
  };

  // =============== Render ===============
  if (loading && actors.length === 0) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="80vh">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3, maxWidth: 1200, margin: '0 auto' }}>
      {/* Header */}
      <Typography variant="h4" gutterBottom>
        联邦宇宙 (Fediverse) - ActivityPub 协议
      </Typography>
      <Typography variant="subtitle1" color="text.secondary" paragraph>
        基于论文①："一现象，三视界"的 Fediverse 即未来<br/>
        基于论文②：7G 作为 Φ 场低耗散共振介质<br/>
        基于论文③：联邦宇宙的化身合体 (四元 Token 统一场论)
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Tabs */}
      <Tabs value={tabValue} onChange={(_, v) => setTabValue(v)} sx={{ mb: 3 }}>
        <Tab label="Actors (化身)" />
        <Tab label="Activities (活动)" />
        <Tab label="Four-Token (四元 Token)" />
        <Tab label="IGCTR (三元共振)" />
      </Tabs>

      {/* Tab 0: Actors */}
      {tabValue === 0 && (
        <Grid container spacing={3}>
          <Grid item xs={12} display="flex" justifyContent="flex-end">
            <Button
              variant="contained"
              onClick={() => setCreateDialogOpen(true)}
            >
              创建 Actor (化身)
            </Button>
            <Button
              variant="outlined"
              sx={{ ml: 2 }}
              onClick={() => setFollowDialogOpen(true)}
            >
              关注 (Follow)
            </Button>
          </Grid>

          {actors.map(actor => (
            <Grid item xs={12} md={6} lg={4} key={actor.id}>
              <Card>
                <CardContent>
                  <Box display="flex" alignItems="center" mb={2}>
                    <Avatar sx={{ mr: 2 }}>
                      {actor.username.charAt(0).toUpperCase()}
                    </Avatar>
                    <Box>
                      <Typography variant="h6">{actor.username}</Typography>
                      <Chip label={actor.type} size="small" color="primary" />
                    </Box>
                  </Box>
                  
                  <Typography variant="body2" color="text.secondary" paragraph>
                    DID: {actor.did}
                  </Typography>
                  
                  <Typography variant="subtitle2" gutterBottom>
                    四元 Token 钱包 (Four-Token Wallet)
                  </Typography>
                  <Box sx={{ pl: 2 }}>
                    <Typography variant="body2">算元 (Calc): {actor.calcToken}</Typography>
                    <Typography variant="body2">智元 (Wit): {actor.witToken}</Typography>
                    <Typography variant="body2">词元 (Word): {actor.wordTokenUsed} used</Typography>
                    <Typography variant="body2">通证 (Pass): {actor.passToken || 'null'}</Typography>
                  </Box>
                </CardContent>
                <CardActions>
                  <Button size="small" onClick={() => handleOffer(actor.username, 'traffic-ai')}>
                    发起 Offer
                  </Button>
                  <Button size="small" onClick={() => handleAccept(actor.username, 'act3')}>
                    接受 Accept
                  </Button>
                </CardActions>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Tab 1: Activities */}
      {tabValue === 1 && (
        <List>
          {activities.map(activity => (
            <ListItem key={activity.id} divider>
              <ListItemAvatar>
                <Avatar>
                  {(activity.actor || '?').charAt(0).toUpperCase()}
                </Avatar>
              </ListItemAvatar>
              <ListItemText
                primary={
                  <span>
                    <strong>{activity.actor}</strong>
                    {` ${activity.type}d `}
                    <strong>{activity.object || '(no object)'}</strong>
                  </span>
                }
                secondary={
                  <span>
                    {new Date(activity.publishedAt).toLocaleString()}
                    <br/>
                    <em>Based on 论文①: ActivityPub 动词驱动 Φ 场动力学 (中视界)</em>
                  </span>
                }
              />
              <Chip label={activity.type} size="small" />
            </ListItem>
          ))}
        </List>
      )}

      {/* Tab 2: Four-Token */}
      {tabValue === 2 && (
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>
            四元 Token 统一场论 (Four-Token Unified Field Theory)
          </Typography>
          <Typography variant="body2" paragraph>
            基于论文①：算元、智元、词元、通证是同一 Φ 场（信息相位场）的四种拓扑激发态
          </Typography>
          
          <Grid container spacing={3} sx={{ mt: 2 }}>
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" color="primary">算元 (Calc-Token)</Typography>
                  <Typography variant="body2" paragraph>
                    <strong>波核 (Wave Kernel)</strong><br/>
                    连续、耗散、过程性<br/>
                    AI 服务调用、API 额度、电量
                  </Typography>
                  <Chip label="交易即发行" color="primary" />
                  <Chip label="流转即回收" color="secondary" sx={{ ml: 1 }} />
                </CardContent>
              </Card>
            </Grid>
            
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" color="primary">智元 (Wit-Token)</Typography>
                  <Typography variant="body2" paragraph>
                    <strong>粒核 (Particle Kernel)</strong><br/>
                    离散、稳定、结果性<br/>
                    链上结算、RWA 资产、信用积分
                  </Typography>
                  <Chip label="结算转移" color="primary" />
                  <Chip label="核销回收" color="secondary" sx={{ ml: 1 }} />
                </CardContent>
              </Card>
            </Grid>
            
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" color="primary">词元 (Word-Token)</Typography>
                  <Typography variant="body2" paragraph>
                    <strong>波核 (Wave Kernel)</strong><br/>
                    信息密度、上下文、流<br/>
                    LLM 上下文、数据流、消息体
                  </Typography>
                  <Chip label="语义相干" color="primary" />
                  <Chip label="滑动窗口" color="secondary" sx={{ ml: 1 }} />
                </CardContent>
              </Card>
            </Grid>
            
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" color="primary">通证 (Pass-Token)</Typography>
                  <Typography variant="body2" paragraph>
                    <strong>粒核 (Particle Kernel)</strong><br/>
                    确权、准入、边界<br/>
                    DID、会员权益、治理票、会话凭证
                  </Typography>
                  <Chip label="身份绑定" color="primary" />
                  <Chip label="会话过期" color="secondary" sx={{ ml: 1 }} />
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </Paper>
      )}

      {/* Tab 3: IGCTR */}
      {tabValue === 3 && (
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>
            IGCTR (信息-几何-意识三元共振)
          </Typography>
          <Typography variant="body2" paragraph>
            基于论文②：AgentWeb 三元共振定理<br/>
            Resonance = ∫∫ I(φ,g,c) dφ dg dc
          </Typography>
          
          <Grid container spacing={3} sx={{ mt: 2 }}>
            <Grid item xs={12} md={4}>
              <Card>
                <CardContent>
                  <Typography variant="h6" color="info">信息场 (Info Field)</Typography>
                  <Typography variant="body2">
                    Φ 场（Token/消息）低耗散流动<br/>
                    对应：四元 Token 的相位梯度传播
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            
            <Grid item xs={12} md={4}>
              <Card>
                <CardContent>
                  <Typography variant="h6" color="success">几何场 (Geometry Field)</Typography>
                  <Typography variant="body2">
                    G 场（节点/链路/FPGA 资源）可重构适配<br/>
                    对应：FPGA 部分可重构（Partial Reconfiguration）
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            
            <Grid item xs={12} md={4}>
              <Card>
                <CardContent>
                  <Typography variant="h6" color="warning">意识场 (Consciousness Field)</Typography>
                  <Typography variant="body2">
                    C 场（Agent 策略/人意图）可问、可显、可追责<br/>
                    对应：化身合体（Avatar Fusion）的可问性
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
          
          <Box sx={{ mt: 3 }}>
            <Typography variant="h6" gutterBottom>
              一现象三视界 (One Phenomenon, Three Horizons)
            </Typography>
            <Typography variant="body2" paragraph>
              <strong>微观界 (Micro):</strong> Φ 场的拓扑激发/重配（波核/粒核区分）<br/>
              <strong>中视界 (Meso):</strong> ActivityPub 动词驱动（交易即发行/流转即回收）<br/>
              <strong>宏观界 (Macro):</strong> 意识场决定可问性/可显性（化身合体进度）
            </Typography>
          </Box>
        </Paper>
      )}

      {/* Create Actor Dialog */}
      <Dialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)}>
        <DialogTitle>创建 Actor (化身)</DialogTitle>
        <DialogContent>
          <TextFiled
            autoFocus
            margin="dense"
            label="Username (用户名)"
            fullWidth
            value={newUsername}
            onChange={(e) => setNewUsername(e.target.value)}
            sx={{ mb: 2 }}
          />
          <TextFiled
            margin="dense"
            label="Type (类型)"
            fullWidth
            value={newType}
            onChange={(e) => setNewType(e.target.value)}
            helperText="Person | Service | Application | Agent"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateDialogOpen(false)}>取消</Button>
          <Button onClick={handleCreateActor} variant="contained">创建</Button>
        </DialogActions>
      </Dialog>

      {/* Follow Dialog */}
      <Dialog open={followDialogOpen} onClose={() => setFollowDialogOpen(false)}>
        <DialogTitle>关注 (Follow)</DialogTitle>
        <DialogContent>
          <TextFiled
            autoFocus
            margin="dense"
            label="Follower (关注者)"
            fullWidth
            value={followUsername}
            onChange={(e) => setFollowUsername(e.target.value)}
            sx={{ mb: 2 }}
          />
          <TextFiled
            margin="dense"
            label="Following (被关注者)"
            fullWidth
            value={followTarget}
            onChange={(e) => setFollowTarget(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setFollowDialogOpen(false)}>取消</Button>
          <Button onClick={handleFollow} variant="contained">关注</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
