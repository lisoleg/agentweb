import React from 'react';
import { Box, Typography, Chip, IconButton, Tooltip } from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { useState } from 'react';

interface DIDDisplayProps {
  did: string;
  document?: {
    publicKey?: Array<{ id: string; type: string }>;
    service?: Array<{ id: string; type: string; endpoint: string }>;
  };
  onCopy?: () => void;
}

export const DIDDisplay: React.FC<DIDDisplayProps> = ({ did, document, onCopy }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(did);
      setCopied(true);
      onCopy?.();
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy DID:', err);
    }
  };

  return (
    <Box sx={{ p: 2, border: '1px solid #e0e0e0', borderRadius: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
        <CheckCircleIcon color="success" sx={{ mr: 1 }} />
        <Typography variant="subtitle1" fontWeight="bold">
          去中心化身份 (DID)
        </Typography>
      </Box>
      
      <Box sx={{ display: 'flex', alignItems: 'center', bgcolor: '#f5f5f5', p: 1, borderRadius: 1 }}>
        <Typography 
          variant="body2" 
          sx={{ 
            fontFamily: 'monospace',
            flex: 1,
            wordBreak: 'break-all'
          }}
        >
          {did}
        </Typography>
        <Tooltip title={copied ? '已复制' : '复制DID'}>
          <IconButton size="small" onClick={handleCopy}>
            {copied ? <CheckCircleIcon color="success" fontSize="small" /> : <ContentCopyIcon fontSize="small" />}
          </IconButton>
        </Tooltip>
      </Box>

      {document && (
        <Box sx={{ mt: 2 }}>
          {document.publicKey && document.publicKey.length > 0 && (
            <Box sx={{ mb: 1 }}>
              <Typography variant="caption" color="textSecondary">
                公钥 ({document.publicKey.length})
              </Typography>
              <Box sx={{ mt: 0.5 }}>
                {document.publicKey.map((key) => (
                  <Chip 
                    key={key.id} 
                    label={`${key.type}`} 
                    size="small" 
                    sx={{ mr: 0.5, mb: 0.5 }} 
                  />
                ))}
              </Box>
            </Box>
          )}
          
          {document.service && document.service.length > 0 && (
            <Box>
              <Typography variant="caption" color="textSecondary">
                服务端点 ({document.service.length})
              </Typography>
              <Box sx={{ mt: 0.5 }}>
                {document.service.map((svc) => (
                  <Chip 
                    key={svc.id} 
                    label={`${svc.type}: ${svc.endpoint}`} 
                    size="small" 
                    sx={{ mr: 0.5, mb: 0.5 }} 
                  />
                ))}
              </Box>
            </Box>
          )}
        </Box>
      )}
    </Box>
  );
};

export default DIDDisplay;
