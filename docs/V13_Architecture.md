# Σ-Cloud V13.0 系统架构设计文档

> **架构师**: 高见远 (Gao) · Architect  
> **版本**: V13.0  
> **基线**: V12.0 (25合约 / 130测试 / API V12.0.0)  
> **日期**: 2026-05-23

---

## 1. 架构演进

```
V12.0: 6G-Σ融合四层架构
  Layer4: 意图驱动接口 (关键词匹配)
  Layer3: 内生AI引擎 (链下分析/模拟)
  Layer2: 通算一体调度 (动态费率/路由)
  Layer1: 可信基础设施 (模拟ZK证明)

                    ↓ V13.0 升级 ↓

V13.0: zk-NLU自治架构
  Layer4: 意图驱动接口 (NLU引擎 - 6意图分类 + 实体抽取)
  Layer3: 内生AI引擎 (链下分析 + 自治决策 + 电路证明)
  Layer2: 通算一体调度 (自调费率 + 自愈路由 + Agent自治)
  Layer1: 可信基础设施 (真实zk-SNARK电路 + 链上验证)
```

---

## 2. ZK信用证明电路

### 2.1 电路设计

**CreditProof.circom**:
```circom
pragma circom 2.1.0;

include "circomlib/comparators.circom";
include "circomlib/multiplication.circom";

template CreditProof() {
    // 私有输入（Agent不想暴露的）
    signal input phiScore;       // 0-10000
    signal input courtScore;     // 0-10000
    signal input laborScore;     // 0-10000
    signal input relayScore;     // 0-10000
    
    // 公共输入（验证者知道的）
    signal input threshold;      // 目标阈值
    signal input agentAddress;   // Agent地址（防止证明转移）
    
    // 公共输出
    signal output creditGrade;           // 计算出的信用等级
    signal output isAboveThreshold;      // 1=达标, 0=未达标
    
    // 加权求和 (避免浮点: 整数先乘权重再除10000)
    signal weightedPhi;
    signal weightedCourt;
    signal weightedLabor;
    signal weightedRelay;
    
    weightedPhi <== phiScore * 3000;
    weightedCourt <== courtScore * 2500;
    weightedLabor <== laborScore * 2500;
    weightedRelay <== relayScore * 2000;
    
    signal totalWeighted;
    totalWeighted <== weightedPhi + weightedCourt + weightedLabor + weightedRelay;
    
    // creditGrade = totalWeighted / 10000
    creditGrade <== totalWeighted \ 10000;
    
    // 阈值比较
    component gte = GreaterEqThan(14); // 14 bits for 0-16383
    gte.in[0] <== creditGrade;
    gte.in[1] <== threshold;
    isAboveThreshold <== gte.out;
}
```

### 2.2 证明流程

```
1. Agent请求证明:
   POST /api/v13/credit/zk-proof
   { agent, threshold, dimensions: {phiScore, courtScore, laborScore, relayScore} }

2. 链下证明生成:
   a. zkProver.ts 计算witness
   b. snarkjs生成Groth16证明
   c. 返回 { proof, publicSignals: [creditGrade, isAboveThreshold, threshold, agentAddress] }

3. 链上验证:
   ZKCreditVerifier.submitCreditProof(proof, threshold, creditGrade)
   → 调用CreditProofVerifier.sol验证Groth16证明
   → 验证通过则存储证明哈希，Agent获得"信用达标"标记

4. 第三方验证:
   任何人可调用 verifyCreditProof() 验证已提交的证明
```

### 2.3 Gas估算

| 操作 | Gas | 说明 |
|------|-----|------|
| Groth16验证 | ~280,000 | 标准Groth16验证 |
| submitCreditProof | ~300,000 | 含验证+存储 |
| verifyCreditProof | ~10,000 | 仅读取+校验 |

### 2.4 密钥管理

```
circuits/
  CreditProof/
    CreditProof.circom     # 电路源码
    CreditProof.r1cs       # 编译后的R1CS
    CreditProof.wasm       # witness计算WASM
    CreditProof_0000.zkey  # Phase 1密钥
    CreditProof_final.zkey # Phase 2密钥（生产环境需MPC）
    verification_key.json   # 验证密钥
```

---

## 3. NLU意图引擎

### 3.1 管线架构

```
┌─────────────┐    ┌──────────────┐    ┌───────────────┐    ┌──────────────┐    ┌─────────────┐
│  Tokenizer   │───→│  Intent      │───→│  Entity       │───→│  Query       │───→│  Executor   │
│  分词+归一化  │    │  Classifier  │    │  Extractor    │    │  Generator   │    │  链上/链下   │
└─────────────┘    └──────────────┘    └───────────────┘    └──────────────┘    └─────────────┘
```

### 3.2 意图分类规则

```typescript
// 意图规则定义
const intentRules = [
  {
    intent: 'QUERY_CASE',
    patterns: ['案件', '裁决', '判决', '投票', 'UPHOLD', 'OVERTURN', 'REMAND'],
    required: ['court|case|案件|裁决'],
    entities: ['timeRange', 'verdict', 'urgency', 'caseId']
  },
  {
    intent: 'QUERY_CREDIT',
    patterns: ['信用', '评级', '等级', '评分', 'AAA', 'BBB'],
    required: ['credit|信用|评级|等级'],
    entities: ['agentAddress', 'grade', 'dimension']
  },
  {
    intent: 'QUERY_RELAY',
    patterns: ['中继', '路由', '费率', '延迟', '节点'],
    required: ['relay|中继|路由|费率'],
    entities: ['sourceChain', 'targetChain', 'metric']
  },
  {
    intent: 'QUERY_PHI',
    patterns: ['Φ值', 'phi', '意识', '代谢', '冬眠'],
    required: ['phi|Φ值|意识|代谢'],
    entities: ['agentAddress', 'threshold']
  },
  {
    intent: 'ANALYZE_TREND',
    patterns: ['趋势', '变化', '对比', '历史', '走势'],
    required: ['趋势|变化|对比|历史'],
    entities: ['metric', 'timeWindow', 'agentAddress']
  },
  {
    intent: 'PREDICT_OUTCOME',
    patterns: ['预测', '预演', '模拟', '会怎样', '会不会'],
    required: ['预测|预演|模拟|会怎样'],
    entities: ['caseId', 'scenario']
  }
];
```

### 3.3 实体抽取

| 实体类型 | 正则模式 | 示例 |
|---------|---------|------|
| agentAddress | `0x[0-9a-fA-F]{40}` | 0x1234...abcd |
| timeRange | `最近(\d+)(天|周|月)` | 最近30天 |
| verdict | `UPHOLD\|OVERTURN\|REMAND` | OVERTURN |
| grade | `AAA\|AA\|A\|BBB\|BB\|B\|CCC` | BBB |
| chainId | `链(\d+)\|chain(\d+)` | 链1 |
| numericValue | `\d+\.?\d*` | 5000 |
| urgency | `紧急\|urgent\|emergency` | 紧急 |

---

## 4. 中继智能体自治

### 4.1 自治状态机

```
                    ┌──────────┐
         ┌─────────→│  PENDING  │←──────────┐
         │          └─────┬────┘            │
         │                │ approveJoin()   │ slash/deregister
         │                ↓                 │
         │          ┌──────────┐             │
         │          │  ACTIVE   │────────────┘
         │          └─────┬────┘
         │                │ reportUnhealthy()
         │                ↓
         │          ┌──────────┐     recover()
         │          │ DEGRADED  │──────────────┐
         │          └─────┬────┘               │
         │                │ timeout            │
         │                ↓                    │
         │          ┌──────────┐               │
         └──────────│ RECOVERING│←──────────────┘
                    └──────────┘
```

### 4.2 RelayAgentController.sol 核心

```solidity
contract RelayAgentController {
    enum AgentState { PENDING, ACTIVE, DEGRADED, RECOVERING }
    
    struct RelayAgent {
        address operator;
        AgentState state;
        uint256 computeCapacity;
        uint256 feeRate;
        uint256 healthScore;       // 0-100
        uint256 consecutiveSuccess;
        uint256 lastHealthReport;
        uint256 joinedAt;
    }
    
    function proposeRelayJoin(uint256 computeCapacity, uint256 feeRate) external;
    function reportHealth(uint256 healthScore, uint256 activeTasks) external;
    function proposeFeeAdjustment(uint256 newFeeRate) external;
    function requestFailover(bytes32 taskId) external;
    function approveJoin(address relay) external onlyAdmin;
    function slashRelay(address relay, uint256 amount) external onlyAdmin;
}
```

---

## 5. 文件清单

| # | 类型 | 文件 | 优先级 |
|---|------|------|--------|
| 1 | Circom | `circuits/CreditProof.circom` | P0 |
| 2 | Circom | `circuits/RelayEligibility.circom` | P1 |
| 3 | Solidity | `contracts/verifiers/CreditProofVerifier.sol` | P0 |
| 4 | Solidity | `contracts/ZKCreditVerifier.sol` | P0 |
| 5 | Solidity | `contracts/RelayAgentController.sol` | P1 |
| 6 | TS | `services/zkProver.ts` | P0 |
| 7 | TS | `services/zkCircuitManager.ts` | P0 |
| 8 | TS | `services/nlu/tokenizer.ts` | P0 |
| 9 | TS | `services/nlu/intentClassifier.ts` | P0 |
| 10 | TS | `services/nlu/entityExtractor.ts` | P0 |
| 11 | TS | `services/nlu/queryGenerator.ts` | P0 |
| 12 | TS | `services/nluEngine.ts` | P0 |
| 13 | TS | `services/relayAgentService.ts` | P1 |
| 14 | TS API | `api/nlu.ts` | P0 |
| 15 | TS API | `api/relay-v2.ts` | P1 |
| 16 | React | `ZKProofPanel.tsx` | P0 |
| 17 | React | `NLUQueryPanel.tsx` | P0 |
| 18 | Test | `V13.test.ts` | P0 |

---

## 6. 依赖项

| 依赖 | 版本 | 用途 |
|------|------|------|
| circom | 2.1.x | 电路编译器 |
| snarkjs | 0.7.x | 证明生成+验证 |
| circomlib | 0.8.x | 电路库(comparators等) |
| jieba-js | latest | 中文分词(可选) |

---

## 7. 安全考虑

1. **ZK电路安全**: 电路必须经过审计，确保不存在欠约束(under-constraint)
2. **可信设置**: 生产环境需要MPC仪式生成zkey，开发环境可使用powersoftau
3. **NLU注入**: 意图查询需防止命令注入，所有生成的查询必须经过白名单校验
4. **中继自治**: 自治操作需要速率限制和紧急暂停机制
5. **密钥安全**: proving key和verification key需安全存储
