# Σ-Cloud V13.0 产品需求文档（PRD）

> **版本**: V13.0  
> **日期**: 2026-05-23  
> **作者**: 许清楚（Xu）· 产品经理  
> **基线**: V12.0（25合约，130/130测试，API V12.0.0）  
> **项目路径**: `C:/Users/1/WorkBuddy/2026-05-10-task-7/agentweb/`  
> **核心升级**: 真实zk-SNARK信用证明电路 + NLU意图引擎深度集成

---

## 一、产品目标

| # | 目标 | 说明 | V12升级点 |
|---|------|------|----------|
| G1 | **真实zk-SNARK信用证明电路** | 将V12的模拟ZK证明升级为真实Groth16/PLONK电路，支持链上验证 | 模拟→真实电路 |
| G2 | **NLU意图引擎深度集成** | 将V12的基础关键词匹配升级为完整NLU流水线，支持意图分类/实体抽取/查询生成 | 关键词→NLU |
| G3 | **中继网络智能体自治** | 中继节点实现自注册/自优化/自修复的Agent化自治能力 | 被动→自治 |

---

## 二、核心交付

### 2.1 P0: 真实zk-SNARK信用证明 (ZK Circuit)

#### 问题
V12的`zkCreditProofService.ts`是模拟模式——生成伪证明，无法链上验证。真实场景需要：
- Agent证明"信用评分≥阈值"而不暴露具体分数
- 第三方可验证证明有效性
- 证明可上链存证

#### 方案

**电路设计: CreditProof.circom**

```
template CreditProof() {
    signal input phiScore;       // Φ维度分 (0-10000)
    signal input courtScore;     // 法院维度分 (0-10000)
    signal input laborScore;     // 劳动维度分 (0-10000)
    signal input relayScore;     // 中继维度分 (0-10000)
    signal input threshold;      // 目标阈值 (e.g., 6000 for BBB)
    
    signal output creditGrade;   // 计算出的信用等级
    signal output isAboveThreshold; // 是否达到阈值
    
    // 加权求和: Φ*30% + 法院*25% + 劳动*25% + 中继*20%
    signal weightedSum;
    weightedSum <== phiScore * 3000 + courtScore * 2500 + laborScore * 2500 + relayScore * 2000;
    weightedSum / 10000 ==> creditGrade;
    
    // 阈值比较 (不需暴露具体分数)
    isAboveThreshold <== (creditGrade >= threshold) ? 1 : 0;
}
```

**技术选型**:
| 组件 | 技术 | 说明 |
|------|------|------|
| 电路语言 | Circom 2.1 | 成熟的zk-SNARK电路DSL |
| 证明系统 | Groth16 | 最快验证速度，适合链上验证 |
| 可信设置 | Powers of Tau + Phase 2 | 标准MPC仪式 |
| Solidity验证器 | snarkjs生成 | 自动生成Solidity验证合约 |
| 链下证明 | snarkjs + witness计算 | Node.js服务端 |

**新增文件**:
| # | 文件 | 说明 |
|---|------|------|
| 1 | `circuits/CreditProof.circom` | 信用证明电路 |
| 2 | `circuits/RelayEligibility.circom` | 中继资格证明电路 |
| 3 | `blockchain/contracts/verifiers/CreditProofVerifier.sol` | Groth16验证合约（自动生成） |
| 4 | `blockchain/contracts/verifiers/RelayEligibilityVerifier.sol` | Groth16验证合约 |
| 5 | `blockchain/contracts/ZKCreditVerifier.sol` | 业务逻辑验证合约 |
| 6 | `backend/src/services/zkProver.ts` | 链下证明生成服务 |
| 7 | `backend/src/services/zkCircuitManager.ts` | 电路管理+密钥管理 |
| 8 | `frontend/src/components/ZKProofPanel.tsx` | ZK证明前端面板 |

**ZKCreditVerifier.sol 接口**:
```solidity
contract ZKCreditVerifier {
    struct Proof {
        uint256[2] a;
        uint256[2] b;
        uint256[2] c;
    }
    
    function verifyCreditProof(
        Proof calldata proof,
        uint256 creditGrade,
        uint256 isAboveThreshold,
        uint256[2] calldata publicSignals
    ) external view returns (bool);
    
    function submitCreditProof(
        Proof calldata proof,
        uint256 threshold,
        uint256 creditGrade
    ) external returns (bool);
}
```

### 2.2 P0: NLU意图引擎深度集成

#### 问题
V12的`court-v2.ts`意图查询端点是关键词匹配，无法理解复杂自然语言查询。

#### 方案

**NLU引擎架构**:
```
自然语言输入 → 分词/Tokenize → 意图分类(Intent) → 实体抽取(Entity) → 查询生成(Query) → 链上/链下执行 → 结构化输出
```

**意图分类 (6大类)**:
| 意图 | 示例 | 查询映射 |
|------|------|---------|
| QUERY_CASE | "最近30天哪些案件被OVERTURN" | court.getCases(status=OVERTURN, since=now-30d) |
| QUERY_CREDIT | "我的信用评级为什么下降了" | credit.getRatingHistory(agent).lastChange |
| QUERY_RELAY | "哪条中继路径最快" | relay.getOptimalRoute(src, dst, metric=latency) |
| QUERY_PHI | "我的Φ值够不够投票" | phi.getPhiValue(agent).gte(court.threshold) |
| ANALYZE_TREND | "信用评级的趋势如何" | credit.getRatingTrend(agent, window=90d) |
| PREDICT_OUTCOME | "这个案件会被UPHOLD吗" | court.simulate(caseId, currentVotes) |

**技术选型**:
| 组件 | 技术 | 说明 |
|------|------|------|
| 分词 | jieba/结巴分词 | 中文分词基础 |
| 意图分类 | 规则引擎 + 轻量BERT | 规则优先+模型兜底 |
| 实体抽取 | 正则 + NER模型 | 地址/数值/时间/状态 |
| 查询生成 | 模板映射 | Intent+Entity→链上调用 |

**新增文件**:
| # | 文件 | 说明 |
|---|------|------|
| 1 | `backend/src/services/nlu/tokenizer.ts` | 中文分词+Tokenize |
| 2 | `backend/src/services/nlu/intentClassifier.ts` | 意图分类(规则+模型) |
| 3 | `backend/src/services/nlu/entityExtractor.ts` | 实体抽取(地址/数值/时间/状态) |
| 4 | `backend/src/services/nlu/queryGenerator.ts` | 查询生成(Intent+Entity→链上调用) |
| 5 | `backend/src/services/nluEngine.ts` | NLU引擎主入口(管线编排) |
| 6 | `backend/src/api/nlu.ts` | NLU API端点 |
| 7 | `frontend/src/components/NLUQueryPanel.tsx` | 增强版意图查询面板 |

**API端点**:
```
POST /api/v13/nlu/query
  Body: { "query": "最近30天哪些紧急案件被OVERTURN" }
  Response: {
    "intent": "QUERY_CASE",
    "entities": { "timeRange": "30d", "urgency": true, "verdict": "OVERTURN" },
    "translatedQuery": { "contract": "ConstitutionCourt", "method": "getCases", "params": {...} },
    "results": [...]
  }
```

### 2.3 P1: 中继网络智能体自治

#### 问题
V12中继节点需要人工管理（注册/费率调整/故障切换），缺乏自组织能力。

#### 方案

**中继智能体架构**:
```
RelayAgent = Auto-Registration + Self-Optimization + Self-Healing + Self-Governance
```

**新增合约: RelayAgentController.sol**
- `proposeRelayJoin(computeCapacity, feeRate)`: 中继器自动申请加入网络
- `reportHealth(metrics)`: 周期性健康上报
- `proposeFeeAdjustment(newFeeRate)`: 基于负载自调费率
- `requestFailover(taskId)`: 请求故障转移
- `voteOnNetworkProposal(proposalId, support)`: 参与网络治理投票

**新增文件**:
| # | 文件 | 说明 |
|---|------|------|
| 1 | `blockchain/contracts/RelayAgentController.sol` | 中继自治控制合约 |
| 2 | `backend/src/services/relayAgentService.ts` | 链下自治逻辑 |
| 3 | `backend/src/api/relay-v2.ts` | V13中继API |

---

## 三、测试规划

| 模块 | 测试数 | 覆盖 |
|------|--------|------|
| V13CreditProof Circuit | 8 | 电路正确性4+边界3+Gas1 |
| V13ZKCreditVerifier | 6 | 验证4+提交2 |
| V13NLU Engine | 12 | 分类4+实体4+查询4 |
| V13RelayAgentController | 8 | 自注册2+健康2+费率2+故障2 |
| V13集成 | 6 | NLU→Court2+ZK→Credit2+Relay自治2 |
| **合计** | **40** | |

---

## 四、里程碑

| 里程碑 | 目标日期 | 交付 |
|--------|---------|------|
| M1 | +1周 | circom电路+测试+Prover服务 |
| M2 | +2周 | NLU引擎6意图+API+前端 |
| M3 | +3周 | RelayAgentController+自治逻辑 |
| M4 | +4周 | 集成测试+文档+部署 |

---

## 五、技术约束

- Circom 2.1需要Rust工具链（circom编译器+rapidsnark）
- Groth16可信设置需要Powers of Tau文件（小型电路可下载预生成）
- NLU模型可选：规则引擎优先（零依赖），BERT模型作为后续增强
- 中继自治链下逻辑需要定时器/heartbeat机制
- V13 Solidity合约将继续使用pragma ^0.8.24

---

## 六、风险

| 风险 | 概率 | 影响 | 缓解 |
|------|------|------|------|
| circom编译器Windows兼容性 | 中 | 高 | 使用WSL2或Docker编译电路 |
| Groth16验证Gas过高 | 低 | 中 | 使用PLONK替代或优化电路 |
| NLU意图分类准确率 | 中 | 中 | 规则引擎兜底，不依赖模型 |
| 中继自治安全性 | 中 | 高 | 多签审批+速率限制+紧急暂停 |
