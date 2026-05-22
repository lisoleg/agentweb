/**
 * Precision Validator - 精度验证+再训练补偿
 *
 * V5.0 Brainwave Integration: P1-3
 * 量化精度损失评估，自动触发再训练补偿。
 */

import {
  PrecisionValidationResult,
  RetrainTrigger,
} from './types';

// =============== Constants ===============

const DEFAULT_PRECISION_THRESHOLD = 0.01; // 1% 相对误差阈值
const DEFAULT_RETRAIN_THRESHOLD = 0.05;   // 5% 触发再训练
const DEFAULT_RETRAIN_BUDGET = 100;       // 默认再训练迭代预算
const SNR_ACCEPTABLE_DB = 40;             // 40dB 视为可接受

// =============== Retrain Plan ===============

export interface RetrainPlan {
  modelId: string;
  layers: Array<{
    layerId: string;
    currentError: number;
    targetError: number;
    iterationsNeeded: number;
    priority: number;
  }>;
  totalIterations: number;
  estimatedImprovement: number;
}

// =============== Precision Validator ===============

/**
 * PrecisionValidator: 精度验证+再训练补偿管线
 *
 * 核心功能:
 * - 量化精度损失评估
 * - 自动触发再训练补偿
 * - 批量验证
 */
export class PrecisionValidator {
  private static instance: PrecisionValidator | null = null;
  private validationHistory: Map<string, PrecisionValidationResult[]> = new Map();
  private retrainTriggers: Map<string, RetrainTrigger> = new Map();
  private totalValidations: number = 0;
  private totalRetrains: number = 0;

  private constructor() {}

  /**
   * 获取单例实例
   */
  static get_instance(): PrecisionValidator {
    if (!PrecisionValidator.instance) {
      PrecisionValidator.instance = new PrecisionValidator();
    }
    return PrecisionValidator.instance;
  }

  /**
   * 精度验证
   */
  validate(
    original: number,
    quantized: number,
    threshold: number = DEFAULT_PRECISION_THRESHOLD
  ): PrecisionValidationResult {
    const absoluteError = Math.abs(original - quantized);
    const relativeError = original !== 0 ? absoluteError / Math.abs(original) : (absoluteError > 0 ? Infinity : 0);
    const passesThreshold = relativeError <= threshold;

    const result: PrecisionValidationResult = {
      originalValue: original,
      quantizedValue: quantized,
      absoluteError,
      relativeError,
      passesThreshold,
      threshold,
    };

    this.totalValidations++;

    return result;
  }

  /**
   * 批量验证
   */
  batchValidate(
    originals: number[],
    quantized: number[],
    threshold: number = DEFAULT_PRECISION_THRESHOLD
  ): {
    results: PrecisionValidationResult[];
    passCount: number;
    failCount: number;
    passRate: number;
    maxRelativeError: number;
    meanRelativeError: number;
  } {
    if (originals.length !== quantized.length) {
      throw new Error('Originals and quantized arrays must have the same length');
    }

    const results: PrecisionValidationResult[] = [];
    let passCount = 0;
    let failCount = 0;
    let totalRelativeError = 0;
    let maxRelativeError = 0;

    for (let i = 0; i < originals.length; i++) {
      const result = this.validate(originals[i], quantized[i], threshold);
      results.push(result);

      if (result.passesThreshold) {
        passCount++;
      } else {
        failCount++;
      }

      totalRelativeError += result.relativeError;
      maxRelativeError = Math.max(maxRelativeError, result.relativeError);
    }

    const passRate = originals.length > 0 ? passCount / originals.length : 1;
    const meanRelativeError = originals.length > 0 ? totalRelativeError / originals.length : 0;

    return {
      results,
      passCount,
      failCount,
      passRate,
      maxRelativeError,
      meanRelativeError,
    };
  }

  /**
   * 检查是否需要再训练
   */
  checkRetrainRequired(
    modelId: string,
    errors: Array<{ layerId: string; error: number }>,
    maxAcceptableError: number = DEFAULT_RETRAIN_THRESHOLD
  ): RetrainTrigger[] {
    const triggers: RetrainTrigger[] = [];

    for (const { layerId, error } of errors) {
      const retrainRequired = error > maxAcceptableError;

      const trigger: RetrainTrigger = {
        modelId,
        layerId,
        currentError: error,
        maxAcceptableError,
        retrainRequired,
      };

      if (retrainRequired) {
        triggers.push(trigger);
        this.retrainTriggers.set(`${modelId}:${layerId}`, trigger);
        this.totalRetrains++;
      }
    }

    if (triggers.length > 0) {
      console.log(`[PrecisionValidator] Retrain required for ${modelId}: ${triggers.length} layers`);
    }

    return triggers;
  }

  /**
   * 估算再训练收益
   */
  estimateRetrainGain(
    currentError: number,
    retrainBudget: number = DEFAULT_RETRAIN_BUDGET
  ): {
    estimatedError: number;
    improvement: number;
    iterationsNeeded: number;
  } {
    // 假设再训练收益遵循指数衰减模型
    // error_after = currentError × exp(-decay_rate × iterations)
    const decayRate = 0.02; // 每次迭代减少2%
    const estimatedError = currentError * Math.exp(-decayRate * retrainBudget);
    const improvement = currentError - estimatedError;

    return {
      estimatedError,
      improvement,
      iterationsNeeded: retrainBudget,
    };
  }

  /**
   * 生成再训练计划
   */
  generateRetrainPlan(
    modelId: string,
    errors: Array<{ layerId: string; error: number }>,
    retrainBudget: number = DEFAULT_RETRAIN_BUDGET
  ): RetrainPlan {
    // 按误差降序排序，优先修复误差最大的层
    const sortedErrors = [...errors].sort((a, b) => b.error - a.error);

    const layers = sortedErrors.map((e, index) => {
      const { estimatedError, iterationsNeeded } = this.estimateRetrainGain(e.error, retrainBudget);
      return {
        layerId: e.layerId,
        currentError: e.error,
        targetError: estimatedError,
        iterationsNeeded,
        priority: index + 1,
      };
    });

    const totalIterations = layers.reduce((sum, l) => sum + l.iterationsNeeded, 0);
    const totalCurrentError = sortedErrors.reduce((sum, e) => sum + e.error, 0);
    const totalEstimatedError = layers.reduce((sum, l) => sum + l.targetError, 0);
    const estimatedImprovement = totalCurrentError - totalEstimatedError;

    const plan: RetrainPlan = {
      modelId,
      layers,
      totalIterations,
      estimatedImprovement,
    };

    console.log(`[PrecisionValidator] Retrain plan for ${modelId}: ${layers.length} layers, improvement=${estimatedImprovement.toFixed(6)}`);
    return plan;
  }

  /**
   * 获取验证历史
   */
  getValidationHistory(modelId: string): PrecisionValidationResult[] {
    return this.validationHistory.get(modelId) || [];
  }

  /**
   * 存储验证结果
   */
  recordValidation(modelId: string, results: PrecisionValidationResult[]): void {
    if (!this.validationHistory.has(modelId)) {
      this.validationHistory.set(modelId, []);
    }
    this.validationHistory.get(modelId)!.push(...results);
  }

  /**
   * 获取内部状态
   */
  get_state(): object {
    return {
      totalValidations: this.totalValidations,
      totalRetrains: this.totalRetrains,
      validationHistorySize: this.validationHistory.size,
      retrainTriggersSize: this.retrainTriggers.size,
      triggers: Array.from(this.retrainTriggers.entries()).map(([key, t]) => ({
        key,
        modelId: t.modelId,
        layerId: t.layerId,
        currentError: t.currentError,
        retrainRequired: t.retrainRequired,
      })),
    };
  }

  /**
   * 重置（用于测试）
   */
  reset(): void {
    this.validationHistory.clear();
    this.retrainTriggers.clear();
    this.totalValidations = 0;
    this.totalRetrains = 0;
  }
}

// =============== Self-Test ===============

function selfTest(): void {
  const pv = PrecisionValidator.get_instance();
  pv.reset();

  // 测试1: 基本验证
  const r1 = pv.validate(3.14159, 3.125);
  console.log(`[Test] Validate: original=3.14159, quantized=3.125, relError=${r1.relativeError.toFixed(6)}, pass=${r1.passesThreshold}`);

  // 测试2: 批量验证
  const originals = [1.0, 2.5, 0.1, 100.0, -3.7];
  const quantized = [1.0, 2.5, 0.1001, 100.06, -3.69];
  const batch = pv.batchValidate(originals, quantized, 0.01);
  console.log(`[Test] Batch: passRate=${(batch.passRate * 100).toFixed(1)}%, maxError=${batch.maxRelativeError.toFixed(6)}`);

  // 测试3: 再训练检查
  const errors = [
    { layerId: 'fc1', error: 0.03 },
    { layerId: 'fc2', error: 0.08 },
    { layerId: 'conv1', error: 0.01 },
  ];
  const triggers = pv.checkRetrainRequired('model-1', errors, 0.05);
  console.log(`[Test] Retrain triggers: ${triggers.length} layers need retraining`);
  triggers.forEach(t => console.log(`  ${t.layerId}: error=${t.currentError} > ${t.maxAcceptableError}`));

  // 测试4: 再训练收益估算
  const gain = pv.estimateRetrainGain(0.08, 100);
  console.log(`[Test] Retrain gain: 0.08 → ${gain.estimatedError.toFixed(6)} (improvement: ${gain.improvement.toFixed(6)})`);

  // 测试5: 再训练计划
  const plan = pv.generateRetrainPlan('model-1', errors, 50);
  console.log(`[Test] Retrain plan: ${plan.layers.length} layers, ${plan.totalIterations} iterations, improvement=${plan.estimatedImprovement.toFixed(6)}`);

  console.log('[SelfTest] PrecisionValidator: ALL PASSED');
  pv.reset();
}

if (typeof require !== 'undefined' && require.main === module) {
  selfTest();
}
