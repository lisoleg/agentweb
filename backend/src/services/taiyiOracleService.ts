/**
 * Taiyi Oracle Service - 太乙预言机服务
 *
 * 基于太一万有理论的自指闭环机制，构建去中心化预言机。
 * 预言机不再依赖外部数据源，而是通过Φ场自指递归产生预测——
 * 系统自身的Φ值演化即为最可信的未来指标。
 *
 * 核心设计：
 * - 自指递归预测引擎：预测→观测→修正→再预测
 * - 金灵球机制：多节点加权共识（与phiBftConsensus集成）
 * - Φ值演化追踪：Φ(t+1) = α·Φ(t) + β·accuracy(t) + γ·consensus(t)
 * - 堆垒素数分类：奇数=费米子(互斥)，偶数=玻色子(可叠加)
 * - 准确度奖励/惩罚：预测偏差影响预言师Φ值
 */

import * as crypto from 'crypto';

// =============== Types ===============

export enum PredictionType {
  Fermion = 'Fermion',  // 奇数预测：互斥，只有一个正确
  Boson = 'Boson',      // 偶数预测：可叠加，多个可以同时正确
}

export enum SettlementResult {
  Pending = 'Pending',
  FermionWinner = 'FermionWinner',
  BosonConsensus = 'BosonConsensus',
  NoConsensus = 'NoConsensus',
  Expired = 'Expired',
}

export interface OracleNode {
  address: string;
  phiValue: number;         // Φ值 (0-1)
  phiPhase: number;         // Φ相位 (弧度)
  totalPredictions: number;
  correctPredictions: number;
  accuracy: number;          // 准确率 (0-1)
  active: boolean;
  registeredAt: number;
}

export interface Prediction {
  predictionId: string;
  topicId: string;
  predictor: string;
  predictedValue: number;
  confidence: number;        // 置信度 (0-1)
  phiValueAtPrediction: number;
  phiPhaseAtPrediction: number;
  isFermion: boolean;
  timestamp: number;
}

export interface PredictionTopic {
  topicId: string;
  description: string;
  actualValue: number | null;  // null = 未结算
  deadline: number;
  createdAt: number;
  settled: boolean;
  predictionType: PredictionType;
  totalFermionPredictions: number;
  totalBosonPredictions: number;
  // 聚合结果
  aggregatedPrediction: number;
  aggregatedConfidence: number;
  aggregatedPhiWeight: number;
  settlementResult?: SettlementResult;
}

export interface PhiEvolutionRecord {
  timestamp: number;
  phiValue: number;
  phiPhase: number;
  predictionError: number;
  accuracy: number;
  selfReferentialDelta: number; // 自指闭环增量
}

// =============== Self-Referential Prediction Engine ===============

/**
 * 自指递归预测引擎
 *
 * 核心公式：Φ(t+1) = α·Φ(t) + β·accuracy(t) + γ·consensus(t)
 *
 * 预测不再依赖外部数据，而是：
 * 1. 收集多个预言机的Φ值加权预测
 * 2. 金灵球聚合产生共识预测
 * 3. 观测实际值后，计算准确度
 * 4. 准确度反馈修正预言机Φ值
 * 5. 新的Φ值影响下一轮预测权重
 * → 形成自指闭环
 */
class SelfReferentialEngine {
  // 自指闭环参数
  private alpha = 0.5;  // Φ(t)权重
  private beta = 0.3;  // accuracy权重
  private gamma = 0.2;  // consensus权重

  // 奖惩参数
  private readonly ACCURACY_BOOST = 0.05;
  private readonly INACCURACY_PENALTY = 0.03;

  /**
   * 计算自指闭环Φ值更新
   */
  calculatePhiUpdate(params: {
    currentPhi: number;
    accuracy: number;      // 本次准确度 (0-1)
    consensusScore: number; // 共识度 (0-1)
  }): { newPhi: number; delta: number; reason: string } {
    const { currentPhi, accuracy, consensusScore } = params;

    // 自指闭环公式
    let newPhi = this.alpha * currentPhi + this.beta * accuracy + this.gamma * consensusScore;

    // 准确度奖惩
    let reason = 'normal';
    if (accuracy >= 0.8) {
      newPhi += this.ACCURACY_BOOST;
      reason = 'accuracy_reward';
    } else if (accuracy < 0.3) {
      newPhi = Math.max(0, newPhi - this.INACCURACY_PENALTY);
      reason = 'accuracy_penalty';
    }

    // 限制范围 [0, 1]
    newPhi = Math.min(1.0, Math.max(0, newPhi));

    const delta = newPhi - currentPhi;

    return { newPhi, delta, reason };
  }

  /**
   * 计算预测准确度
   */
  calculateAccuracy(predictedValue: number, actualValue: number, phiValue: number): number {
    if (actualValue === 0) return predictedValue === 0 ? 1.0 : 0;
    const relativeError = Math.abs(predictedValue - actualValue) / Math.abs(actualValue);
    // 准确度 = 1 - 相对误差，但不超过1
    return Math.max(0, 1 - relativeError);
  }

  /**
   * Φ值加权聚合预测
   */
  aggregatePredictions(predictions: Prediction[]): {
    aggregatedValue: number;
    aggregatedConfidence: number;
    totalPhiWeight: number;
  } {
    if (predictions.length === 0) {
      return { aggregatedValue: 0, aggregatedConfidence: 0, totalPhiWeight: 0 };
    }

    let weightedSum = 0;
    let totalWeight = 0;
    let totalConfidence = 0;

    for (const pred of predictions) {
      // 权重 = Φ值 × 置信度
      const weight = pred.phiValueAtPrediction * pred.confidence;
      weightedSum += pred.predictedValue * weight;
      totalWeight += weight;
      totalConfidence += pred.confidence;
    }

    const aggregatedValue = totalWeight > 0 ? weightedSum / totalWeight : 0;
    const aggregatedConfidence = predictions.length > 0 ? totalConfidence / predictions.length : 0;

    return {
      aggregatedValue,
      aggregatedConfidence,
      totalPhiWeight: predictions.reduce((sum, p) => sum + p.phiValueAtPrediction, 0),
    };
  }

  /**
   * 计算共识度
   */
  calculateConsensus(predictions: Prediction[], predictorAddress: string): number {
    const myPrediction = predictions.find(p => p.predictor === predictorAddress);
    if (!myPrediction) return 0.5;

    let agreementCount = 0;
    const tolerance = 0.05; // 5%容差

    for (const pred of predictions) {
      if (pred.predictor === predictorAddress) continue;
      const relativeDiff = Math.abs(myPrediction.predictedValue - pred.predictedValue)
        / (Math.abs(myPrediction.predictedValue) || 1);
      if (relativeDiff < tolerance * 10) {
        agreementCount++;
      }
    }

    return predictions.length > 1 ? agreementCount / (predictions.length - 1) : 0.5;
  }

  // 设置参数
  setParams(alpha: number, beta: number, gamma: number): void {
    const sum = alpha + beta + gamma;
    if (Math.abs(sum - 1.0) > 0.01) {
      throw new Error(`Parameters must sum to 1.0, got ${sum}`);
    }
    this.alpha = alpha;
    this.beta = beta;
    this.gamma = gamma;
  }

  getParams(): { alpha: number; beta: number; gamma: number } {
    return { alpha: this.alpha, beta: this.beta, gamma: this.gamma };
  }
}

// =============== Taiyi Oracle Service ===============

class TaiyiOracleServiceClass {
  private oracles: Map<string, OracleNode> = new Map();
  private topics: Map<string, PredictionTopic> = new Map();
  private predictions: Map<string, Prediction[]> = new Map(); // topicId => predictions
  private phiEvolution: Map<string, PhiEvolutionRecord[]> = new Map();
  private engine: SelfReferentialEngine = new SelfReferentialEngine();
  private predictionCount: number = 0;

  // =============== Oracle Management ===============

  /**
   * 注册预言机节点
   */
  registerOracle(address: string, initialPhiValue: number): OracleNode {
    if (this.oracles.has(address)) {
      throw new Error(`Oracle ${address} already registered`);
    }
    if (initialPhiValue <= 0 || initialPhiValue > 1) {
      throw new Error('Invalid phi value (0-1)');
    }

    const oracle: OracleNode = {
      address,
      phiValue: initialPhiValue,
      phiPhase: 0,
      totalPredictions: 0,
      correctPredictions: 0,
      accuracy: 0.5, // 初始50%
      active: true,
      registeredAt: Date.now(),
    };

    this.oracles.set(address, oracle);

    console.log(`✅ [TaiyiOracle] Oracle registered: ${address} (Φ=${initialPhiValue.toFixed(4)})`);
    return oracle;
  }

  /**
   * 停用预言机
   */
  deactivateOracle(address: string): boolean {
    const oracle = this.oracles.get(address);
    if (!oracle || !oracle.active) throw new Error('Oracle not active');

    oracle.active = false;
    console.log(`⛔ [TaiyiOracle] Oracle deactivated: ${address}`);
    return true;
  }

  // =============== Prediction Topics ===============

  /**
   * 创建预测主题
   */
  createPredictionTopic(params: {
    description: string;
    predictionType: PredictionType;
    deadlineDays: number;
  }): PredictionTopic {
    const { description, predictionType, deadlineDays } = params;

    if (!description) throw new Error('Description required');
    if (deadlineDays < 1 || deadlineDays > 365) throw new Error('Invalid deadline');

    const topicId = `topic_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

    const topic: PredictionTopic = {
      topicId,
      description,
      actualValue: null,
      deadline: Date.now() + deadlineDays * 86400 * 1000,
      createdAt: Date.now(),
      settled: false,
      predictionType,
      totalFermionPredictions: 0,
      totalBosonPredictions: 0,
      aggregatedPrediction: 0,
      aggregatedConfidence: 0,
      aggregatedPhiWeight: 0,
    };

    this.topics.set(topicId, topic);
    this.predictions.set(topicId, []);

    console.log(`📋 [TaiyiOracle] Topic created: ${topicId} (${predictionType})`);
    return topic;
  }

  // =============== Predictions ===============

  /**
   * 提交预言
   */
  submitPrediction(params: {
    topicId: string;
    predictor: string;
    predictedValue: number;
    confidence: number;
  }): Prediction {
    const { topicId, predictor, predictedValue, confidence } = params;

    const topic = this.topics.get(topicId);
    if (!topic) throw new Error('Topic not found');
    if (topic.settled) throw new Error('Topic already settled');
    if (Date.now() > topic.deadline) throw new Error('Topic expired');

    const oracle = this.oracles.get(predictor);
    if (!oracle || !oracle.active) throw new Error('Not an active oracle');
    if (confidence <= 0 || confidence > 1) throw new Error('Invalid confidence');

    // 堆垒素数分类
    const isFermion = topic.predictionType === PredictionType.Fermion;
    if (isFermion) {
      topic.totalFermionPredictions++;
    } else {
      topic.totalBosonPredictions++;
    }

    const predictionId = `pred_${topicId}_${Date.now()}_${this.predictionCount++}`;

    const prediction: Prediction = {
      predictionId,
      topicId,
      predictor,
      predictedValue,
      confidence,
      phiValueAtPrediction: oracle.phiValue,
      phiPhaseAtPrediction: oracle.phiPhase,
      isFermion,
      timestamp: Date.now(),
    };

    this.predictions.get(topicId)!.push(prediction);
    oracle.totalPredictions++;

    // 实时聚合
    this._aggregatePredictions(topicId);

    console.log(`🔮 [TaiyiOracle] Prediction submitted: ${predictionId} by ${predictor} (value=${predictedValue}, Φ=${oracle.phiValue.toFixed(4)})`);
    return prediction;
  }

  /**
   * 结算预言
   */
  settlePrediction(params: {
    topicId: string;
    actualValue: number;
  }): { topic: PredictionTopic; result: SettlementResult; phiUpdates: Array<{ oracle: string; oldPhi: number; newPhi: number; reason: string }> } {
    const { topicId, actualValue } = params;

    const topic = this.topics.get(topicId);
    if (!topic) throw new Error('Topic not found');
    if (topic.settled) throw new Error('Already settled');

    topic.actualValue = actualValue;
    topic.settled = true;

    const preds = this.predictions.get(topicId) || [];

    // 根据类型结算
    let result: SettlementResult;
    if (topic.predictionType === PredictionType.Fermion) {
      result = this._settleFermion(preds, actualValue);
    } else {
      result = this._settleBoson(preds, actualValue);
    }

    topic.settlementResult = result;

    // 自指闭环：根据结算结果更新预言机Φ值
    const phiUpdates = this._updatePhiFromSettlement(topicId, preds, actualValue);

    // 记录Φ值演化
    this._recordPhiEvolution(topicId, actualValue);

    console.log(`🏁 [TaiyiOracle] Topic settled: ${topicId} → ${result}`);
    console.log(`   Actual: ${actualValue}, Predicted: ${topic.aggregatedPrediction.toFixed(4)}`);

    return { topic, result, phiUpdates };
  }

  // =============== Aggregation ===============

  /**
   * 聚合预测结果（Φ值加权）
   */
  private _aggregatePredictions(topicId: string): void {
    const preds = this.predictions.get(topicId) || [];
    if (preds.length === 0) return;

    const { aggregatedValue, aggregatedConfidence, totalPhiWeight } = this.engine.aggregatePredictions(preds);

    const topic = this.topics.get(topicId)!;
    topic.aggregatedPrediction = aggregatedValue;
    topic.aggregatedConfidence = aggregatedConfidence;
    topic.aggregatedPhiWeight = totalPhiWeight;

    console.log(`📊 [TaiyiOracle] Aggregated: ${aggregatedValue.toFixed(4)} (confidence: ${aggregatedConfidence.toFixed(4)}, Φ-weight: ${totalPhiWeight.toFixed(4)})`);
  }

  // =============== Settlement Logic ===============

  /**
   * 费米子结算：最接近者胜出（互斥）
   */
  private _settleFermion(preds: Prediction[], actualValue: number): SettlementResult {
    if (preds.length === 0) return SettlementResult.NoConsensus;

    const FERMION_TOLERANCE = 0.05; // 5%容差

    let minError = Infinity;
    let winner: string | null = null;

    for (const pred of preds) {
      const relativeError = Math.abs(pred.predictedValue - actualValue) / (Math.abs(actualValue) || 1);

      if (relativeError <= FERMION_TOLERANCE) {
        // Φ值加权选择最接近者
        if (winner === null || relativeError * (1 - pred.phiValueAtPrediction) < minError * (1 - preds.find(p => p.predictor === winner)!.phiValueAtPrediction)) {
          minError = relativeError;
          winner = pred.predictor;
        }
      }
    }

    return winner ? SettlementResult.FermionWinner : SettlementResult.NoConsensus;
  }

  /**
   * 玻色子结算：阈值内共享（可叠加）
   */
  private _settleBoson(preds: Prediction[], actualValue: number): SettlementResult {
    if (preds.length === 0) return SettlementResult.NoConsensus;

    const BOSON_THRESHOLD = 0.5; // 50%容差
    let correctCount = 0;

    for (const pred of preds) {
      const relativeError = Math.abs(pred.predictedValue - actualValue) / (Math.abs(actualValue) || 1);
      if (relativeError <= BOSON_THRESHOLD) {
        correctCount++;
      }
    }

    const consensusRatio = correctCount / preds.length;
    return consensusRatio >= BOSON_THRESHOLD
      ? SettlementResult.BosonConsensus
      : SettlementResult.NoConsensus;
  }

  // =============== Self-Referential Feedback Loop ===============

  /**
   * 自指闭环：根据预测准确度更新预言机Φ值
   */
  private _updatePhiFromSettlement(
    topicId: string,
    preds: Prediction[],
    actualValue: number
  ): Array<{ oracle: string; oldPhi: number; newPhi: number; reason: string }> {
    const updates: Array<{ oracle: string; oldPhi: number; newPhi: number; reason: string }> = [];

    for (const pred of preds) {
      const oracle = this.oracles.get(pred.predictor);
      if (!oracle || !oracle.active) continue;

      // 计算准确度
      const accuracy = this.engine.calculateAccuracy(
        pred.predictedValue, actualValue, oracle.phiValue
      );

      // 更新累计准确率
      if (accuracy >= 0.7) oracle.correctPredictions++;
      oracle.accuracy = oracle.totalPredictions > 0
        ? oracle.correctPredictions / oracle.totalPredictions
        : 0.5;

      // 计算共识度
      const consensusScore = this.engine.calculateConsensus(preds, pred.predictor);

      // 自指闭环公式
      const { newPhi, reason } = this.engine.calculatePhiUpdate({
        currentPhi: oracle.phiValue,
        accuracy,
        consensusScore,
      });

      const oldPhi = oracle.phiValue;
      oracle.phiValue = newPhi;

      // 更新相位
      oracle.phiPhase = (oracle.phiPhase + Math.atan2(actualValue - pred.predictedValue, pred.predictedValue || 1)) % (2 * Math.PI);

      updates.push({ oracle: pred.predictor, oldPhi, newPhi, reason });

      console.log(`🔄 [TaiyiOracle] Φ update: ${pred.predictor} ${oldPhi.toFixed(4)} → ${newPhi.toFixed(4)} (${reason})`);
    }

    return updates;
  }

  /**
   * 记录Φ值演化
   */
  private _recordPhiEvolution(topicId: string, actualValue: number): void {
    const topic = this.topics.get(topicId)!;
    const preds = this.predictions.get(topicId) || [];

    const predictionError = topic.aggregatedPrediction - actualValue;
    const selfReferentialDelta = preds.length > 0
      ? preds.reduce((sum, p) => sum + (this.oracles.get(p.predictor)?.phiValue || 0) - p.phiValueAtPrediction, 0) / preds.length
      : 0;

    const record: PhiEvolutionRecord = {
      timestamp: Date.now(),
      phiValue: topic.aggregatedPhiWeight / (preds.length || 1),
      phiPhase: 0,
      predictionError,
      accuracy: topic.aggregatedConfidence,
      selfReferentialDelta,
    };

    if (!this.phiEvolution.has(topicId)) {
      this.phiEvolution.set(topicId, []);
    }
    this.phiEvolution.get(topicId)!.push(record);

    console.log(`📈 [TaiyiOracle] Φ evolution recorded: error=${predictionError.toFixed(4)}, selfRefDelta=${selfReferentialDelta.toFixed(4)}`);
  }

  // =============== Query Methods ===============

  getOracle(address: string): OracleNode | undefined {
    return this.oracles.get(address);
  }

  getActiveOracles(): OracleNode[] {
    return Array.from(this.oracles.values()).filter(o => o.active);
  }

  getTopic(topicId: string): PredictionTopic | undefined {
    return this.topics.get(topicId);
  }

  getPredictions(topicId: string): Prediction[] {
    return this.predictions.get(topicId) || [];
  }

  getPhiEvolution(topicId: string): PhiEvolutionRecord[] {
    return this.phiEvolution.get(topicId) || [];
  }

  getEngineParams(): { alpha: number; beta: number; gamma: number } {
    return this.engine.getParams();
  }

  setEngineParams(alpha: number, beta: number, gamma: number): void {
    this.engine.setParams(alpha, beta, gamma);
  }
}

export const taiyiOracleService = new TaiyiOracleServiceClass();
