/**
 * DAAMetricService — V14.0 DAA度量 + GUI减法引擎
 * 对应文章1 §5.3：DAA（Distance-Advanced Along Assignment）度量
 *
 * 核心机制:
 * - DAA度量：不考核忙碌程度，只考核任务实际推进距离
 * - GUI减法：界面交互逐步简化直至消失，能力隐性化
 * - 政府退后机制：定规则、供API，前台创造力交给社会Agent
 * - 对应中国式制度优势中的"放管服"逻辑
 *
 * DAA公式:
 *   DAA = Σ (task_complexity × completion_rate × impact_factor) / time_window
 *   不考核：在线时长、请求次数、回复频率（Anti-内卷）
 */
import logger from '../utils/logger';

// =============== Types ===============

export interface DAAMetric {
  agentId: string;
  timestamp: number;
  assignmentId: string;
  taskComplexity: number;   // 任务复杂度 (0-10000)
  completionRate: number;   // 完成率 (0-10000)
  impactFactor: number;    // 影响力因子 (0-10000)
  timeWindow: number;      // 时间窗口（秒）
  daaScore: number;        // DAA得分
  traditionalWorkload: number; // 传统工作量（请求次数/在线时长）— 仅作对比
  antiInvolutionFlag: boolean; // 反内卷标识（traditionalWorkload高但DAA低=内卷）
}

export interface GUISubtraction {
  id: string;
  agentId: string;
  timestamp: number;
  componentType: 'BUTTON' | 'MENU' | 'FORM' | 'DASHBOARD' | 'NOTIFICATION';
  originalComplexity: number; // 原始交互复杂度
  currentComplexity: number;  // 当前交互复杂度（逐步减少）
  subtractionCount: number;   // 减法次数
  isInvisible: boolean;     // 是否已隐性化（消失）
  userAdaptationRate: number; // 用户适应率 (0-10000)
  targetDisappearance: number; // 目标消失时间（秒）
}

export interface GovernmentStepBack {
  id: string;
  timestamp: number;
  domain: string;            // 领域（如"电商""社交""内容"）
  ruleSet: string[];         // 规则集（政府定规则）
  apiList: string[];         // 提供的API列表
  creativityDelegated: boolean; // 创造力是否已委托给社会Agent
  socialAgentCount: number;   // 社会Agent数量
  innovationIndex: number;     // 创新指数 (0-10000)
}

// =============== Engine ===============

class DAAMetricService {
  private daaRecords: Map<string, DAAMetric[]> = new Map();  // agentId → records
  private guiSubtractions: Map<string, GUISubtraction> = new Map();
  private stepBackRecords: Map<string, GovernmentStepBack> = new Map();
  private readonly DAA_WINDOW = 604800; // 7天时间窗口
  private readonly INVOLUTION_THRESHOLD = 5000; // 内卷阈值：traditionalWorkload>5000且DAA<3000
  private readonly GUI_DISAPPEAR_THRESHOLD = 8000; // 用户适应率>8000，界面开始消失

  // ------ DAA 度量 ------

  /**
   * 记录DAA度量（核心方法）
   * 不考核忙碌程度，只考核任务实际推进距离
   */
  recordDAA(
    agentId: string,
    assignmentId: string,
    taskComplexity: number,
    completionRate: number,
    impactFactor: number,
    timeWindow: number,
    traditionalWorkload: number,
  ): DAAMetric {
    const daaScore = this.calculateDAA(taskComplexity, completionRate, impactFactor, timeWindow);

    const record: DAAMetric = {
      agentId,
      timestamp: Date.now(),
      assignmentId,
      taskComplexity,
      completionRate,
      impactFactor,
      timeWindow,
      daaScore,
      traditionalWorkload,
      antiInvolutionFlag: traditionalWorkload > this.INVOLUTION_THRESHOLD && daaScore < 3000,
    };

    if (!this.daaRecords.has(agentId)) {
      this.daaRecords.set(agentId, []);
    }
    this.daaRecords.get(agentId)!.push(record);

    if (record.antiInvolutionFlag) {
      logger.warn(`[DAA] INVOLUTION DETECTED: agent=${agentId}, traditional=${traditionalWorkload}, DAA=${daaScore}`);
    }

    logger.info(`[DAA] Recorded: agent=${agentId}, assignment=${assignmentId}, DAA=${daaScore}`);
    return record;
  }

  /**
   * 计算DAA得分
   * DAA = Σ (task_complexity × completion_rate × impact_factor) / time_window
   */
  private calculateDAA(
    taskComplexity: number,
    completionRate: number,
    impactFactor: number,
    timeWindow: number,
  ): number {
    const numerator = (taskComplexity / 10000) * (completionRate / 10000) * (impactFactor / 10000);
    const denominator = timeWindow > 0 ? timeWindow / 3600 : 1; // 转换为小时
    return Math.min(10000, numerator * 10000 / denominator);
  }

  /**
   * 获取Agent的DAA统计
   */
  getDAAStats(agentId: string, windowDays: number = 7): Record<string, unknown> {
    const records = this.daaRecords.get(agentId) || [];
    const cutoff = Date.now() - windowDays * 86400000;
    const recent = records.filter(r => r.timestamp > cutoff);

    if (recent.length === 0) {
      return { agentId, totalAssignments: 0, avgDAA: 0, antiInvolutionRate: 0 };
    }

    const totalDAA = recent.reduce((sum, r) => sum + r.daaScore, 0);
    const involutionCount = recent.filter(r => r.antiInvolutionFlag).length;

    return {
      agentId,
      totalAssignments: recent.length,
      avgDAA: totalDAA / recent.length,
      maxDAA: Math.max(...recent.map(r => r.daaScore)),
      minDAA: Math.min(...recent.map(r => r.daaScore)),
      antiInvolutionRate: involutionCount / recent.length,
      recentRecords: recent.slice(-10), // 最近10条
    };
  }

  // ------ GUI 减法 ------

  /**
   * 注册GUI组件进行减法追踪
   */
  registerGUIComponent(
    agentId: string,
    componentType: GUISubtraction['componentType'],
    originalComplexity: number,
  ): GUISubtraction {
    const id = `gui_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    const record: GUISubtraction = {
      id,
      agentId,
      timestamp: Date.now(),
      componentType,
      originalComplexity,
      currentComplexity: originalComplexity,
      subtractionCount: 0,
      isInvisible: false,
      userAdaptationRate: 0,
      targetDisappearance: Date.now() + 30 * 86400000, // 默认30天后消失
    };

    this.guiSubtractions.set(id, record);

    logger.info(`[DAA] GUI component REGISTERED: id=${id}, type=${componentType}, complexity=${originalComplexity}`);
    return record;
  }

  /**
   * 执行GUI减法（逐步简化直至消失）
   * 能力隐性化：用户越熟悉，界面越简单
   */
  performGUISubtraction(componentId: string, userAdaptationRate: number): GUISubtraction | null {
    const record = this.guiSubtractions.get(componentId);
    if (!record) return null;

    record.userAdaptationRate = userAdaptationRate;

    // 适应率越高，界面越简化
    if (userAdaptationRate > this.GUI_DISAPPEAR_THRESHOLD) {
      record.subtractionCount += 1;
      record.currentComplexity = Math.max(0, record.originalComplexity - record.subtractionCount * 1000);
      record.isInvisible = record.currentComplexity === 0;

      logger.info(`[DAA] GUI SUBTRACTION: component=${componentId}, newComplexity=${record.currentComplexity}, invisible=${record.isInvisible}`);
    }

    return record;
  }

  /**
   * 获取GUI减法统计
   */
  getGUISubtractionStats(agentId?: string): Record<string, unknown> {
    const records = Array.from(this.guiSubtractions.values());
    const filtered = agentId ? records.filter(r => r.agentId === agentId) : records;

    return {
      totalComponents: filtered.length,
      invisibleCount: filtered.filter(r => r.isInvisible).length,
      avgAdaptationRate: filtered.length > 0
        ? filtered.reduce((sum, r) => sum + r.userAdaptationRate, 0) / filtered.length
        : 0,
      byComponentType: {
        BUTTON: filtered.filter(r => r.componentType === 'BUTTON').length,
        MENU: filtered.filter(r => r.componentType === 'MENU').length,
        FORM: filtered.filter(r => r.componentType === 'FORM').length,
        DASHBOARD: filtered.filter(r => r.componentType === 'DASHBOARD').length,
        NOTIFICATION: filtered.filter(r => r.componentType === 'NOTIFICATION').length,
      },
    };
  }

  // ------ 政府退后机制 ------

  /**
   * 政府退后：定规则、供API，前台创造力交给社会Agent
   */
  governmentStepBack(
    domain: string,
    ruleSet: string[],
    apiList: string[],
  ): GovernmentStepBack {
    const id = `gsb_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    const record: GovernmentStepBack = {
      id,
      timestamp: Date.now(),
      domain,
      ruleSet,
      apiList,
      creativityDelegated: true,
      socialAgentCount: 0,
      innovationIndex: 5000, // 初始值
    };

    this.stepBackRecords.set(id, record);

    logger.info(`[DAA] Government STEP BACK: domain=${domain}, rules=${ruleSet.length}, APIs=${apiList.length}`);
    logger.info(`[DAA] Creativity DELEGATED to social Agents for domain: ${domain}`);
    return record;
  }

  /**
   * 更新社会Agent数量（创造力委托效果指标）
   */
  updateSocialAgentCount(recordId: string, count: number, innovationIndex: number): GovernmentStepBack | null {
    const record = this.stepBackRecords.get(recordId);
    if (!record) return null;

    record.socialAgentCount = count;
    record.innovationIndex = innovationIndex;

    logger.info(`[DAA] Social agent count UPDATED: record=${recordId}, count=${count}, innovation=${innovationIndex}`);
    return record;
  }

  /**
   * 获取政府退后统计
   */
  getStepBackStats(): Record<string, unknown> {
    const records = Array.from(this.stepBackRecords.values());

    return {
      totalDomains: records.length,
      totalRules: records.reduce((sum, r) => sum + r.ruleSet.length, 0),
      totalAPIs: records.reduce((sum, r) => sum + r.apiList.length, 0),
      totalSocialAgents: records.reduce((sum, r) => sum + r.socialAgentCount, 0),
      avgInnovationIndex: records.length > 0
        ? records.reduce((sum, r) => sum + r.innovationIndex, 0) / records.length
        : 0,
      byDomain: records.map(r => ({
        domain: r.domain,
        socialAgentCount: r.socialAgentCount,
        innovationIndex: r.innovationIndex,
      })),
    };
  }

  // ------ 综合查询 ------

  /**
   * 获取Agent的综合度量报告（DAA + GUI + 政府退后）
   */
  getComprehensiveReport(agentId: string): Record<string, unknown> {
    const daaStats = this.getDAAStats(agentId);
    const guiStats = this.getGUISubtractionStats(agentId);

    return {
      agentId,
      timestamp: Date.now(),
      daa: daaStats,
      gui: guiStats,
      recommendation: this.generateRecommendation(daaStats, guiStats),
    };
  }

  private generateRecommendation(daaStats: any, guiStats: any): string {
    const recommendations: string[] = [];

    if (daaStats.antiInvolutionRate > 0.3) {
      recommendations.push('检测到内卷倾向，建议减少传统工作量考核，聚焦DAA度量');
    }

    if (guiStats.invisibleCount < guiStats.totalComponents * 0.3) {
      recommendations.push('GUI减法进展较慢，建议加速界面隐性化');
    }

    if (recommendations.length === 0) {
      recommendations.push('度量健康：DAA进展良好，GUI减法适度');
    }

    return recommendations.join('; ');
  }
}

const daaMetricService = new DAAMetricService();
export { daaMetricService };
