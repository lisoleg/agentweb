import React from 'react';
import { 
  Box, 
  Typography, 
  Card, 
  CardContent, 
  CardActions,
  Button, 
  Chip,
  Avatar,
  Grid,
  IconButton,
  Tooltip
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import PersonIcon from '@mui/icons-material/Person';
import SettingsIcon from '@mui/icons-material/Settings';

interface Agent {
  id: string;
  name: string;
  description?: string;
  owner: string;
  capabilities: string[];
  reputation: number;
  status: 'active' | 'inactive' | 'suspended';
  phiValue?: number;
  createdAt: string;
  updatedAt: string;
}

interface AgentCardProps {
  agent: Agent;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
  onViewDetails?: (id: string) => void;
  onConfigure?: (id: string) => void;
  isOwner?: boolean;
}

export const AgentCard: React.FC<AgentCardProps> = ({
  agent,
  onEdit,
  onDelete,
  onViewDetails,
  onConfigure,
  isOwner = false
}) => {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'success';
      case 'inactive': return 'default';
      case 'suspended': return 'error';
      default: return 'default';
    }
  };

  const getReputationColor = (reputation: number) => {
    if (reputation >= 0.8) return '#4caf50';
    if (reputation >= 0.5) return '#ff9800';
    return '#f44336';
  };

  return (
    <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <CardContent sx={{ flex: 1 }}>
        {/* Agent头部 */}
        <Box sx={{ display: 'flex', alignItems: 'flex-start', mb: 2 }}>
          <Avatar sx={{ bgcolor: 'primary.main', mr: 2 }}>
            <PersonIcon />
          </Avatar>
          <Box sx={{ flex: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
              <Typography variant="h6" component="div" sx={{ fontWeight: 'bold' }}>
                {agent.name}
              </Typography>
              {agent.status === 'active' && (
                <CheckCircleIcon color="success" fontSize="small" />
              )}
            </Box>
            <Chip
              label={agent.status}
              color={getStatusColor(agent.status)}
              size="small"
            />
          </Box>
        </Box>

        {/* 描述 */}
        {agent.description && (
          <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
            {agent.description}
          </Typography>
        )}

        {/* 能力标签 */}
        {agent.capabilities.length > 0 && (
          <Box sx={{ mb: 2 }}>
            <Typography variant="caption" color="textSecondary" gutterBottom>
              能力
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
              {agent.capabilities.map((cap, index) => (
                <Chip
                  key={index}
                  label={cap}
                  size="small"
                  variant="outlined"
                />
              ))}
            </Box>
          </Box>
        )}

        {/* 指标 */}
        <Grid container spacing={1}>
          <Grid item xs={6}>
            <Box sx={{ p: 1, bgcolor: '#f5f5f5', borderRadius: 1 }}>
              <Typography variant="caption" color="textSecondary">
                信誉
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Box
                  sx={{
                    width: 40,
                    height: 4,
                    bgcolor: '#e0e0e0',
                    borderRadius: 2,
                    overflow: 'hidden'
                  }}
                >
                  <Box
                    sx={{
                      width: `${agent.reputation * 100}%`,
                      height: '100%',
                      bgcolor: getReputationColor(agent.reputation)
                    }}
                  />
                </Box>
                <Typography variant="body2" fontWeight="bold">
                  {(agent.reputation * 100).toFixed(0)}%
                </Typography>
              </Box>
            </Box>
          </Grid>
          
          {agent.phiValue !== undefined && (
            <Grid item xs={6}>
              <Box sx={{ p: 1, bgcolor: '#f5f5f5', borderRadius: 1 }}>
                <Typography variant="caption" color="textSecondary">
                  Φ 值
                </Typography>
                <Typography variant="body2" fontWeight="bold" color="primary">
                  {agent.phiValue.toFixed(3)}
                </Typography>
              </Box>
            </Grid>
          )}
        </Grid>

        {/* 所有者 */}
        <Box sx={{ mt: 2 }}>
          <Typography variant="caption" color="textSecondary">
            所有者
          </Typography>
          <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
            {agent.owner.slice(0, 10)}...{agent.owner.slice(-8)}
          </Typography>
        </Box>
      </CardContent>

      {/* 操作按钮 */}
      <CardActions sx={{ justifyContent: 'space-between', px: 2, pb: 2 }}>
        <Button
          size="small"
          onClick={() => onViewDetails?.(agent.id)}
        >
          详情
        </Button>
        
        {isOwner && (
          <Box>
            <Tooltip title="配置">
              <IconButton size="small" onClick={() => onConfigure?.(agent.id)}>
                <SettingsIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="编辑">
              <IconButton size="small" onClick={() => onEdit?.(agent.id)}>
                <EditIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="删除">
              <IconButton size="small" color="error" onClick={() => onDelete?.(agent.id)}>
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        )}
      </CardActions>
    </Card>
  );
};

export default AgentCard;
