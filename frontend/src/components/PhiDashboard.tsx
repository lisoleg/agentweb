import React from 'react';
import { Box, Typography, Card, CardContent, LinearProgress, Grid, Chip, Paper } from '@mui/material';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import PsychologyIcon from '@mui/icons-material/Psychology';

interface PhiData {
  currentValue: number;
  previousValue: number;
  level: 'mechanical' | 'perceptive' | 'autonomous' | 'creative';
  trend: 'up' | 'down' | 'stable';
  lastUpdated: string;
}

interface PhiDashboardProps {
  phiData: PhiData;
  history?: Array<{ timestamp: string; value: number }>;
  showHistory?: boolean;
}

const getLevelInfo = (level: string) => {
  switch (level) {
    case 'mechanical':
      return { label: '机械反应', color: '#9e9e9e', description: '简单规则执行' };
    case 'perceptive':
      return { label: '感知适应', color: '#2196f3', description: '反馈调节' };
    case 'autonomous':
      return { label: '自主协作', color: '#4caf50', description: '多步规划和战略合作' };
    case 'creative':
      return { label: '创造性解决', color: '#9c27b0', description: '超越预设的创新方案' };
    default:
      return { label: '未知', color: '#9e9e9e', description: '' };
  }
};

export const PhiDashboard: React.FC<PhiDashboardProps> = ({
  phiData,
  history = [],
  showHistory = true
}) => {
  const levelInfo = getLevelInfo(phiData.level);
  const progress = phiData.currentValue * 100;
  const trendPercentage = phiData.previousValue > 0 
    ? ((phiData.currentValue - phiData.previousValue) / phiData.previousValue * 100).toFixed(2)
    : '0';

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
        <PsychologyIcon color="primary" sx={{ mr: 1 }} />
        <Typography variant="h6">
          Φ 价值仪表盘
        </Typography>
      </Box>

      <Grid container spacing={2}>
        {/* 主数值卡片 */}
        <Grid item xs={12} md={6}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                <Box>
                  <Typography variant="h2" color="primary" fontWeight="bold">
                    {phiData.currentValue.toFixed(3)}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    当前 Φ 值
                  </Typography>
                </Box>
                <Box sx={{ textAlign: 'right' }}>
                  <Chip
                    icon={phiData.trend === 'up' ? <TrendingUpIcon /> : phiData.trend === 'down' ? <TrendingDownIcon /> : undefined}
                    label={`${phiData.trend === 'up' ? '+' : phiData.trend === 'down' ? '-' : ''}${trendPercentage}%`}
                    color={phiData.trend === 'up' ? 'success' : phiData.trend === 'down' ? 'error' : 'default'}
                    size="small"
                  />
                </Box>
              </Box>

              <Box sx={{ mb: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                  <Typography variant="caption">0</Typography>
                  <Typography variant="caption">0.3</Typography>
                  <Typography variant="caption">0.5</Typography>
                  <Typography variant="caption">0.7</Typography>
                  <Typography variant="caption">1.0</Typography>
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={progress}
                  sx={{
                    height: 10,
                    borderRadius: 5,
                    backgroundColor: '#e0e0e0',
                    '& .MuiLinearProgress-bar': {
                      backgroundColor: levelInfo.color,
                      borderRadius: 5
                    }
                  }}
                />
              </Box>

              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Chip
                  label={levelInfo.label}
                  sx={{
                    backgroundColor: levelInfo.color,
                    color: 'white',
                    fontWeight: 'bold'
                  }}
                />
                <Typography variant="caption" color="textSecondary">
                  {levelInfo.description}
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* 等级说明卡片 */}
        <Grid item xs={12} md={6}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                Φ 值等级标尺
              </Typography>
              
              <Box sx={{ mb: 2 }}>
                {[
                  { range: 'Φ < 0.3', label: '机械反应', color: '#9e9e9e' },
                  { range: '0.3 ≤ Φ < 0.5', label: '感知适应', color: '#2196f3' },
                  { range: '0.5 ≤ Φ < 0.7', label: '自主协作', color: '#4caf50' },
                  { range: 'Φ ≥ 0.7', label: '创造性解决', color: '#9c27b0' }
                ].map((item, index) => (
                  <Box
                    key={index}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      p: 1,
                      mb: 0.5,
                      bgcolor: phiData.currentValue >= (index * 0.2 + 0.1) ? `${item.color}22` : 'transparent',
                      borderLeft: `3px solid ${item.color}`,
                      borderRadius: '0 4px 4px 0'
                    }}
                  >
                    <Typography variant="body2" sx={{ width: 120, fontFamily: 'monospace' }}>
                      {item.range}
                    </Typography>
                    <Typography variant="body2" fontWeight="bold">
                      {item.label}
                    </Typography>
                    {phiData.currentValue >= (index * 0.2 + 0.1) && (
                      <Chip label="当前" size="small" sx={{ ml: 1 }} />
                    )}
                  </Box>
                ))}
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* 历史趋势 */}
        {showHistory && history.length > 0 && (
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                  Φ 值历史趋势
                </Typography>
                <Paper sx={{ p: 2, bgcolor: '#f5f5f5' }}>
                  <Box sx={{ display: 'flex', alignItems: 'flex-end', height: 100, gap: 0.5 }}>
                    {history.map((item, index) => {
                      const height = item.value * 100;
                      return (
                        <Box
                          key={index}
                          sx={{
                            flex: 1,
                            height: `${height}%`,
                            minHeight: 4,
                            backgroundColor: levelInfo.color,
                            borderRadius: '2px 2px 0 0',
                            position: 'relative'
                          }}
                          title={`${item.value.toFixed(3)} (${new Date(item.timestamp).toLocaleTimeString()})`}
                        />
                      );
                    })}
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1 }}>
                    <Typography variant="caption" color="textSecondary">
                      {new Date(history[0]?.timestamp).toLocaleDateString()}
                    </Typography>
                    <Typography variant="caption" color="textSecondary">
                      {new Date(history[history.length - 1]?.timestamp).toLocaleDateString()}
                    </Typography>
                  </Box>
                </Paper>
              </CardContent>
            </Card>
          </Grid>
        )}

        {/* 最后更新时间 */}
        <Grid item xs={12}>
          <Typography variant="caption" color="textSecondary">
            最后更新: {new Date(phiData.lastUpdated).toLocaleString('zh-CN')}
          </Typography>
        </Grid>
      </Grid>
    </Box>
  );
};

export default PhiDashboard;
