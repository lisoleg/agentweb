/**
 * Dual-Track Router (双轨桥接器)
 * 基于 Paper 4 "互联网重构悖论" 的双轨制概念
 *
 * Track A (存量轨道): REST/JSON — 传统API，向后兼容
 * Track B (增量轨道): EML/Φ-Net — 语义化API，支持Φ值路由
 *
 * 桥接规则：
 * - 存量请求自动提升为增量格式（如果支持）
 * - 增量请求降级为存量格式（如果需要）
 * - 双轨并行，平滑过渡
 */

import { Request, Response, NextFunction, Router } from 'express';

// =============== Types ===============

export type TrackType = 'LEGACY' | 'EML';

export interface DualTrackRequest {
  track: TrackType;
  originalFormat: 'rest' | 'eml' | 'phi-net';
  phiScore?: number;
  semanticContext?: Record<string, any>;
  // Legacy fields
  method?: string;
  path?: string;
  body?: any;
  headers?: Record<string, string>;
  // EML fields
  emlAction?: string;
  emlPayload?: any;
  phiRouteTarget?: string;
}

export interface DualTrackResponse {
  track: TrackType;
  format: 'rest' | 'eml';
  data: any;
  phiScore?: number;
  upgradeAvailable: boolean; // 是否可升级到增量轨道
}

export interface TrackMetrics {
  legacyRequests: number;
  emlRequests: number;
  upgrades: number;
  downgrades: number;
  avgPhiScore: number;
}

// =============== EML Adapter ===============

export class EmlAdapter {
  /**
   * 将 REST 请求转换为 EML 格式
   */
  static restToEml(req: Request): DualTrackRequest {
    return {
      track: 'EML',
      originalFormat: 'rest',
      method: req.method,
      path: req.path,
      body: req.body,
      headers: req.headers as Record<string, string>,
      emlAction: this.inferEmlAction(req.method, req.path),
      emlPayload: req.body,
      phiScore: (req as any).phiGateway?.score,
      semanticContext: {
        userId: (req as any).user?.userId,
        apiVersion: this.extractApiVersion(req.path),
        contentType: req.headers['content-type'],
      },
    };
  }

  /**
   * 将 EML 请求转换为 REST 格式
   */
  static emlToRest(emlReq: DualTrackRequest): { method: string; path: string; body: any } {
    return {
      method: this.emlActionToMethod(emlReq.emlAction || 'QUERY'),
      path: emlReq.path || '/',
      body: emlReq.emlPayload || emlReq.body,
    };
  }

  private static inferEmlAction(method: string, path: string): string {
    // EML 动词映射
    const actionMap: Record<string, string> = {
      GET: 'QUERY',
      POST: 'COMPUTE',
      PUT: 'CONFIGURE',
      PATCH: 'ADJUST',
      DELETE: 'DISSOLVE',
    };

    // 特殊路径映射
    if (path.includes('/phi/calculate')) return 'COMPUTE_PHI';
    if (path.includes('/governance/vote')) return 'VOTE';
    if (path.includes('/governance/propose')) return 'PROPOSE';

    return actionMap[method] || 'QUERY';
  }

  private static emlActionToMethod(action: string): string {
    const methodMap: Record<string, string> = {
      QUERY: 'GET',
      COMPUTE: 'POST',
      COMPUTE_PHI: 'POST',
      CONFIGURE: 'PUT',
      ADJUST: 'PATCH',
      VOTE: 'POST',
      PROPOSE: 'POST',
      DISSOLVE: 'DELETE',
    };
    return methodMap[action] || 'GET';
  }

  private static extractApiVersion(path: string): string {
    const match = path.match(/\/api\/v(\d+)\//);
    return match ? `v${match[1]}` : 'v1';
  }
}

// =============== Dual-Track Router ===============

class DualTrackRouterClass {
  private metrics: TrackMetrics = {
    legacyRequests: 0,
    emlRequests: 0,
    upgrades: 0,
    downgrades: 0,
    avgPhiScore: 0,
  };

  /**
   * Express 中间件：自动检测并路由到合适的轨道
   */
  middleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      const track = this.detectTrack(req);

      // 设置轨道标识
      (req as any).dualTrack = { track, originalFormat: track === 'EML' ? 'eml' : 'rest' };

      // 更新指标
      if (track === 'EML') {
        this.metrics.emlRequests++;
      } else {
        this.metrics.legacyRequests++;

        // 尝试升级到 EML 轨道
        if (this.canUpgradeToEml(req)) {
          this.metrics.upgrades++;
          (req as any).dualTrack.upgradeAvailable = true;

          // 如果客户端支持 EML，自动升级
          if (req.headers['accept']?.includes('application/eml+json')) {
            const emlRequest = EmlAdapter.restToEml(req);
            (req as any).dualTrack.emlRequest = emlRequest;
            (req as any).dualTrack.track = 'EML';
          }
        }
      }

      // 更新平均 Φ 分
      if ((req as any).phiGateway?.score) {
        this.updateAvgPhiScore((req as any).phiGateway.score);
      }

      next();
    };
  }

  /**
   * 创建双轨路由器
   */
  createRouter(): Router {
    const router = Router();

    // 存量轨道 (REST/JSON)
    router.use('/legacy', this.legacyTrackHandler());

    // 增量轨道 (EML/Φ-Net)
    router.use('/eml', this.emlTrackHandler());

    // 双轨指标
    router.get('/metrics', (_req, res) => {
      res.json({
        code: 0,
        data: this.getMetrics(),
      });
    });

    return router;
  }

  /**
   * 获取指标
   */
  getMetrics(): TrackMetrics {
    return { ...this.metrics };
  }

  // =============== Private Methods ===============

  private detectTrack(req: Request): TrackType {
    // 检测 EML 请求
    const contentType = req.headers['content-type'] || '';
    const accept = req.headers['accept'] || '';

    if (contentType.includes('application/eml+json') ||
        accept.includes('application/eml+json') ||
        req.headers['x-eml-action']) {
      return 'EML';
    }

    return 'LEGACY';
  }

  private canUpgradeToEml(req: Request): boolean {
    // 有 Φ 网关评分且分数较高
    return ((req as any).phiGateway?.score || 0) > 0.5;
  }

  private legacyTrackHandler(): Router {
    const router = Router();

    // 存量轨道: 透传到现有 API
    router.use('*', (req, res, next) => {
      this.metrics.legacyRequests++;
      next();
    });

    return router;
  }

  private emlTrackHandler(): Router {
    const router = Router();

    // 增量轨道: EML 格式处理
    router.use('*', (req, res, next) => {
      this.metrics.emlRequests++;

      // 设置 EML 响应头
      res.setHeader('X-Track', 'EML');
      res.setHeader('X-EML-Version', '1.0');

      next();
    });

    return router;
  }

  private updateAvgPhiScore(score: number): void {
    const total = this.metrics.legacyRequests + this.metrics.emlRequests;
    this.metrics.avgPhiScore =
      (this.metrics.avgPhiScore * (total - 1) + score) / total;
  }
}

export const dualTrackRouter = new DualTrackRouterClass();

// 扩展 Express Request 类型
declare global {
  namespace Express {
    interface Request {
      dualTrack?: {
        track: TrackType;
        originalFormat: 'rest' | 'eml';
        upgradeAvailable?: boolean;
        emlRequest?: DualTrackRequest;
      };
    }
  }
}
