import { Request, Response, NextFunction } from 'express';
import { phiGatewayService } from '../services/phiGatewayService';

// Φ-Gateway 中间件：对入站流量做 Φ 值评估
export async function phiGatewayMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const startTime = Date.now();
    
    // 提取请求特征
    const features = phiGatewayService.extractRequestFeatures(req);
    
    // 计算 Φ 评分
    const phiScore = phiGatewayService.calculatePhiScore(features);
    
    // 流量控制决策
    const decision = phiGatewayService.makeDecision(phiScore, features);
    
    // 记录评估日志
    const evaluationTime = Date.now() - startTime;
    
    // 设置响应头
    res.setHeader('X-Phi-Score', phiScore.toFixed(4));
    res.setHeader('X-Phi-Decision', decision.action);
    res.setHeader('X-Phi-Eval-Ms', evaluationTime.toString());
    
    switch (decision.action) {
      case 'PRIORITY': // 高Φ，优先通过
        req.phiGateway = { score: phiScore, action: 'PRIORITY', features };
        next();
        break;
      case 'NORMAL': // 正常通过
        req.phiGateway = { score: phiScore, action: 'NORMAL', features };
        next();
        break;
      case 'THROTTLE': // 低Φ，限流
        if (decision.shouldReject) {
          res.status(429).json({
            code: 4291,
            message: 'Request throttled by Φ-Gateway: low semantic coherence',
            phiScore,
            retryAfter: decision.retryAfter,
          });
          return;
        }
        req.phiGateway = { score: phiScore, action: 'THROTTLE', features };
        next();
        break;
      case 'REJECT': // 极低Φ，直接拒绝
        res.status(403).json({
          code: 4031,
          message: 'Request rejected by Φ-Gateway: insufficient semantic value',
          phiScore,
        });
        return;
    }
  } catch (error) {
    // 中间件出错不影响正常请求
    console.error('[Φ-Gateway] Error:', error);
    next();
  }
}

// 扩展 Express Request 类型
declare global {
  namespace Express {
    interface Request {
      phiGateway?: {
        score: number;
        action: 'PRIORITY' | 'NORMAL' | 'THROTTLE' | 'REJECT';
        features: Record<string, any>;
      };
    }
  }
}
