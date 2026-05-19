import React from 'react';
import { 
  Box, 
  Typography, 
  Card, 
  CardContent, 
  Chip, 
  Button,
  List,
  ListItem,
  ListItemText,
  Divider
} from '@mui/material';
import VerifiedIcon from '@mui/icons-material/Verified';
import DeleteIcon from '@mui/icons-material/Delete';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';

interface VCItem {
  id: string;
  type: string[];
  issuer: string;
  issuanceDate: string;
  expirationDate?: string;
  credentialSubject: Record<string, any>;
  status?: 'valid' | 'expired' | 'revoked';
}

interface VCListProps {
  credentials: VCItem[];
  onVerify?: (id: string) => void;
  onRevoke?: (id: string) => void;
  onViewDetails?: (id: string) => void;
}

export const VCList: React.FC<VCListProps> = ({
  credentials,
  onVerify,
  onRevoke,
  onViewDetails
}) => {
  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'valid': return 'success';
      case 'expired': return 'warning';
      case 'revoked': return 'error';
      default: return 'default';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (credentials.length === 0) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Typography color="textSecondary">
          暂无可验证凭证
        </Typography>
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        可验证凭证 ({credentials.length})
      </Typography>
      
      <List>
        {credentials.map((vc, index) => (
          <React.Fragment key={vc.id}>
            <ListItem
              alignItems="flex-start"
              sx={{ 
                flexDirection: 'column',
                alignItems: 'stretch',
                py: 2
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'flex-start', mb: 1 }}>
                <VerifiedIcon 
                  color={vc.status === 'valid' ? 'primary' : 'disabled'} 
                  sx={{ mr: 1, mt: 0.5 }} 
                />
                <Box sx={{ flex: 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 0.5, mb: 0.5 }}>
                    <Typography variant="subtitle1" fontWeight="bold">
                      {vc.type.join(', ')}
                    </Typography>
                    <Chip
                      label={vc.status || 'valid'}
                      color={getStatusColor(vc.status)}
                      size="small"
                    />
                  </Box>
                  
                  <Typography variant="body2" color="textSecondary" sx={{ mb: 1 }}>
                    签发者: {vc.issuer}
                  </Typography>
                  
                  <Typography variant="caption" color="textSecondary" sx={{ display: 'block' }}>
                    签发时间: {formatDate(vc.issuanceDate)}
                  </Typography>
                  
                  {vc.expirationDate && (
                    <Typography variant="caption" color="textSecondary" sx={{ display: 'block' }}>
                      过期时间: {formatDate(vc.expirationDate)}
                    </Typography>
                  )}
                  
                  <Box sx={{ mt: 1, p: 1, bgcolor: '#f5f5f5', borderRadius: 1 }}>
                    <Typography variant="caption" color="textSecondary">
                      凭证内容:
                    </Typography>
                    <Typography variant="body2" sx={{ fontFamily: 'monospace', mt: 0.5 }}>
                      {JSON.stringify(vc.credentialSubject, null, 2).slice(0, 200)}
                      {JSON.stringify(vc.credentialSubject).length > 200 && '...'}
                    </Typography>
                  </Box>
                </Box>
              </Box>
              
              <Box sx={{ display: 'flex', gap: 1, mt: 1, ml: 4 }}>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<VerifiedIcon />}
                  onClick={() => onVerify?.(vc.id)}
                >
                  验证
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<OpenInNewIcon />}
                  onClick={() => onViewDetails?.(vc.id)}
                >
                  详情
                </Button>
                <Button
                  size="small"
                  color="error"
                  variant="outlined"
                  startIcon={<DeleteIcon />}
                  onClick={() => onRevoke?.(vc.id)}
                >
                  撤销
                </Button>
              </Box>
            </ListItem>
            {index < credentials.length - 1 && <Divider />}
          </React.Fragment>
        ))}
      </List>
    </Box>
  );
};

export default VCList;
