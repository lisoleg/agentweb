# Σ-Cloud V12.0 系统架构设计文档

> **架构师**: 高见远 (Gao) · Architect  
> **版本**: V12.0  
> **基线**: V11.0 (22合约 / 93测试 / API V11.0.0)  
> **日期**: 2026-05-23

---

## 1. 实现方案

### 1.1 P0: 裁决可视化 + 内生AI增强

**核心挑战**:  
- ConstitutionCourt.sol需新增analysisHash/simulationHash存储，不破坏现有接口
- 链下分析引擎需获取链上投票数据进行聚类和异常检测
- 沙盘预演需在链下模拟投票分布并预测判决
- 推理链DAG可视化需前后端协同

**技术方案**:  
- **ConstitutionCourt.sol增强**: 新增 `caseAnalysisHashes` / `caseSimulationHashes` 两个mapping + `attachAnalysis()` / `attachSimulation()` / `getCaseMetadata()` 三个函数
- **judgmentAnalysisEngine.ts**: 读取链上投票数据（votePower分布），执行K-means聚类+异常检测（z-score），输出JSON分析报告
- **judgmentSimulator.ts**: 接收假设投票分布，计算模拟yesRate/noRate，预测判决+评估影响
- **court-v2.ts API**: 4个端点 (analysis/simulate/query/reasoning)，挂载在/api/v12/court/
- **CourtPanel.tsx增强**: 增加DAG推理链可视化+意图查询框+沙盘预演面板

### 1.2 P1: 跨链中继 + 通算一体

**核心挑战**:  
- RelayRegistry需同时管理消息中继和计算任务
- 智能路由需综合延迟+费率+声誉+算力负载四个因子
- 动态费率需根据网络状态实时调整
- 故障自愈需自动切换中继路径

**技术方案**:  
- **RelayRegistry.sol**: 中继注册（含computeCapacity）、质押、任务分配、声誉计算、惩罚机制
- **intelligentRelayRouter.ts**: 多因子路由评分算法，故障自动重路由
- **dynamicFeeScheduler.ts**: feeMultiplier = base × congestion × compute × distance，周期更新
- **relayService.ts + api/relay.ts**: 中继CRUD + 路由查询 + 费率查询API
- **RelayPanel.tsx**: 中继管理面板

### 1.3 P1: 信用评级 + 零知识证明

**核心挑战**:  
- 四维度评分需要跨合约数据（PhiStaking/ConstitutionCourt/AILaborMarket/RelayRegistry）
- 七级信用等级的阈值映射
- 评级推理链的存储和检索
- ZK证明的模拟模式实现

**技术方案**:  
- **CreditRating.sol**: 四维度评分(Φ30%+法院25%+劳动25%+中继20%)，RatingProof推理链，七级等级，联动机制，信用衰减
- **creditService.ts + api/credit.ts**: 评级/等级/推理链查询API
- **zkCreditProofService.ts**: 模拟模式的ZK证明（预留电路接口）
- **CreditPanel.tsx**: 信用面板（雷达图+等级徽章+推理链）

---

## 2. 框架选型

| 层 | 技术 | 版本 |
|----|------|------|
| 智能合约 | Solidity + Hardhat + OpenZeppelin | ^0.8.24 / ^2.x / ^5.0 |
| 后端 | Node.js + Express + TypeScript | 24.x / 4.x / strict |
| 前端 | React + MUI + Tailwind CSS + Vite | 18.x / 5.x / 3.x / 5.x |
| 测试 | Hardhat + ethers.js + chai | ^2.x / ^6.x / ^4.x |

---

## 3. 文件列表

### 3.1 Solidity合约（3新增 + 1修改）

| # | 文件路径 | 操作 | 说明 |
|---|---------|------|------|
| 1 | `blockchain/contracts/ConstitutionCourt.sol` | 修改 | 新增analysisHash/simulationHash存储+3个函数 |
| 2 | `blockchain/contracts/RelayRegistry.sol` | 新增 | 中继注册+质押+声誉+任务+惩罚 |
| 3 | `blockchain/contracts/CreditRating.sol` | 新增 | 四维评分+七级等级+推理链+联动+衰减 |
| 4 | `blockchain/contracts/ReputationStaking.sol` | 新增 | 声誉担保+罚没(P2) |

### 3.2 后端TypeScript（8新增 + 2修改）

| # | 文件路径 | 操作 | 说明 |
|---|---------|------|------|
| 1 | `backend/src/services/judgmentAnalysisEngine.ts` | 新增 | 投票模式聚类+异常检测+影响预测 |
| 2 | `backend/src/services/judgmentSimulator.ts` | 新增 | 判决沙盘预演 |
| 3 | `backend/src/services/intelligentRelayRouter.ts` | 新增 | 多因子智能路由+故障自愈 |
| 4 | `backend/src/services/dynamicFeeScheduler.ts` | 新增 | 动态费率调度 |
| 5 | `backend/src/services/relayService.ts` | 新增 | 中继服务层 |
| 6 | `backend/src/services/creditService.ts` | 新增 | 信用评级服务层 |
| 7 | `backend/src/services/zkCreditProofService.ts` | 新增 | ZK信用证明（模拟模式） |
| 8 | `backend/src/api/v12.ts` | 新增 | V12路由聚合 |
| 9 | `backend/src/api/court-v2.ts` | 新增 | V12裁决增强API |
| 10 | `backend/src/api/relay.ts` | 新增 | V12中继API |
| 11 | `backend/src/api/credit.ts` | 新增 | V12信用API |
| 12 | `backend/src/api/index.ts` | 修改 | 注册/api/v12路由 |
| 13 | `backend/src/services/courtService.ts` | 修改 | 新增V12增强方法 |

### 3.3 前端React（2新增 + 1修改）

| # | 文件路径 | 操作 | 说明 |
|---|---------|------|------|
| 1 | `frontend/src/components/RelayPanel.tsx` | 新增 | 中继管理面板 |
| 2 | `frontend/src/components/CreditPanel.tsx` | 新增 | 信用评级面板 |
| 3 | `frontend/src/components/CourtPanel.tsx` | 修改 | 推理链DAG+意图查询+沙盘预演 |

### 3.4 测试（1新增）

| # | 文件路径 | 操作 | 说明 |
|---|---------|------|------|
| 1 | `blockchain/test/V12.test.ts` | 新增 | V12全部测试(45+用例) |

---

## 4. 数据结构和接口

### 4.1 ConstitutionCourt.sol 增强结构

```solidity
// 新增状态变量
mapping(uint256 => bytes32) public caseAnalysisHashes;
mapping(uint256 => bytes32) public caseSimulationHashes;

// 新增函数签名
function attachAnalysis(uint256 caseId, bytes32 analysisHash) external onlyAdmin;
function attachSimulation(uint256 caseId, bytes32 simulationHash) external onlyAdmin;
function getCaseMetadata(uint256 caseId) external view returns (
    bytes32 analysisHash, bytes32 simulationHash,
    uint256 approvalRate, uint256 timeRemaining
);
```

### 4.2 RelayRegistry.sol 核心结构

```solidity
enum TaskType { MESSAGE_RELAY, COMPUTE_RELAY }
enum TaskStatus { PENDING, ASSIGNED, COMPLETED, FAILED, TIMED_OUT }

struct RelayNode {
    address operator;
    uint256 stakeAmount;
    uint256 computeCapacity;    // 1-10000 相对值
    uint256[] supportedChains;
    uint256 totalRelayed;
    uint256 totalComputeTasks;
    uint256 successCount;
    uint256 failCount;
    uint256 reputationScore;    // 0-10000
    uint256 feeRate;            // 基点
    bool isActive;
    uint256 registeredAt;
    uint256 lastActiveAt;
}

struct RelayTask {
    bytes32 taskId;
    address requester;
    address assignedRelay;
    uint256 sourceChainId;
    uint256 targetChainId;
    bytes32 messageHash;
    TaskType taskType;
    uint256 computeUnits;
    uint256 fee;
    TaskStatus status;
    uint256 createdAt;
    uint256 completedAt;
}
```

### 4.3 CreditRating.sol 核心结构

```solidity
enum CreditGrade { AAA, AA, A, BBB, BB, B, CCC }

struct CreditDimensions {
    uint256 phiScore;           // Φ值维度 (权重30%)
    uint256 courtScore;         // 法院参与维度 (权重25%)
    uint256 laborScore;         // 劳动市场维度 (权重25%)
    uint256 relayScore;         // 中继贡献维度 (权重20%)
}

struct RatingProof {
    uint256 oldScore;
    uint256 newScore;
    uint256 phiContribution;
    uint256 courtContribution;
    uint256 laborContribution;
    uint256 relayContribution;
    uint256 penaltyContribution;
    bytes32 evidenceRoot;
    uint256 timestamp;
}

struct AgentCredit {
    uint256 totalScore;         // 0-10000
    CreditGrade grade;
    CreditDimensions dimensions;
    uint256 lastUpdated;
    uint256 decayRate;          // 每30天衰减量
}
```

### 4.4 跨合约接口

```solidity
interface IRelayRegistry {
    function getReputationScore(address relay) external view returns (uint256);
    function getRelayNode(address relay) external view returns (RelayNode memory);
}

interface ICreditRating {
    function getCreditGrade(address agent) external view returns (CreditGrade);
    function getCreditScore(address agent) external view returns (uint256);
}
```

---

## 5. 程序调用流程

### 5.1 裁决分析流程（时序图）

```
Agent → CourtPanel → [GET /api/v12/court/analysis/:caseId]
  → court-v2.ts → judgmentAnalysisEngine.ts
    → courtService.ts → ConstitutionCourt.getCase()
    → 聚类分析 + 异常检测 + 影响预测
  ← JSON分析报告
CourtPanel → [POST /api/v12/court/attach-analysis]
  → court-v2.ts → courtService.ts → ConstitutionCourt.attachAnalysis()
```

### 5.2 智能中继路由流程

```
Requester → [POST /api/v12/relay/route]
  → relay.ts → intelligentRelayRouter.ts
    → relayService.ts → RelayRegistry.getRelayNode() ×N
    → 评分排序: score = w1×latency + w2×feeRate + w3×reputation + w4×loadBalance
  ← 最优中继 + 备选路径
```

### 5.3 信用评级联动流程

```
Agent → [GET /api/v12/credit/rating/:agent]
  → credit.ts → creditService.ts
    → CreditRating.getCreditScore(agent)
    → CreditRating.getCreditGrade(agent)
    → 费率联动: AAA×0.7, BBB×1.0, CCC×1.5
    → 权限联动: BBB+可投紧急案件
  ← 评级+等级+联动效果
```

---

## 6. 任务列表

| # | 任务 | 依赖 | 文件 | 优先级 |
|---|------|------|------|--------|
| T1 | ConstitutionCourt.sol增强 | 无 | blockchain/contracts/ConstitutionCourt.sol | P0 |
| T2 | RelayRegistry.sol | T1 | blockchain/contracts/RelayRegistry.sol | P1 |
| T3 | CreditRating.sol | T2 | blockchain/contracts/CreditRating.sol | P1 |
| T4 | ReputationStaking.sol | T3 | blockchain/contracts/ReputationStaking.sol | P2 |
| T5 | judgmentAnalysisEngine.ts | 无 | backend/src/services/judgmentAnalysisEngine.ts | P0 |
| T6 | judgmentSimulator.ts | T5 | backend/src/services/judgmentSimulator.ts | P0 |
| T7 | court-v2.ts API | T5,T6 | backend/src/api/court-v2.ts | P0 |
| T8 | intelligentRelayRouter.ts | 无 | backend/src/services/intelligentRelayRouter.ts | P1 |
| T9 | dynamicFeeScheduler.ts | 无 | backend/src/services/dynamicFeeScheduler.ts | P1 |
| T10 | relayService.ts | T2 | backend/src/services/relayService.ts | P1 |
| T11 | api/relay.ts | T10 | backend/src/api/relay.ts | P1 |
| T12 | creditService.ts | T3 | backend/src/services/creditService.ts | P1 |
| T13 | zkCreditProofService.ts | T3 | backend/src/services/zkCreditProofService.ts | P2 |
| T14 | api/credit.ts | T12 | backend/src/api/credit.ts | P1 |
| T15 | v12.ts路由聚合 | T7,T11,T14 | backend/src/api/v12.ts | P1 |
| T16 | api/index.ts注册 | T15 | backend/src/api/index.ts | P1 |
| T17 | courtService.ts增强 | T1 | backend/src/services/courtService.ts | P0 |
| T18 | RelayPanel.tsx | T11 | frontend/src/components/RelayPanel.tsx | P1 |
| T19 | CreditPanel.tsx | T14 | frontend/src/components/CreditPanel.tsx | P1 |
| T20 | CourtPanel.tsx增强 | T7 | frontend/src/components/CourtPanel.tsx | P0 |
| T21 | V12测试 | T1-T4 | blockchain/test/V12.test.ts | P1 |
| T22 | Hardhat编译验证 | T21 | Hardhat compile | P1 |

---

## 7. 依赖包列表

无新增npm依赖。所有功能基于现有依赖实现。

---

## 8. 共享知识

### 8.1 编码规范
- Solidity: pragma ^0.8.24, OpenZeppelin ^5.0, 事件过去时态
- TypeScript: strict模式, async/await, `{ code, data, message }` 响应格式
- 合约间调用用接口（IRelayRegistry, ICreditRating）
- 中文unicode字符串用 `unicode"..."` (Solidity)
- Φ值/声誉分/信用分统一范围: 0-10000
- 费率: 基点(1bp = 0.01%)

### 8.2 API路径约定
- V12路由挂载: `/api/v1/v12/` （参照V11挂载在`/api/v1/v11/`）
- 子路由: court, relay, credit

### 8.3 合约接口约定
- RelayRegistry需实现 `getReputationScore(address) → uint256` 供CreditRating调用
- CreditRating需实现 `getCreditGrade(address) → CreditGrade` 供RelayRegistry费率联动
- ConstitutionCourt增强不破坏现有ABI

---

## 9. 待明确事项

| # | 事项 | 影响 | 建议 |
|---|------|------|------|
| 1 | ZK信用证明V12先做模拟模式 | T13 | 预留verifyProof接口，实现模拟生成/验证 |
| 2 | ReputationStaking为P2 | T4 | 实现但测试覆盖可减少 |
| 3 | 智能路由权重是否可治理调整 | T8 | 默认硬编码，预留setter |
| 4 | 信用衰减率是否可治理 | T3 | 通过admin setter调整decayRate |
