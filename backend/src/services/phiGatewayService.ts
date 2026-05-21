/**
 * Φ-Gateway Service
 * 对入站流量做 Φ 值评估
 * 
 * 基于 Paper 4 "互联网重构悖论" 的 Φ-Gateway 概念：
 * - 高 Φ 请求：语义丰富、上下文完整 → 优先通过
 * - 低 Φ 请求：语义稀薄、上下文缺失 → 限流/拒绝
 */

export interface RequestFeatures {
  path: string;
  method: string;
  hasAuth: boolean;
  hasBody: boolean;
  bodySize: number;
  contentTypes: string[];
  headerCount: number;
  isAPI: boolean;
  apiVersion: string;
  userId?: string;
  ip?: string;
}

export interface PhiGatewayDecision {
  action: 'PRIORITY' | 'NORMAL' | 'THROTTLE' | 'REJECT';
  shouldReject: boolean;
  retryAfter?: number;
  reason: string;
}

class PhiGatewayServiceClass {
  // 阈值配置
  private readonly PRIORITY_THRESHOLD = 0.75;
  private readonly NORMAL_THRESHOLD = 0.40;
  private readonly THROTTLE_THRESHOLD = 0.15;
  
  // 限流配置
  private requestCounts: Map<string, { count: number; lastReset: number }> = new Map();
  private readonly THROTTLE_WINDOW_MS = 60_000; // 1分钟窗口
  private readonly THROTTLE_MAX_REQUESTS = 10; // 低Φ请求限流阈值
  
  /**
   * 提取请求特征
   */
  extractRequestFeatures(req: any): RequestFeatures {
    return {
      path: req.path || '/',
      method: req.method || 'GET',
      hasAuth: !!(req.headers.authorization || req.user),
      hasBody: !!(req.body && Object.keys(req.body).length > 0),
      bodySize: req.body ? JSON.stringify(req.body).length : 0,
      contentTypes: (req.headers['content-type'] || '').split(';').map((s: string) => s.trim()),
      headerCount: Object.keys(req.headers).length,
      isAPI: (req.path || '').startsWith('/api/'),
      apiVersion: this.extractApiVersion(req.path),
      userId: req.user?.userId,
      ip: req.ip || req.connection?.remoteAddress,
    };
  }

  /**
   * 计算 Φ 评分
   * 
   * 公式: Φ = w1*semanticRichness + w2*contextCompleteness + w3*authCredibility + w4*structureQuality
   * 
   * - semanticRichness: 请求语义丰富度（方法类型 + body 大小 + 内容类型）
   * - contextCompleteness: 上下文完整度（auth + headers + API 版本）
   * - authCredibility: 认证可信度
   * - structureQuality: 结构质量（路径规范性 + API 版本一致性）
   */
  calculatePhiScore(features: RequestFeatures): number {
    // 1. 语义丰富度 (0-1)
    const methodScore = { POST: 0.8, PUT: 0.7, PATCH: 0.7, GET: 0.5, DELETE: 0.4 }[features.method] ?? 0.3;
    const bodyScore = Math.min(features.bodySize / 5000, 1.0); // 5KB 为满分
    const contentTypeScore = features.contentTypes.some(ct => ct.includes('json')) ? 0.8 :
                             features.contentTypes.some(ct => ct.includes('form')) ? 0.5 : 0.2;
    const semanticRichness = methodScore * 0.4 + bodyScore * 0.3 + contentTypeScore * 0.3;
    
    // 2. 上下文完整度 (0-1)
    const authScore = features.hasAuth ? 0.7 : 0.1;
    const headerScore = Math.min(features.headerCount / 15, 1.0);
    const versionScore = features.apiVersion ? 0.8 : 0.2;
    const contextCompleteness = authScore * 0.4 + headerScore * 0.3 + versionScore * 0.3;
    
    // 3. 认证可信度 (0-1)
    const authCredibility = features.hasAuth ? (features.userId ? 0.9 : 0.5) : 0.1;
    
    // 4. 结构质量 (0-1)
    const pathScore = features.isAPI ? 0.8 : 0.3;
    const structureQuality = pathScore;
    
    // 加权求和
    const phiScore = 
      0.3 * semanticRichness +
      0.3 * contextCompleteness +
      0.25 * authCredibility +
      0.15 * structureQuality;
    
    return Math.min(1.0, Math.max(0.0, phiScore));
  }

  /**
   * 做出流量控制决策
   */
  makeDecision(phiScore: number, features: RequestFeatures): PhiGatewayDecision {
    if (phiScore >= this.PRIORITY_THRESHOLD) {
      return {
        action: 'PRIORITY',
        shouldReject: false,
        reason: `High Φ (${phiScore.toFixed(4)}): semantic-rich, well-contextualized request`,
      };
    }
    
    if (phiScore >= this.NORMAL_THRESHOLD) {
      return {
        action: 'NORMAL',
        shouldReject: false,
        reason: `Normal Φ (${phiScore.toFixed(4)}): standard request`,
      };
    }
    
    if (phiScore >= this.THROTTLE_THRESHOLD) {
      // 检查限流
      const key = features.ip || 'unknown';
      const shouldThrottle = this.checkThrottle(key);
      const retryAfter = shouldThrottle ? 30 : undefined;
      
      return {
        action: 'THROTTLE',
        shouldReject: shouldThrottle,
        retryAfter,
        reason: `Low Φ (${phiScore.toFixed(4)}): throttled request${shouldThrottle ? ' (rate limited)' : ''}`,
      };
    }
    
    // 极低 Φ，直接拒绝
    return {
      action: 'REJECT',
      shouldReject: true,
      reason: `Very low Φ (${phiScore.toFixed(4)}): insufficient semantic value`,
    };
  }

  private extractApiVersion(path: string): string {
    const match = (path || '').match(/\/api\/v(\d+)\//);
    return match ? `v${match[1]}` : '';
  }

  private checkThrottle(key: string): boolean {
    const now = Date.now();
    const entry = this.requestCounts.get(key);
    
    if (!entry || now - entry.lastReset > this.THROTTLE_WINDOW_MS) {
      this.requestCounts.set(key, { count: 1, lastReset: now });
      return false;
    }
    
    entry.count++;
    return entry.count > this.THROTTLE_MAX_REQUESTS;
  }
}

export const phiGatewayService = new PhiGatewayServiceClass();
