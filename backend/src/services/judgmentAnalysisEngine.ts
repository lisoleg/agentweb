/**
 * JudgmentAnalysisEngine — V12.0 内生AI裁决分析引擎
 * 6GNetGPT"内生AI"思想: AI不是外挂，而是架构的基础能力
 * 
 * 功能: Φ加权投票模式聚类分析 + 投票异常检测 + 裁决影响预测
 */

import logger from '../utils/logger';

// =============== Types ===============

interface VoteRecord {
  voter: string;
  votingPower: bigint;
  support: boolean;
  timestamp: number;
}

interface ClusterResult {
  label: string;
  voterCount: number;
  totalPower: bigint;
  avgPower: number;
  supportRatio: number;
}

interface AnomalyResult {
  isAnomalous: boolean;
  anomalyScore: number;
  details: string;
}

interface ImpactPrediction {
  judgment: string;
  probability: number;
  impactDescription: string;
  affectedClauses: string[];
}

export interface AnalysisReport {
  caseId: number;
  timestamp: string;
  clusters: ClusterResult[];
  anomalies: AnomalyResult[];
  impactPredictions: ImpactPrediction[];
  summary: string;
}

// =============== Engine ===============

class JudgmentAnalysisEngine {
  /**
   * 分析案件的投票模式
   */
  analyzeVotingPattern(
    caseId: number,
    votes: VoteRecord[],
    totalPhiSupply: bigint
  ): AnalysisReport {
    logger.info(`[JudgmentAnalysisEngine] Analyzing case ${caseId} with ${votes.length} votes`);

    const clusters = this._clusterVotes(votes);
    const anomalies = this._detectAnomalies(votes, totalPhiSupply);
    const impactPredictions = this._predictImpact(votes);
    const summary = this._generateSummary(clusters, anomalies, impactPredictions);

    return {
      caseId,
      timestamp: new Date().toISOString(),
      clusters,
      anomalies,
      impactPredictions,
      summary,
    };
  }

  /**
   * K-means聚类: 按投票权重分段
   * 低Φ(0-1000), 中Φ(1000-5000), 高Φ(5000+)
   */
  private _clusterVotes(votes: VoteRecord[]): ClusterResult[] {
    const segments: Record<string, VoteRecord[]> = {
      '低Φ(0-1000)': [],
      '中Φ(1000-5000)': [],
      '高Φ(5000+)': [],
    };

    for (const vote of votes) {
      const power = Number(vote.votingPower);
      if (power < 1000) {
        segments['低Φ(0-1000)'].push(vote);
      } else if (power < 5000) {
        segments['中Φ(1000-5000)'].push(vote);
      } else {
        segments['高Φ(5000+)'].push(vote);
      }
    }

    return Object.entries(segments).map(([label, segmentVotes]) => {
      const totalPower = segmentVotes.reduce((sum, v) => sum + v.votingPower, BigInt(0));
      const supportCount = segmentVotes.filter(v => v.support).length;
      const voterCount = segmentVotes.length;

      return {
        label,
        voterCount,
        totalPower,
        avgPower: voterCount > 0 ? Number(totalPower) / voterCount : 0,
        supportRatio: voterCount > 0 ? supportCount / voterCount : 0,
      };
    });
  }

  /**
   * 异常检测: z-score检测短时间内大量低Φ账户涌入
   */
  private _detectAnomalies(votes: VoteRecord[], _totalPhiSupply: bigint): AnomalyResult[] {
    const anomalies: AnomalyResult[] = [];

    if (votes.length < 5) {
      return [{ isAnomalous: false, anomalyScore: 0, details: '投票数不足，无法检测异常' }];
    }

    // 检测低Φ账户集中投票
    const lowPhiVotes = votes.filter(v => Number(v.votingPower) < 100);
    const lowPhiRatio = lowPhiVotes.length / votes.length;

    // 检测时间集中度
    const timestamps = votes.map(v => v.timestamp).sort((a, b) => a - b);
    const timeRange = timestamps[timestamps.length - 1] - timestamps[0];
    const avgInterval = timeRange / Math.max(votes.length - 1, 1);

    // 计算z-score
    const intervals: number[] = [];
    for (let i = 1; i < timestamps.length; i++) {
      intervals.push(timestamps[i] - timestamps[i - 1]);
    }
    const meanInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    const stdInterval = Math.sqrt(
      intervals.reduce((sum, x) => sum + Math.pow(x - meanInterval, 2), 0) / intervals.length
    );

    // 短时间内大量投票 = 异常
    const burstScore = stdInterval > 0 ? (avgInterval - meanInterval) / stdInterval : 0;

    if (lowPhiRatio > 0.5) {
      anomalies.push({
        isAnomalous: true,
        anomalyScore: Math.min(lowPhiRatio + 0.1, 1.0),
        details: `高比例低Φ投票: ${(lowPhiRatio * 100).toFixed(1)}% 的投票者Φ<100`,
      });
    }

    if (burstScore < -2) {
      anomalies.push({
        isAnomalous: true,
        anomalyScore: Math.min(Math.abs(burstScore) / 5, 1.0),
        details: `投票时间异常集中: 平均间隔${Math.round(avgInterval)}秒，z-score=${burstScore.toFixed(2)}`,
      });
    }

    if (anomalies.length === 0) {
      anomalies.push({
        isAnomalous: false,
        anomalyScore: 0,
        details: '未检测到投票异常',
      });
    }

    return anomalies;
  }

  /**
   * 影响预测: 预测不同判决结果的生态影响
   */
  private _predictImpact(votes: VoteRecord[]): ImpactPrediction[] {
    const totalYes = votes.filter(v => v.support).reduce((sum, v) => sum + v.votingPower, BigInt(0));
    const totalNo = votes.filter(v => !v.support).reduce((sum, v) => sum + v.votingPower, BigInt(0));
    const total = totalYes + totalNo;

    if (total === BigInt(0)) {
      return [
        { judgment: 'DISMISSED', probability: 1.0, impactDescription: '无投票，案件将被驳回', affectedClauses: [] },
      ];
    }

    const yesRate = Number((totalYes * BigInt(10000)) / total) / 100;

    const predictions: ImpactPrediction[] = [];

    // UPHOLD预测
    if (yesRate >= 67) {
      predictions.push({
        judgment: 'UPHOLD',
        probability: Math.min((yesRate - 50) / 50, 1.0),
        impactDescription: '修正案维持有效，现有治理结构不变',
        affectedClauses: [],
      });
    }

    // OVERTURN预测
    if (yesRate < 33) {
      predictions.push({
        judgment: 'OVERTURN',
        probability: Math.min((50 - yesRate) / 50, 1.0),
        impactDescription: '修正案被推翻，相关条款回退到VOTING状态，需重新审议',
        affectedClauses: ['相关修正案', '依赖该修正案的下游条款'],
      });
    }

    // REMAND预测
    if (yesRate >= 33 && yesRate < 67) {
      predictions.push({
        judgment: 'REMAND',
        probability: 1.0 - Math.abs(yesRate - 50) / 50,
        impactDescription: '案件发回重议，需进一步社区讨论达成共识',
        affectedClauses: ['待重议的修正案'],
      });
    }

    return predictions;
  }

  /**
   * 生成分析摘要
   */
  private _generateSummary(
    clusters: ClusterResult[],
    anomalies: AnomalyResult[],
    predictions: ImpactPrediction[]
  ): string {
    const hasAnomaly = anomalies.some(a => a.isAnomalous);
    const topPrediction = predictions.sort((a, b) => b.probability - a.probability)[0];

    let summary = `裁决分析: 最可能判决=${topPrediction?.judgment || '未知'}，`;
    summary += `概率=${((topPrediction?.probability || 0) * 100).toFixed(1)}%。`;

    if (hasAnomaly) {
      summary += ` ⚠️ 检测到投票异常。`;
    }

    const highPhiCluster = clusters.find(c => c.label === '高Φ(5000+)');
    if (highPhiCluster && highPhiCluster.voterCount > 0) {
      summary += ` 高Φ段支持率=${(highPhiCluster.supportRatio * 100).toFixed(1)}%。`;
    }

    return summary;
  }
}

export const judgmentAnalysisEngine = new JudgmentAnalysisEngine();
