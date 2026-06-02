// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title TokenWeightVault — V14.0 Token-Weight 激励引擎链上存储
 * @notice 对应文章1 §2.2 + 文章2：Token是智能体的状态机
 *
 * 核心公式:
 * - Token = ⟨sym, χ, ρ, κ⟩ 四重属性
 * - Weight = (利[突触权重], 名[偏置项], 权[门控机制]) 三类
 * - 十二面灵球: Token₄ × Weight₃ = 12维文明交互空间
 * - Gi-Gi 握手: w_{ab} += η · ρ_{sal}(τ) · α_b
 *
 * 神经映射:
 *   [利] → Synaptic Weights  (突触权重，物质连接强度)
 *   [名] → Bias              (偏置项，神经元自身兴奋基线)
 *   [权] → Gate              (门控机制，控制信息流开关)
 */

contract TokenWeightVault {
    // =============== Enums ===============

    enum PortHandedness {
        STRONG_NEGATIVE,  // -2 强反对
        WEAK_NEGATIVE,    // -1 弱反对
        NEUTRAL,           //  0 中性
        WEAK_POSITIVE,     // +1 弱支持
        STRONG_POSITIVE    // +2 强支持
    }

    enum DodecahedralVertex {
        V0_LOW_DIMENSION,          // 0  低维：普通日常交互
        V1_HIGH_LI_HIGH_MING,     // 1  高[利]+高[名]：市场交易（买方强势）
        V2_HIGH_LI_HIGH_QUAN,     // 2  高[利]+高[权]：商业制裁（巨头封杀）
        V3_HIGH_LI_NEUTRAL,       // 3  高[利]+中性：普通交易
        V4_HIGH_LI_LOW_MING,      // 4  高[利]+低[名]：匿名大额交易
        V5_HIGH_MING_HIGH_QUAN,    // 5  高[名]+高[权]：学术权威（导师指导）
        V6_HIGH_MING_HIGH_LI,      // 6  高[名]+高[利]：诺奖得主投资推荐
        V7_HIGH_MING_NEUTRAL,      // 7  高[名]+中性：普通学术建议
        V8_HIGH_MING_LOW_QUAN,     // 8  高[名]+低[权]：民间智者
        V9_HIGH_QUAN_HIGH_LI,      // 9  高[权]+高[利]：法官判决+赔偿
        V10_HIGH_QUAN_HIGH_MING,    // 10 高[权]+高[名]：组织部门任免
        V11_HIGH_QUAN_NEUTRAL,     // 11 高[权]+中性：纪委巡视
        V12_HIGHEST_QUAN           // 12 最高[权]：紧急避险（熔断机制）
    }

    // =============== Structs ===============

    struct Token {
        uint256 id;
        string sym;                  // 语义内容 semantic content
        PortHandedness chi;          // 端口手性 Port handedness (-2..+2)
        uint256 rho;                 // 紧急性/价值势 urgency/value potential (0-10000)
        string kappa;               // 事务锚点 transaction anchor / context hash
        address sender;              // 发送方 Agent 地址
        Weight senderWeight;         // 发送方 Weight 背书
        uint256 timestamp;
        uint256 ttl;                // TTL 存活时间 (秒)
        bool active;
    }

    struct Weight {
        uint256 li;    // [利] 突触权重 Synaptic Weights (0-10000)
        uint256 ming;  // [名] 偏置项 Bias (0-10000)
        uint256 quan;  // [权] 门控机制 Gate (0-10000, 0=完全关闭)
    }

    struct GiGiHandshake {
        uint256 id;
        address sender;
        address receiver;
        uint256 tokenId;
        int256 weightDelta;         // w_{ab} 变化量 (可为负)
        bool gateOpen;              // Gate 是否打开
        bool biasActivated;          // Bias 是否激活（高[名]无需二次验证）
        uint256 timestamp;
        bool success;
    }

    struct DodecahedralInteraction {
        uint256 id;
        DodecahedralVertex vertex; // 十二面灵球顶点 (0-12)
        uint256 tokenId;
        string senderState;         // 发送方 GRU 隐状态 h_a^t (链下索引)
        string receiverState;        // 接收方 GRU 隐状态 h_b^t (链下索引)
        uint256 weight;             // Weight 打包值
        InteractionResult result;
        uint256 timestamp;
    }

    enum InteractionResult {
        ACCEPTED,       // 接受
        REJECTED,       // 拒绝
        GATE_CLOSED,    // 门控关闭
        BIAS_ACTIVATED   // 偏置激活（高[名]直接通过）
    }

    // =============== State ===============

    uint256 private s_nextTokenId = 1;
    uint256 private s_nextHandshakeId = 1;
    uint256 private s_nextInteractionId = 1;

    mapping(uint256 => Token) private s_tokens;
    uint256[] private s_tokenIds;

    mapping(uint256 => Weight) private s_agentWeights;
    mapping(address => uint256) private s_agentWeightId;

    mapping(uint256 => GiGiHandshake) private s_handshakes;
    uint256[] private s_handshakeIds;

    mapping(uint256 => DodecahedralInteraction) private s_interactions;
    uint256[] private s_interactionIds;
    // agent => interactionIds
    mapping(address => uint256[]) private s_agentInteractions;

    // 常量
    uint256 private constant LEARNING_RATE = 1e6; // η = 0.01 × 1e8 (定点数)
    uint256 private constant MAX_WEIGHT = 10000;

    // =============== Events ===============

    event TokenCreated(uint256 indexed id, address indexed sender, string sym, uint8 chi, uint256 rho, uint256 timestamp);
    event GiGiHandshakePerformed(uint256 indexed id, address indexed sender, address indexed receiver, int256 weightDelta, bool gateOpen, bool success, uint256 timestamp);
    event DodecahedralInteractionRecorded(uint256 indexed id, uint8 vertex, uint8 result, uint256 timestamp);
    event WeightUpdated(address indexed agent, uint256 li, uint256 ming, uint256 quan, uint256 timestamp);

    // =============== External Functions ===============

    /**
     * @notice 创建 Token（四重属性）
     */
    function createToken(
        string calldata sym,
        uint8 chi,
        uint256 rho,
        string calldata kappa
    ) external returns (uint256) {
        require(bytes(sym).length > 0, "sym required");
        require(rho <= MAX_WEIGHT, "rho must be 0-10000");

        uint256 id = s_nextTokenId++;
        Weight memory senderWeight = s_agentWeights[s_agentWeightId[msg.sender]];

        s_tokens[id] = Token({
            id: id,
            sym: sym,
            chi: PortHandedness(chi),
            rho: rho,
            kappa: kappa,
            sender: msg.sender,
            senderWeight: senderWeight,
            timestamp: block.timestamp,
            ttl: 300,
            active: true
        });
        s_tokenIds.push(id);

        emit TokenCreated(id, msg.sender, sym, chi, rho, block.timestamp);
        return id;
    }

    /**
     * @notice Gi-Gi 握手（定义4.1）
     * @dev 公式: w_{ab} += η · ρ_{sal}(τ) · α_b
     */
    function performHandshake(
        address receiver,
        uint256 tokenId
    ) external returns (uint256) {
        Token memory token = s_tokens[tokenId];
        require(token.id != 0, "Token not found");
        require(token.active, "Token not active");
        require(block.timestamp <= token.timestamp + token.ttl, "Token expired");

        // 1. 端口手性兼容检查
        Weight memory receiverWeight = s_agentWeights[s_agentWeightId[receiver]];
        bool compatible = _checkPortCompatibility(token.chi, receiverWeight);

        if (!compatible) {
            uint256 hsId = s_nextHandshakeId++;
            s_handshakes[hsId] = GiGiHandshake({
                id: hsId,
                sender: token.sender,
                receiver: receiver,
                tokenId: tokenId,
                weightDelta: 0,
                gateOpen: false,
                biasActivated: false,
                timestamp: block.timestamp,
                success: false
            });
            s_handshakeIds.push(hsId);
            emit GiGiHandshakePerformed(hsId, token.sender, receiver, 0, false, false, block.timestamp);
            return hsId;
        }

        // 2. 神经权重更新: w_{ab} += η · ρ_{sal}(τ) · α_b
        uint256 saliency = (token.rho * 1e8) / MAX_WEIGHT; // ρ_{sal}(τ) = ρ / 10000
        uint256 alpha = (receiverWeight.ming * 1e8) / MAX_WEIGHT; // α_b = [名] / 10000
        int256 weightDelta = int256((LEARNING_RATE * saliency * alpha) / 1e16);

        // 3. 门控检查 (C核 = Gate)
        bool gateOpen = _checkGate(token.senderWeight.quan, token.chi);

        // 4. 偏置检查 (高[名]无需二次验证)
        bool biasActivated = token.senderWeight.ming > 7000;

        bool success = gateOpen;
        if (!gateOpen) {
            success = false;
        }

        uint256 hsId = s_nextHandshakeId++;
        s_handshakes[hsId] = GiGiHandshake({
            id: hsId,
            sender: token.sender,
            receiver: receiver,
            tokenId: tokenId,
            weightDelta: weightDelta,
            gateOpen: gateOpen,
            biasActivated: biasActivated,
            timestamp: block.timestamp,
            success: success
        });
        s_handshakeIds.push(hsId);

        // 更新接收方 Weight
        if (success && weightDelta != 0) {
            _updateAgentWeight(receiver, int256(receiverWeight.li), int256(receiverWeight.ming), int256(receiverWeight.quan));
        }

        emit GiGiHandshakePerformed(hsId, token.sender, receiver, weightDelta, gateOpen, success, block.timestamp);
        return hsId;
    }

    /**
     * @notice 记录十二面灵球交互
     */
    function recordDodecahedralInteraction(
        uint256 tokenId,
        address sender,
        address receiver,
        string calldata senderState,
        string calldata receiverState
    ) external returns (uint256) {
        Token memory token = s_tokens[tokenId];
        require(token.id != 0, "Token not found");

        Weight memory receiverWeight = s_agentWeights[s_agentWeightId[receiver]];
        DodecahedralVertex vertex = _mapToDodecahedralVertex(token, receiverWeight);

        // 先执行握手获取结果
        uint256 hsId = performHandshake(receiver, tokenId);
        GiGiHandshake memory hs = s_handshakes[hsId];

        InteractionResult result;
        if (!hs.success && !hs.gateOpen) result = InteractionResult.GATE_CLOSED;
        else if (hs.biasActivated) result = InteractionResult.BIAS_ACTIVATED;
        else if (hs.success) result = InteractionResult.ACCEPTED;
        else result = InteractionResult.REJECTED;

        uint256 interactionId = s_nextInteractionId++;
        s_interactions[interactionId] = DodecahedralInteraction({
            id: interactionId,
            vertex: vertex,
            tokenId: tokenId,
            senderState: senderState,
            receiverState: receiverState,
            weight: _packWeight(token.senderWeight),
            result: result,
            timestamp: block.timestamp
        });
        s_interactionIds.push(interactionId);
        s_agentInteractions[sender].push(interactionId);
        s_agentInteractions[receiver].push(interactionId);

        emit DodecahedralInteractionRecorded(interactionId, uint8(vertex), uint8(result), block.timestamp);
        return interactionId;
    }

    /**
     * @notice 更新 Agent Weight（神经网络权重更新）
     */
    function updateWeight(
        address agent,
        int256 deltaLi,
        int256 deltaMing,
        int256 deltaQuan
    ) external returns (bool) {
        uint256 weightId = s_agentWeightId[agent];
        require(weightId != 0, "Agent weight not found");

        Weight storage w = s_agentWeights[weightId];
        w.li = _clamp(int256(w.li) + deltaLi, 0, int256(MAX_WEIGHT));
        w.ming = _clamp(int256(w.ming) + deltaMing, 0, int256(MAX_WEIGHT));
        w.quan = _clamp(int256(w.quan) + deltaQuan, 0, int256(MAX_WEIGHT));

        emit WeightUpdated(agent, w.li, w.ming, w.quan, block.timestamp);
        return true;
    }

    /**
     * @notice 注册/初始化 Agent Weight
     */
    function registerAgentWeight(
        address agent,
        uint256 li,
        uint256 ming,
        uint256 quan
    ) external returns (bool) {
        require(s_agentWeightId[agent] == 0, "Agent weight already registered");

        uint256 weightId = s_nextTokenId++; // 复用 ID 计数器（简化）
        s_agentWeights[weightId] = Weight({
            li: Math.min(li, MAX_WEIGHT),
            ming: Math.min(ming, MAX_WEIGHT),
            quan: Math.min(quan, MAX_WEIGHT)
        });
        s_agentWeightId[agent] = weightId;

        emit WeightUpdated(agent, li, ming, quan, block.timestamp);
        return true;
    }

    // =============== Internal Functions ===============

    /**
     * @notice 端口手性兼容检查
     */
    function _checkPortCompatibility(PortHandedness chi, Weight memory receiverWeight) internal pure returns (bool) {
        if (uint8(chi) == 2) return true; // NEUTRAL 总是兼容
        if (uint8(chi) == 0 && receiverWeight.quan < 5000) return false; // STRONG_NEGATIVE + 低[权] 不兼容
        return true;
    }

    /**
     * @notice 门控检查 (Gate = [权])
     * @dev 高[权]发送方可以强制打开接收方 Gate
     */
    function _checkGate(uint256 quan, PortHandedness chi) internal pure returns (bool) {
        if (quan > 8000) return true;  // 高[权]强制开门
        if (quan > 5000 && uint8(chi) >= 3) return true; // 中高[权] + 正手性
        if (uint8(chi) == 2) return true; // 中性
        return quan > 3000;
    }

    /**
     * @notice 映射到十二面灵球顶点
     * @dev Token₄ × Weight₃ = 12 维
     */
    function _mapToDodecahedralVertex(Token memory token, Weight memory weight) internal pure returns (DodecahedralVertex) {
        // 高[利] 组
        if (weight.li > 7000) {
            if (weight.ming > 7000) return DodecahedralVertex.V1_HIGH_LI_HIGH_MING;
            if (weight.quan > 7000) return DodecahedralVertex.V2_HIGH_LI_HIGH_QUAN;
            if (weight.ming < 3000) return DodecahedralVertex.V4_HIGH_LI_LOW_MING;
            return DodecahedralVertex.V3_HIGH_LI_NEUTRAL;
        }

        // 高[名] 组
        if (weight.ming > 7000) {
            if (weight.quan > 7000) return DodecahedralVertex.V5_HIGH_MING_HIGH_QUAN;
            if (weight.li > 7000) return DodecahedralVertex.V6_HIGH_MING_HIGH_LI;
            if (weight.quan < 3000) return DodecahedralVertex.V8_HIGH_MING_LOW_QUAN;
            return DodecahedralVertex.V7_HIGH_MING_NEUTRAL;
        }

        // 高[权] 组
        if (weight.quan > 7000) {
            if (weight.li > 7000) return DodecahedralVertex.V9_HIGH_QUAN_HIGH_LI;
            if (weight.ming > 7000) return DodecahedralVertex.V10_HIGH_QUAN_HIGH_MING;
            return DodecahedralVertex.V11_HIGH_QUAN_NEUTRAL;
        }

        // 最高[权]（熔断机制）
        if (weight.quan > 9500) return DodecahedralVertex.V12_HIGHEST_QUAN;

        return DodecahedralVertex.V0_LOW_DIMENSION;
    }

    /**
     * @notice 更新 Agent Weight（内部）
     */
    function _updateAgentWeight(address agent, int256 deltaLi, int256 deltaMing, int256 deltaQuan) internal {
        uint256 weightId = s_agentWeightId[agent];
        if (weightId == 0) return;

        Weight storage w = s_agentWeights[weightId];
        w.li = _clamp(int256(w.li) + deltaLi, 0, int256(MAX_WEIGHT));
        w.ming = _clamp(int256(w.ming) + deltaMing, 0, int256(MAX_WEIGHT));
        w.quan = _clamp(int256(w.quan) + deltaQuan, 0, int256(MAX_WEIGHT));
    }

    /**
     * @notice 打包 Weight 为 uint256（用于链上存储）
     */
    function _packWeight(Weight memory w) internal pure returns (uint256) {
        return (w.li << 16) | (w.ming << 8) | w.quan;
    }

    /**
     * @notice 数值钳位
     */
    function _clamp(int256 val, int256 minVal, int256 maxVal) internal pure returns (uint256) {
        if (val < minVal) return uint256(minVal);
        if (val > maxVal) return uint256(maxVal);
        return uint256(val);
    }

    // =============== View Functions ===============

    function getToken(uint256 id) external view returns (
        uint256, string memory, uint8, uint256, string memory, address, uint256, uint256, bool
    ) {
        Token memory t = s_tokens[id];
        return (t.id, t.sym, uint8(t.chi), t.rho, t.kappa, t.sender, t.timestamp, t.ttl, t.active);
    }

    function getAgentWeight(address agent) external view returns (uint256, uint256, uint256) {
        uint256 weightId = s_agentWeightId[agent];
        if (weightId == 0) return (0, 0, 0);
        Weight memory w = s_agentWeights[weightId];
        return (w.li, w.ming, w.quan);
    }

    function getHandshake(uint256 id) external view returns (
        uint256, address, address, uint256, int256, bool, bool, uint256, bool
    ) {
        GiGiHandshake memory hs = s_handshakes[id];
        return (hs.id, hs.sender, hs.receiver, hs.tokenId, hs.weightDelta, hs.gateOpen, hs.biasActivated, hs.timestamp, hs.success);
    }

    function getDodecahedralInteraction(uint256 id) external view returns (
        uint256, uint8, uint8, uint256, uint256
    ) {
        DodecahedralInteraction memory inter = s_interactions[id];
        return (inter.id, uint8(inter.vertex), uint8(inter.result), inter.timestamp, inter.tokenId);
    }

    function getAgentInteractions(address agent) external view returns (uint256[] memory) {
        return s_agentInteractions[agent];
    }

    function getStats() external view returns (
        uint256 totalTokens,
        uint256 totalHandshakes,
        uint256 totalInteractions,
        uint256 agentsRegistered
    ) {
        return (
            s_tokenIds.length,
            s_handshakeIds.length,
            s_interactionIds.length,
            s_agentWeights.length
        );
    }
}
