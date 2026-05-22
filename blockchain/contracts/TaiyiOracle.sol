// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/**
 * @title TaiyiOracle
 * @dev 太乙预言机合约
 *
 * 基于太一万有理论的自指闭环机制，构建去中心化预言机。
 * 预言机不再依赖外部数据源，而是通过Φ场自指递归产生预测——
 * 系统自身的Φ值演化即为最可信的未来指标。
 *
 * 核心设计：
 * - 自指闭环：预测结果反馈影响Φ值，Φ值变化又影响后续预测
 * - 金灵球机制：多预言机节点提交预测，Φ值加权聚合
 * - 预言流程：提交→聚合→结算→反馈的自指闭环
 * - 堆垒素数分类：奇数预测=费米子(互斥)，偶数预测=玻色子(可叠加)
 * - 准确度奖励/惩罚：预测偏差影响预言师Φ值
 *
 * 数学基础：
 * - Φ(t+1) = α·Φ(t) + β·accuracy(t) + γ·consensus(t)
 * - 自指递归：预测→观测→修正→再预测
 */
contract TaiyiOracle is Ownable, Pausable, ReentrancyGuard {

    // =============== Structs ===============

    struct OracleNode {
        address node;
        uint256 phiValue;         // Φ值 (0-10000, 2 decimals)
        int256 phiPhase;         // Φ相位 (×1e6)
        uint256 totalPredictions; // 累计预测数
        uint256 correctPredictions; // 正确预测数
        uint256 accuracy;         // 准确率 (0-10000)
        bool active;
        uint256 registeredAt;
    }

    struct Prediction {
        bytes32 predictionId;
        bytes32 topicId;
        address predictor;
        int256 predictedValue;    // 预测值 (×1e6)
        uint256 confidence;       // 置信度 (0-10000)
        uint256 phiValueAtPrediction; // 预测时的Φ值
        int256 phiPhaseAtPrediction;  // 预测时的Φ相位
        bool isFermion;          // 费米子(互斥)还是玻色子(可叠加)
        uint256 timestamp;
    }

    struct PredictionTopic {
        bytes32 topicId;
        string description;
        int256 actualValue;       // 实际值 (×1e6, INT256_MAX = 未结算)
        uint256 deadline;         // 结算截止
        uint256 createdAt;
        bool settled;
        PredictionType predictionType; // 费米子/玻色子
        uint256 totalFermionPredictions;
        uint256 totalBosonPredictions;
        // 聚合结果
        int256 aggregatedPrediction;
        uint256 aggregatedConfidence;
        uint256 aggregatedPhiWeight;
    }

    struct PhiEvolutionRecord {
        uint256 timestamp;
        uint256 phiValue;
        int256 phiPhase;
        int256 predictionError;
        uint256 accuracy;
    }

    enum PredictionType {
        Fermion,  // 奇数预测：互斥，只有一个正确
        Boson     // 偶数预测：可叠加，多个可以同时正确
    }

    enum SettlementResult {
        Pending,
        FermionWinner,     // 费米子模式：最接近者胜出
        BosonConsensus,     // 玻色子模式：阈值内共享
        NoConsensus,        // 未达成共识
        Expired             // 已过期
    }

    // =============== State Variables ===============

    // 预言机节点
    mapping(address => OracleNode) private s_oracles;
    address[] private s_oracleList;
    uint256 private s_totalOraclePhi;

    // 预测主题
    mapping(bytes32 => PredictionTopic) private s_topics;
    bytes32[] private s_topicList;

    // 预测记录: topicId => predictions
    mapping(bytes32 => Prediction[]) private s_predictions;

    // Φ值演化记录: topicId => evolution
    mapping(bytes32 => PhiEvolutionRecord[]) private s_phiEvolution;

    // 自指闭环参数
    uint256 public alpha = 5000;  // Φ(t)权重 (50%)
    uint256 public beta = 3000;   // accuracy权重 (30%)
    uint256 public gamma = 2000;  // consensus权重 (20%)

    // 结算参数
    uint256 public constant FERMION_TOLERANCE = 500;   // 费米子容差 (5%)
    uint256 public constant BOSON_THRESHOLD = 5000;    // 玻色子共识阈值 (50%)
    uint256 public constant ACCURACY_BOOST = 500;       // 准确度奖励 (5%)
    uint256 public constant INACCURACY_PENALTY = 300;   // 不准确惩罚 (3%)

    uint256 private s_predictionCount;
    uint256 private s_settledCount;

    // =============== Events ===============

    event OracleRegistered(address indexed oracle, uint256 phiValue);
    event OracleDeactivated(address indexed oracle);
    event PredictionTopicCreated(bytes32 indexed topicId, string description, PredictionType predictionType);
    event PredictionSubmitted(bytes32 indexed predictionId, bytes32 indexed topicId, address indexed predictor, int256 value, uint256 confidence);
    event PredictionsAggregated(bytes32 indexed topicId, int256 aggregatedValue, uint256 aggregatedConfidence);
    event TopicSettled(bytes32 indexed topicId, int256 actualValue, SettlementResult result);
    event PhiEvolutionRecorded(bytes32 indexed topicId, uint256 phiValue, int256 phiPhase);
    event OraclePhiUpdated(address indexed oracle, uint256 oldPhi, uint256 newPhi, string reason);

    // =============== Constructor ===============

    constructor() Ownable(msg.sender) {}

    // =============== Oracle Management ===============

    /**
     * @notice 注册预言机节点
     */
    function registerOracle(uint256 initialPhiValue) external whenNotPaused returns (bool) {
        require(!s_oracles[msg.sender].active, "Already registered");
        require(initialPhiValue > 0 && initialPhiValue <= 10000, "Invalid phi value");

        s_oracles[msg.sender] = OracleNode({
            node: msg.sender,
            phiValue: initialPhiValue,
            phiPhase: 0,
            totalPredictions: 0,
            correctPredictions: 0,
            accuracy: 5000, // 初始50%
            active: true,
            registeredAt: block.timestamp
        });
        s_oracleList.push(msg.sender);
        s_totalOraclePhi += initialPhiValue;

        emit OracleRegistered(msg.sender, initialPhiValue);
        return true;
    }

    function deactivateOracle(address oracle) external onlyOwner returns (bool) {
        require(s_oracles[oracle].active, "Not active");
        s_oracles[oracle].active = false;
        s_totalOraclePhi -= s_oracles[oracle].phiValue;

        emit OracleDeactivated(oracle);
        return true;
    }

    // =============== Prediction Topics ===============

    /**
     * @notice 创建预测主题
     * @param description 主题描述
     * @param predictionType 费米子(互斥)/玻色子(可叠加)
     * @param deadlineDays 截止天数
     */
    function createPredictionTopic(
        string calldata description,
        PredictionType predictionType,
        uint256 deadlineDays
    ) external whenNotPaused returns (bytes32) {
        require(bytes(description).length > 0, "Description required");
        require(deadlineDays >= 1 && deadlineDays <= 365, "Invalid deadline");

        bytes32 topicId = keccak256(abi.encodePacked(description, block.timestamp, s_topicList.length));

        s_topics[topicId] = PredictionTopic({
            topicId: topicId,
            description: description,
            actualValue: type(int256).max, // 未结算标记
            deadline: block.timestamp + (deadlineDays * 1 days),
            createdAt: block.timestamp,
            settled: false,
            predictionType: predictionType,
            totalFermionPredictions: 0,
            totalBosonPredictions: 0,
            aggregatedPrediction: 0,
            aggregatedConfidence: 0,
            aggregatedPhiWeight: 0
        });
        s_topicList.push(topicId);

        emit PredictionTopicCreated(topicId, description, predictionType);
        return topicId;
    }

    // =============== Predictions ===============

    /**
     * @notice 提交预言
     * @param topicId 主题ID
     * @param predictedValue 预测值 (×1e6)
     * @param confidence 置信度 (0-10000)
     */
    function submitPrediction(
        bytes32 topicId,
        int256 predictedValue,
        uint256 confidence
    ) external whenNotPaused returns (bytes32) {
        PredictionTopic storage topic = s_topics[topicId];
        require(topic.topicId != bytes32(0), "Topic not found");
        require(!topic.settled, "Topic already settled");
        require(block.timestamp <= topic.deadline, "Topic expired");
        require(s_oracles[msg.sender].active, "Not an active oracle");
        require(confidence > 0 && confidence <= 10000, "Invalid confidence");

        // 堆垒素数分类
        bool isFermion;
        if (topic.predictionType == PredictionType.Fermion) {
            // 费米子：互斥预测（如：二选一、离散事件）
            isFermion = true;
            topic.totalFermionPredictions++;
        } else {
            // 玻色子：可叠加预测（如：连续值、概率估计）
            isFermion = false;
            topic.totalBosonPredictions++;
        }

        bytes32 predictionId = keccak256(abi.encodePacked(
            topicId, msg.sender, predictedValue, block.timestamp, s_predictionCount
        ));

        Prediction memory prediction = Prediction({
            predictionId: predictionId,
            topicId: topicId,
            predictor: msg.sender,
            predictedValue: predictedValue,
            confidence: confidence,
            phiValueAtPrediction: s_oracles[msg.sender].phiValue,
            phiPhaseAtPrediction: s_oracles[msg.sender].phiPhase,
            isFermion: isFermion,
            timestamp: block.timestamp
        });

        s_predictions[topicId].push(prediction);
        s_oracles[msg.sender].totalPredictions++;
        s_predictionCount++;

        // 实时聚合
        _aggregatePredictions(topicId);

        emit PredictionSubmitted(predictionId, topicId, msg.sender, predictedValue, confidence);
        return predictionId;
    }

    /**
     * @notice 结算预言
     * @param topicId 主题ID
     * @param actualValue 实际值 (×1e6)
     */
    function settlePrediction(
        bytes32 topicId,
        int256 actualValue
    ) external onlyOwner whenNotPaused returns (SettlementResult) {
        PredictionTopic storage topic = s_topics[topicId];
        require(topic.topicId != bytes32(0), "Topic not found");
        require(!topic.settled, "Already settled");

        topic.actualValue = actualValue;
        topic.settled = true;

        Prediction[] storage preds = s_predictions[topicId];
        SettlementResult result;

        if (topic.predictionType == PredictionType.Fermion) {
            // 费米子模式：最接近实际值者胜出
            result = _settleFermion(topicId, preds, actualValue);
        } else {
            // 玻色子模式：阈值内共享
            result = _settleBoson(topicId, preds, actualValue);
        }

        // 自指闭环：根据结算结果更新预言机Φ值
        _updatePhiFromSettlement(topicId, preds, actualValue);

        // 记录Φ值演化
        _recordPhiEvolution(topicId, actualValue);

        s_settledCount++;

        emit TopicSettled(topicId, actualValue, result);
        return result;
    }

    // =============== Aggregation ===============

    /**
     * @notice 聚合预测结果（Φ值加权）
     */
    function _aggregatePredictions(bytes32 topicId) internal {
        Prediction[] storage preds = s_predictions[topicId];
        if (preds.length == 0) return;

        int256 weightedSum = 0;
        uint256 totalConfidence = 0;
        uint256 totalPhiWeight = 0;

        for (uint256 i = 0; i < preds.length; i++) {
            uint256 weight = preds[i].phiValueAtPrediction * preds[i].confidence;
            // 避免溢出：weight 最大 = 10000 * 10000 = 1e8
            weightedSum += preds[i].predictedValue * int256(weight / 10000);
            totalConfidence += preds[i].confidence;
            totalPhiWeight += preds[i].phiValueAtPrediction;
        }

        PredictionTopic storage topic = s_topics[topicId];
        if (totalPhiWeight > 0) {
            // 加权平均预测
            topic.aggregatedPrediction = weightedSum / int256(totalPhiWeight);
            topic.aggregatedConfidence = totalConfidence / preds.length;
            topic.aggregatedPhiWeight = totalPhiWeight;
        }

        emit PredictionsAggregated(topicId, topic.aggregatedPrediction, topic.aggregatedConfidence);
    }

    // =============== Settlement Logic ===============

    /**
     * @dev 费米子结算：最接近者胜出（互斥）
     */
    function _settleFermion(
        bytes32 topicId,
        Prediction[] storage preds,
        int256 actualValue
    ) internal returns (SettlementResult) {
        if (preds.length == 0) return SettlementResult.NoConsensus;

        int256 minError = type(int256).max;
        address winner = address(0);
        uint256 winnerPhi = 0;

        for (uint256 i = 0; i < preds.length; i++) {
            int256 error = preds[i].predictedValue > actualValue
                ? preds[i].predictedValue - actualValue
                : actualValue - preds[i].predictedValue;

            // 费米子容差检查
            if (error <= int256(FERMION_TOLERANCE)) {
                // Φ值加权选择最接近者
                if (winner == address(0) ||
                    uint256(error) * (10000 - preds[i].phiValueAtPrediction) <
                    uint256(minError) * (10000 - winnerPhi)) {
                    minError = error;
                    winner = preds[i].predictor;
                    winnerPhi = preds[i].phiValueAtPrediction;
                }
            }
        }

        if (winner == address(0)) return SettlementResult.NoConsensus;
        return SettlementResult.FermionWinner;
    }

    /**
     * @dev 玻色子结算：阈值内共享（可叠加）
     */
    function _settleBoson(
        bytes32 topicId,
        Prediction[] storage preds,
        int256 actualValue
    ) internal returns (SettlementResult) {
        if (preds.length == 0) return SettlementResult.NoConsensus;

        uint256 correctCount = 0;
        for (uint256 i = 0; i < preds.length; i++) {
            int256 error = preds[i].predictedValue > actualValue
                ? preds[i].predictedValue - actualValue
                : actualValue - preds[i].predictedValue;

            if (error <= int256(BOSON_THRESHOLD)) {
                correctCount++;
            }
        }

        if (correctCount * 10000 / preds.length >= BOSON_THRESHOLD) {
            return SettlementResult.BosonConsensus;
        }

        return SettlementResult.NoConsensus;
    }

    // =============== Self-Referential Feedback Loop ===============

    /**
     * @dev 自指闭环：根据预测准确度更新预言机Φ值
     * Φ(t+1) = α·Φ(t) + β·accuracy(t) + γ·consensus(t)
     */
    function _updatePhiFromSettlement(
        bytes32 topicId,
        Prediction[] storage preds,
        int256 actualValue
    ) internal {
        for (uint256 i = 0; i < preds.length; i++) {
            OracleNode storage oracle = s_oracles[preds[i].predictor];
            if (!oracle.active) continue;

            int256 error = preds[i].predictedValue > actualValue
                ? preds[i].predictedValue - actualValue
                : actualValue - preds[i].predictedValue;

            // 计算本次准确度 (0-10000)
            uint256 thisAccuracy;
            if (error == 0) {
                thisAccuracy = 10000;
            } else if (error > int256(preds[i].phiValueAtPrediction)) {
                thisAccuracy = 0;
            } else {
                thisAccuracy = uint256(int256(10000) - (error * 10000 / int256(preds[i].phiValueAtPrediction)));
            }

            // 更新预言机累计准确率
            oracle.correctPredictions += thisAccuracy >= 7000 ? 1 : 0;
            oracle.accuracy = oracle.totalPredictions > 0
                ? (oracle.correctPredictions * 10000) / oracle.totalPredictions
                : 5000;

            // 计算共识度
            uint256 consensusScore = _calculateConsensus(preds[i].predictor, topicId);

            // 自指闭环公式
            uint256 oldPhi = oracle.phiValue;
            uint256 newPhi = (
                alpha * oldPhi +
                beta * thisAccuracy +
                gamma * consensusScore
            ) / 10000;

            // 准确度奖励/惩罚
            if (thisAccuracy >= 8000) {
                newPhi += ACCURACY_BOOST;
            } else if (thisAccuracy < 3000) {
                newPhi = newPhi > INACCURACY_PENALTY ? newPhi - INACCURACY_PENALTY : 0;
            }

            // 限制范围
            newPhi = newPhi > 10000 ? 10000 : newPhi;

            // 更新总量
            s_totalOraclePhi = s_totalOraclePhi - oldPhi + newPhi;
            oracle.phiValue = newPhi;

            // 更新相位
            oracle.phiPhase = int256(uint256(keccak256(abi.encodePacked(
                oracle.phiPhase, actualValue, block.timestamp
            )))) % 3141593; // ±π × 1e6

            emit OraclePhiUpdated(preds[i].predictor, oldPhi, newPhi,
                thisAccuracy >= 7000 ? "accuracy_reward" : "accuracy_penalty");
        }
    }

    /**
     * @dev 计算共识度
     */
    function _calculateConsensus(address predictor, bytes32 topicId) internal view returns (uint256) {
        Prediction[] storage preds = s_predictions[topicId];
        if (preds.length <= 1) return 5000; // 默认50%

        // 找到该预测者的预测
        int256 myPrediction = 0;
        bool found = false;
        for (uint256 i = 0; i < preds.length; i++) {
            if (preds[i].predictor == predictor) {
                myPrediction = preds[i].predictedValue;
                found = true;
                break;
            }
        }
        if (!found) return 5000;

        // 计算与其他预测者的共识度
        uint256 agreementCount = 0;
        for (uint256 i = 0; i < preds.length; i++) {
            if (preds[i].predictor == predictor) continue;
            int256 diff = myPrediction > preds[i].predictedValue
                ? myPrediction - preds[i].predictedValue
                : preds[i].predictedValue - myPrediction;
            if (diff < int256(FERMION_TOLERANCE * 10)) {
                agreementCount++;
            }
        }

        return (agreementCount * 10000) / (preds.length - 1);
    }

    /**
     * @dev 记录Φ值演化
     */
    function _recordPhiEvolution(bytes32 topicId, int256 actualValue) internal {
        PredictionTopic storage topic = s_topics[topicId];
        int256 predictionError = topic.aggregatedPrediction - actualValue;

        s_phiEvolution[topicId].push(PhiEvolutionRecord({
            timestamp: block.timestamp,
            phiValue: topic.aggregatedPhiWeight / (s_predictions[topicId].length > 0 ? s_predictions[topicId].length : 1),
            phiPhase: 0,
            predictionError: predictionError,
            accuracy: topic.aggregatedConfidence
        }));

        emit PhiEvolutionRecorded(topicId,
            topic.aggregatedPhiWeight / (s_predictions[topicId].length > 0 ? s_predictions[topicId].length : 1),
            0
        );
    }

    // =============== View Functions ===============

    function getOracle(address oracle) external view returns (OracleNode memory) {
        return s_oracles[oracle];
    }

    function getOracleCount() external view returns (uint256) {
        return s_oracleList.length;
    }

    function getActiveOracleCount() external view returns (uint256) {
        uint256 count = 0;
        for (uint256 i = 0; i < s_oracleList.length; i++) {
            if (s_oracles[s_oracleList[i]].active) count++;
        }
        return count;
    }

    function getTotalOraclePhi() external view returns (uint256) {
        return s_totalOraclePhi;
    }

    function getTopic(bytes32 topicId) external view returns (PredictionTopic memory) {
        return s_topics[topicId];
    }

    function getTopicCount() external view returns (uint256) {
        return s_topicList.length;
    }

    function getPredictions(bytes32 topicId) external view returns (Prediction[] memory) {
        return s_predictions[topicId];
    }

    function getPredictionCount(bytes32 topicId) external view returns (uint256) {
        return s_predictions[topicId].length;
    }

    function getPhiEvolution(bytes32 topicId) external view returns (PhiEvolutionRecord[] memory) {
        return s_phiEvolution[topicId];
    }

    function getSettledCount() external view returns (uint256) {
        return s_settledCount;
    }

    // =============== Admin ===============

    function setFeedbackParams(uint256 _alpha, uint256 _beta, uint256 _gamma) external onlyOwner {
        require(_alpha + _beta + _gamma == 10000, "Params must sum to 10000");
        alpha = _alpha;
        beta = _beta;
        gamma = _gamma;
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }
}
