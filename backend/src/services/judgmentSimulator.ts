/**
 * JudgmentSimulator — V12.0 判决沙盘预演
 * 6GNetGPT"数字孪生"思想: 利用试错和预测能力验证决策
 * 
 * 功能: 给定假设投票分布，模拟最终判决概率 + what-if分析
 */

import logger from '../utils/logger';

// =============== Types ===============

export interface SimulationInput {
  caseId: number;
  currentYesVotes: bigint;
  currentNoVotes: bigint;
  totalVoters: number;
  votingEndTimestamp: number;
  /** 假设额外投票 */
  hypotheticalVotes?: {
    yesPower: bigint;
    noPower: bigint;
  };
  /** what-if: 增加X%支持率 */
  supportRateChange?: number; // 基点，如 500 = 5%
}

export interface SimulationResult {
  caseId: number;
  currentYesRate: number;
  simulatedYesRate: number;
  predictedJudgment: string;
  judgmentProbability: number;
  timeRemaining: number;
  whatIfScenarios: WhatIfScenario[];
  impactAssessment: string;
}

export interface WhatIfScenario {
  description: string;
  yesRate: number;
  judgment: string;
  probability: number;
}

// =============== Simulator ===============

class JudgmentSimulator {
  private readonly APPROVAL_THRESHOLD = 6700; // 67%

  /**
   * 模拟判决结果
   */
  simulate(input: SimulationInput): SimulationResult {
    logger.info(`[JudgmentSimulator] Simulating case ${input.caseId}`);

    const currentTotal = input.currentYesVotes + input.currentNoVotes;
    const currentYesRate = currentTotal > BigInt(0)
      ? Number((input.currentYesVotes * BigInt(10000)) / currentTotal)
      : 0;

    // 加入假设投票
    let simYes = input.currentYesVotes;
    let simNo = input.currentNoVotes;
    if (input.hypotheticalVotes) {
      simYes += input.hypotheticalVotes.yesPower;
      simNo += input.hypotheticalVotes.noPower;
    }

    // 支持率变化
    if (input.supportRateChange && currentTotal > BigInt(0)) {
      const changeAmount = (currentTotal * BigInt(Math.abs(input.supportRateChange))) / BigInt(10000);
      if (input.supportRateChange > 0) {
        simYes += changeAmount;
        simNo = simNo > changeAmount ? simNo - changeAmount : BigInt(0);
      } else {
        simNo += changeAmount;
        simYes = simYes > changeAmount ? simYes - changeAmount : BigInt(0);
      }
    }

    const simTotal = simYes + simNo;
    const simulatedYesRate = simTotal > BigInt(0)
      ? Number((simYes * BigInt(10000)) / simTotal)
      : 0;

    const { judgment, probability } = this._determineJudgment(simulatedYesRate, Number(simTotal));

    const timeRemaining = Math.max(0, input.votingEndTimestamp - Math.floor(Date.now() / 1000));

    const whatIfScenarios = this._generateWhatIfScenarios(simYes, simNo);

    const impactAssessment = this._assessImpact(judgment);

    return {
      caseId: input.caseId,
      currentYesRate: currentYesRate / 100,
      simulatedYesRate: simulatedYesRate / 100,
      predictedJudgment: judgment,
      judgmentProbability: probability,
      timeRemaining,
      whatIfScenarios,
      impactAssessment,
    };
  }

  /**
   * 判决判定
   */
  private _determineJudgment(yesRateBps: number, totalVotes: number): { judgment: string; probability: number } {
    if (totalVotes === 0) {
      return { judgment: 'DISMISSED', probability: 1.0 };
    }

    const noRateBps = 10000 - yesRateBps;

    if (yesRateBps >= this.APPROVAL_THRESHOLD) {
      // UPHOLD概率随yesRate增加而增大
      const prob = Math.min((yesRateBps - 5000) / 5000, 1.0);
      return { judgment: 'UPHOLD', probability: prob };
    } else if (noRateBps >= this.APPROVAL_THRESHOLD) {
      // OVERTURN概率随noRate增加而增大
      const prob = Math.min((noRateBps - 5000) / 5000, 1.0);
      return { judgment: 'OVERTURN', probability: prob };
    } else {
      // REMAND
      return { judgment: 'REMAND', probability: 1.0 - Math.abs(yesRateBps - 5000) / 5000 };
    }
  }

  /**
   * 生成what-if场景
   */
  private _generateWhatIfScenarios(yesVotes: bigint, noVotes: bigint): WhatIfScenario[] {
    const scenarios: WhatIfScenario[] = [];
    const total = yesVotes + noVotes;

    if (total === BigInt(0)) return scenarios;

    // Scenario 1: 支持+10%
    const plus10 = (total * BigInt(1000)) / BigInt(10000);
    const yesPlus10 = yesVotes + plus10;
    const noMinus10 = noVotes > plus10 ? noVotes - plus10 : BigInt(0);
    const rate1 = Number((yesPlus10 * BigInt(10000)) / total);
    const j1 = this._determineJudgment(rate1, Number(total));
    scenarios.push({
      description: '支持率+10%',
      yesRate: rate1 / 100,
      judgment: j1.judgment,
      probability: j1.probability,
    });

    // Scenario 2: 支持-10%
    const noPlus10 = (total * BigInt(1000)) / BigInt(10000);
    const noPlus = noVotes + noPlus10;
    const yesMinus = yesVotes > noPlus10 ? yesVotes - noPlus10 : BigInt(0);
    const rate2 = Number((yesMinus * BigInt(10000)) / total);
    const j2 = this._determineJudgment(rate2, Number(total));
    scenarios.push({
      description: '支持率-10%',
      yesRate: rate2 / 100,
      judgment: j2.judgment,
      probability: j2.probability,
    });

    // Scenario 3: 达到67%阈值
    const needed = (total * BigInt(this.APPROVAL_THRESHOLD)) / BigInt(10000);
    if (yesVotes < needed) {
      const gap = needed - yesVotes;
      const rate3 = Number((needed * BigInt(10000)) / total);
      scenarios.push({
        description: `达到67%阈值(需+${gap.toString()}Φ)`,
        yesRate: rate3 / 100,
        judgment: 'UPHOLD',
        probability: 0.67,
      });
    }

    return scenarios;
  }

  /**
   * 评估判决影响
   */
  private _assessImpact(judgment: string): string {
    switch (judgment) {
      case 'UPHOLD':
        return '修正案维持有效。现有治理结构不变，社区共识得到确认。';
      case 'OVERTURN':
        return '修正案被推翻。相关条款将回退到VOTING状态，需重新审议。可能引发连锁修正案调整。';
      case 'REMAND':
        return '案件发回重议。社区需要进一步讨论达成共识，修正案暂缓执行。';
      case 'DISMISSED':
        return '案件因无投票被驳回。修正案保持当前状态不变。';
      default:
        return '无法评估影响。';
    }
  }
}

export const judgmentSimulator = new JudgmentSimulator();
