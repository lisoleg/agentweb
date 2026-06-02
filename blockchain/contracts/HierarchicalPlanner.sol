// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title HierarchicalPlanner
 * @notice V13.0 HG-STR 分层决策 + ITA-Trigger链上绑定
 * @dev 借鉴HG-STR三层MDP分层决策架构
 *
 * 三层决策:
 * - L1 战略层(Macro): 全局态势 → Goal ∈ {Search, Engage, RTB, Observe}
 * - L2 战役层(Target Select): 局部观测 → Target ID
 * - L3 战术层(Action Param): 目标+自身状态 → 具体执行参数
 *
 * 优势: 避免Flat Policy在高维空间陷入局部最优(Local Optima)或死锁(Deadlock)
 *
 * ITA-Trigger层间绑定:
 * - I(Information): 环境提示
 * - T(Trigger): 上下文谓词
 * - A(Action): 动作链
 *
 * 定义3.1: ITA-Trigger for AgentWeb
 */

// =============== Types ===============

enum MacroGoal {
    SEARCH,       // 搜索/发现
    ENGAGE,       // 交战/执行
    RTB,          // 返回基地(Return To Base)
    OBSERVE,      // 观察等待
    EMERGENCY,    // 紧急干预
    COLLABORATE,  // 协同合作
    HIBERNATE     // 休眠节能
}

enum ActionType {
    EXECUTE_TASK,
    ALLOCATE_RESOURCE,
    SEND_MESSAGE,
    ADJUST_PRIORITY,
    REQUEST_COLLABORATION,
    TRIGGER_ITA,
    EMERGENCY_STOP,
    DELEGATE,
    SELF_MODIFY
}

// =============== Structs ===============

struct GlobalSituation {
    address agent;
    uint256 phiScore;           // Φ值 [0, 10000]
    uint256 gcBalance;
    uint256 metabolicRate;
    uint256 activeTaskCount;
    uint256 pendingThreats;
    uint256 systemLoad;        // [0, 10000] → 0-100%
    uint256 creditRating;      // [0, 10000]
    uint256 recentViolations;
}

struct TargetSelection {
    bytes32 targetId;
    uint8 targetType;           // 0=Task, 1=Agent, 2=Resource, 3=Threat, 4=GC_Anomaly
    uint256 priority;          // [0, 10000]
    uint256 riskScore;         // [0, 10000]
    uint256 estimatedResources;
    uint256 deadline;
}

struct ActionParams {
    ActionType actionType;
    bytes32 targetId;
    uint256 confidence;         // [0, 10000]
    bool requiresApproval;
    uint256 estimatedDuration;
}

struct ITATrigger {
    bytes32 triggerId;
    address agent;
    MacroGoal boundAtGoal;      // 在哪个L1目标下绑定
    string informationKey;      // I: 监听键
    string triggerExpression;   // T: 触发谓词
    ActionType triggerAction;   // A: 触发动作
    uint256 priority;           // [0, 10000]
    bool isActive;
    uint256 fireCount;
    uint256 createdAt;
    uint256 lastFiredAt;
    uint256 cooldownSeconds;
}

struct DecisionRecord {
    address agent;
    MacroGoal macroGoal;
    bytes32 selectedTarget;
    ActionType actionType;
    uint256 confidence;
    uint256 timestamp;
    bool outcome;              // true=SUCCESS, false=FAILED
}

// =============== Contract ===============

contract HierarchicalPlanner {

    address public owner;

    // Agent → 当前L1目标
    mapping(address => MacroGoal) public agentMacroGoal;

    // Agent → 目标选择
    mapping(address => TargetSelection) public agentTarget;

    // Agent → 执行参数
    mapping(address => ActionParams) public agentAction;

    // ITA-Trigger注册表
    mapping(bytes32 => ITATrigger) public itaTriggers;
    bytes32[] public itaTriggerIds;

    // Agent → 决策历史
    mapping(address => DecisionRecord[]) public decisionHistory;

    // 死锁检测: Agent → 最近3次目标
    mapping(address => MacroGoal[3]) public recentGoals;
    mapping(address => uint256) public recentGoalIndex;

    // 统计
    uint256 public totalDecisions;
    uint256 public deadlockPreventions;
    uint256 public localOptimaEscapes;
    uint256 public itaTriggerBindings;
    mapping(MacroGoal => uint256) public decisionsByGoal;

    // 事件
    event MacroGoalDecided(address indexed agent, MacroGoal goal, string reason, uint256 confidence);
    event TargetSelected(address indexed agent, bytes32 indexed targetId, uint8 targetType, uint256 priority);
    event ActionDecided(address indexed agent, ActionType actionType, bytes32 targetId, uint256 confidence);
    event ITATriggerBound(address indexed agent, bytes32 indexed triggerId, MacroGoal goal);
    event ITATriggerFired(bytes32 indexed triggerId, address indexed agent, ActionType action);
    event DeadlockDetected(address indexed agent, MacroGoal repeatedGoal);
    event DecisionReported(address indexed agent, MacroGoal goal, bool outcome);

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    // =============== L1 战略层决策 ===============

    /**
     * @notice L1 Macro Goal决策 — 全局态势 → Goal
     * @dev HG-STR: 防止过早交战或盲目搜索
     */
    function decideMacroGoal(GlobalSituation calldata situation) external returns (MacroGoal) {
        MacroGoal goal;
        string memory reason;

        // 规则优先级: EMERGENCY > THREAT > OVERLOAD > VIOLATION > IDLE > DEFAULT
        if (situation.gcBalance < situation.metabolicRate * 3 days) {
            goal = MacroGoal.EMERGENCY;
            reason = "GC balance < 3 days metabolic cost";
        } else if (situation.pendingThreats > 0 && situation.phiScore >= 7000) {
            goal = MacroGoal.ENGAGE;
            reason = "Pending threats with sufficient phi";
        } else if (situation.systemLoad > 9000) {
            goal = MacroGoal.RTB;
            reason = "System overloaded, return to base";
        } else if (situation.recentViolations > 2) {
            goal = MacroGoal.OBSERVE;
            reason = "Too many violations, observe first";
        } else if (situation.activeTaskCount == 0 && situation.phiScore >= 5000) {
            goal = MacroGoal.SEARCH;
            reason = "No tasks, search for opportunities";
        } else if (situation.activeTaskCount == 0 && situation.phiScore < 5000) {
            goal = MacroGoal.HIBERNATE;
            reason = "No tasks and low phi, hibernate";
        } else if (situation.activeTaskCount > 0) {
            goal = MacroGoal.COLLABORATE;
            reason = "Has tasks, collaborate";
        } else {
            goal = MacroGoal.OBSERVE;
            reason = "Default observe";
        }

        // 死锁检测 — 连续3次相同目标
        uint256 idx = recentGoalIndex[situation.agent] % 3;
        recentGoals[situation.agent][idx] = goal;
        recentGoalIndex[situation.agent]++;

        if (_isDeadlock(situation.agent, goal)) {
            deadlockPreventions++;
            // 逃逸: 选择不同的目标
            goal = _escapeDeadlock(goal);
            emit DeadlockDetected(situation.agent, recentGoals[situation.agent][0]);
        }

        agentMacroGoal[situation.agent] = goal;
        totalDecisions++;
        decisionsByGoal[goal]++;

        emit MacroGoalDecided(situation.agent, goal, reason, _calculateConfidence(situation));
        return goal;
    }

    // =============== L2 战役层决策 ===============

    /**
     * @notice L2 Target Selection — 局部观测 → Target ID
     * @dev 解决目标分配冲突
     */
    function selectTarget(
        address agent,
        TargetSelection calldata target
    ) external returns (bool) {
        MacroGoal goal = agentMacroGoal[agent];

        // L2根据L1过滤候选
        if (goal == MacroGoal.ENGAGE) {
            require(target.targetType == 0 || target.targetType == 3, "Engage: only Task or Threat");
        } else if (goal == MacroGoal.EMERGENCY) {
            require(target.targetType == 4 || target.targetType == 2, "Emergency: only GC_Anomaly or Resource");
        } else if (goal == MacroGoal.SEARCH) {
            require(target.targetType == 0 || target.targetType == 2, "Search: only Task or Resource");
        }

        agentTarget[agent] = target;
        emit TargetSelected(agent, target.targetId, target.targetType, target.priority);
        return true;
    }

    // =============== L3 战术层决策 ===============

    /**
     * @notice L3 Action Params — 目标+自身状态 → 执行参数
     * @dev 执行具体机动/资源分配
     */
    function decideAction(
        address agent,
        ActionParams calldata action
    ) external returns (bool) {
        MacroGoal goal = agentMacroGoal[agent];

        // 高风险操作需要审批
        if (action.actionType == ActionType.EMERGENCY_STOP || action.actionType == ActionType.SELF_MODIFY) {
            require(action.requiresApproval, "High-risk action requires approval");
        }

        agentAction[agent] = action;
        emit ActionDecided(agent, action.actionType, action.targetId, action.confidence);
        return true;
    }

    // =============== ITA-Trigger 层间绑定 ===============

    /**
     * @notice 在层间切换点绑定ITA-Trigger
     * @dev HG-STR的L1切换(Search→Engage)是ITA-Trigger的完美实例
     */
    function bindITATrigger(
        bytes32 triggerId,
        address agent,
        MacroGoal boundAtGoal,
        string calldata informationKey,
        string calldata triggerExpression,
        ActionType triggerAction,
        uint256 priority,
        uint256 cooldownSeconds
    ) external returns (bool) {
        ITATrigger memory trigger = ITATrigger({
            triggerId: triggerId,
            agent: agent,
            boundAtGoal: boundAtGoal,
            informationKey: informationKey,
            triggerExpression: triggerExpression,
            triggerAction: triggerAction,
            priority: priority,
            isActive: true,
            fireCount: 0,
            createdAt: block.timestamp,
            lastFiredAt: 0,
            cooldownSeconds: cooldownSeconds
        });

        itaTriggers[triggerId] = trigger;
        itaTriggerIds.push(triggerId);
        itaTriggerBindings++;

        emit ITATriggerBound(agent, triggerId, boundAtGoal);
        return true;
    }

    /**
     * @notice 触发ITA-Trigger
     */
    function fireITATrigger(bytes32 triggerId) external returns (bool) {
        ITATrigger storage trigger = itaTriggers[triggerId];
        require(trigger.isActive, "Trigger not active");

        // 冷却期检查
        if (trigger.lastFiredAt > 0) {
            require(block.timestamp >= trigger.lastFiredAt + trigger.cooldownSeconds, "Cooldown");
        }

        trigger.fireCount++;
        trigger.lastFiredAt = block.timestamp;

        emit ITATriggerFired(triggerId, trigger.agent, trigger.triggerAction);
        return true;
    }

    // =============== 决策结果报告 ===============

    function reportOutcome(address agent, MacroGoal goal, bool outcome) external {
        DecisionRecord memory record = DecisionRecord({
            agent: agent,
            macroGoal: goal,
            selectedTarget: agentTarget[agent].targetId,
            actionType: agentAction[agent].actionType,
            confidence: agentAction[agent].confidence,
            timestamp: block.timestamp,
            outcome: outcome
        });

        decisionHistory[agent].push(record);
        emit DecisionReported(agent, goal, outcome);
    }

    // =============== 查询 ===============

    function getAgentDecision(address agent) external view returns (
        MacroGoal goal,
        bytes32 targetId,
        ActionType actionType,
        uint256 confidence
    ) {
        return (
            agentMacroGoal[agent],
            agentTarget[agent].targetId,
            agentAction[agent].actionType,
            agentAction[agent].confidence
        );
    }

    function getITATriggerCount() external view returns (uint256) {
        return itaTriggerIds.length;
    }

    function getDecisionHistoryCount(address agent) external view returns (uint256) {
        return decisionHistory[agent].length;
    }

    // =============== Helpers ===============

    function _isDeadlock(address agent, MacroGoal newGoal) internal view returns (bool) {
        MacroGoal g0 = recentGoals[agent][0];
        MacroGoal g1 = recentGoals[agent][1];
        MacroGoal g2 = recentGoals[agent][2];
        return g0 == g1 && g1 == g2 && g2 == newGoal;
    }

    function _escapeDeadlock(MacroGoal currentGoal) internal pure returns (MacroGoal) {
        // 逃逸到不同目标
        if (currentGoal == MacroGoal.ENGAGE) return MacroGoal.OBSERVE;
        if (currentGoal == MacroGoal.SEARCH) return MacroGoal.COLLABORATE;
        if (currentGoal == MacroGoal.OBSERVE) return MacroGoal.SEARCH;
        return MacroGoal.OBSERVE;
    }

    function _calculateConfidence(GlobalSituation calldata s) internal pure returns (uint256) {
        // 简化置信度: 基于Φ值和GC余额
        uint256 phiConf = s.phiScore * 40 / 10000;
        uint256 gcConf = s.gcBalance > s.metabolicRate * 30 days ? 60 : 30;
        return phiConf + gcConf > 10000 ? 10000 : phiConf + gcConf;
    }
}
