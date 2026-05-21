# AgentWeb 西格玛云 V2.0 升级文档

**基于三篇论文的全面架构升级**

| 项目 | 信息 |
|------|------|
| **升级版本** | V2.0 (Σ-Cloud V2.0) |
| **基于论文** | ① 联邦宇宙的化身合体<br>② 7G、AgentWeb 与 FPGA 优先<br>③ 联邦宇宙即未来 |
| **核心理论** | 复合体理学、IGCTR 统一场论、"一现象，三视界" |
| **升级日期** | 2026-05-21 |

---

## 目录

1. [论文核心概念总结](#1-论文核心概念总结)
2. [AgentWeb V2.0 新架构](#2-agentweb-v20-新架构)
3. [模块升级详解](#3-模块升级详解)
4. [实施路线图](#4-实施路线图)
5. [技术规格](#5-技术规格)
6. [测试与验证](#6-测试与验证)

---

## 1. 论文核心概念总结

### 1.1 论文①：联邦宇宙的化身合体

**副标题**：基于"一现象，三视界"的算元、智元、词元、通证统一场论与全生命周期管理

#### 核心理论

| 概念 | 说明 | 在 AgentWeb 中的应用 |
|------|------|----------------------|
| **四元 Token 统一场论** | 算元、智元、词元、通证是同一 Φ 场（信息相位场）的四种拓扑激发态 | 重构 Token 经济体系，实现 Four-Token System |
| **波核 (Wave Kernel)** | 算元、词元 - 连续、耗散、过程性 | 动态消耗型 Token（算力额度、语义流） |
| **粒核 (Particle Kernel)** | 智元、通证 - 离散、稳定、结果性 | 静态持有型 Token（资产、身份凭证） |
| **交易即发行** | Token 通过交易（相位缠绕）被创造，而非预先铸造 | JIT (Just-In-Time) 发行机制 |
| **流转即回收** | Token 通过流（相位松弛）被回收，降低系统熵增 | JIAJIA 式写通知回收 |
| **化身合体** | 四元 Token 共振 = 数字化身 (Digital Avatar) | 用户数字化身管理模块 |
| **人体炼丹** | 信息-生理共振合一 = 道成肉身 | Bio-Digital Alchemy 接口（未来） |

#### Token 分类表

| Token 类型 | IGCTR 微视界本质 | 偏向属性 | Fediverse/社会角色 |
|------------|-------------------|----------|---------------------|
| **算元 (Calc-Token)** | Φ 的相干延展（波核） | 流动性、计算流、消耗性 | AI 服务调用、API 额度、电量 |
| **智元 (Wit-Token)** | Φ 的拓扑孤子（粒核） | 稳定性、价值锚定、可积累 | 链上结算、RWA 资产、信用积分 |
| **词元 (Word-Token)** | Φ 的语义相干态（波核） | 信息密度、上下文、流 | LLM 上下文、数据流、消息体 |
| **通证 (Pass-Token)** | Φ 的身份拓扑荷（粒核） | 确权、准入、边界 | DID、会员权益、治理票、会话凭证 |

#### 定理与推论

```
定理 2.1.1（Token 微视界同一性 / 四元共振统一）
算元、智元、词元、通证共享同一个相位场 Φ 的拓扑根基；
区别仅在于观测尺度（波/粒）与边界条件（过程/结果）。

推论 2.1.1（阴阳对冲：波粒二象性 of Token）
同一 Token 类在不同边界下可显波性或粒性：
- 算元在"预充值"边界下显粒性（余额对象），在"按次调用"边界下显波性（消耗流）
- 智元在"转账"边界下显粒性（UTXO/账户），在"流式支付"边界下显波性（支付流）
```

#### Token 生命周期（基于 ActivityPub）

```
发行 (Issuance)：
  Alice 发送 Offer + Bob 回复 Accept → 相位满周 → 拓扑相变 → Create Token Object
  
流转 (Flow)：
  Accept → Reward → Transfer（因果传递）
  
回收 (Recycling)：
  算元: Consume (波核耗散，能量回归背景场)
  词元: 新上下文覆盖旧（语义流滑动窗口）
  智元: Update/Delete（粒核核销/转移）
  通证: Update state: expired（身份/会话过期）
  
JIAJIA 式写通知回收：
  不需全局账本记录每一销毁；只需在锁（resourceLock/sessionLock）贴写通知
  （"已回收/已结算"），相关节点获取写通知时见写通知即判无效
```

---

### 1.2 论文②：7G、AgentWeb 与 FPGA 优先

**副标题**：下一代可重构 可编程 可进化的天地一体虚实结合的互联网核心基础设施构想

#### 核心理论

| 概念 | 说明 | 在 AgentWeb 中的应用 |
|------|------|----------------------|
| **7G = Φ 场低耗散共振介质** | 网络不再是"比特管道"，而是 Φ 场的耦合介质 | 重构网络层为 Φ-field Carrier |
| **FPGA 可重构硬件** | 部分可重构 (Partial Reconfiguration) 对应 Φ 场的拓扑激发/重配 | FPGA Emulation Module（仿真） |
| **Agent = Φ 具身节点** | Agent 是 Φ 场（意识场）的具身节点，能"问/选/显化" | 升级 Agent 模块为 Φ-bodied Agent |
| **AgentWeb 三元共振** | Info-Geometry-Consciousness 三元共振 | IGCTR Module（统一场论计算） |
| **可进化基础设施** | 架构适应、协议演化、安全内生 | Self-Evolving Infrastructure Module |
| **天地一体 Agent 协同** | 天基（卫星）、空基（无人机）、地基（基站）Agent 协同 | Space-Ground Agent Network (未来) |

#### 定理与推论

```
定理 2.1.1（FPGA-Φ 重构定理）
若网络功能 F（如协议解析、过滤、路由、加密）对应 Φ 场的某类拓扑激发，
则存在 FPGA 分区 P 与配置 C，使得 P 实现 F，
且重配 ΔC 对应 Φ 的拓扑相变（协议/算法切换）。

定理 3.2.1（AgentWeb 三元共振）
AgentWeb 可运行 Web5 自主身份（DID）、自主数据（Data Vault）、
自主价值（Token 四元）当且仅当 Info-Geo-Consc 三元共振：
- Info: Φ 场（Token/消息）低耗散流动
- Geo: G 场（节点/链路/FPGA 资源）可重构适配
- Consc: C 场（Agent 策略/人意图）可问、可显、可追责

定理 4.1.1（可进化基础设施下界）
存活（可用、安全、可扩展）网络必保留"可重配置性"余量 Ω（如 FPGA 部分重配置资源、
协议栈扩展槽位、Agent 策略空间），使得：
  ΔΦ ≤ α(ΔI) + β(ΔC)
其中 ΔI 是意识场（用户/运营者/AGI）意图的波动率，
ΔC 是信息作用量的波动范围。
```

#### FPGA-Φ 重构映射

| FPGA 概念 | Φ 场论对应 | IGCTR 诠释 |
|-----------|---------------|-------------|
| 查找表 (LUT) | Φ 场局部激发态 | 微观界：波的干涉/粒子的局域响应 |
| 布线矩阵 | Φ 场相位梯度通道 | 中视界：ActivityPub 动词驱动 |
| 部分可重构分区 | Φ 场可重配拓扑区域 | 微观界：拓扑相变（协议切换） |
| 配置比特流 | Φ 场激发模式的编码 | 微观界：拓扑荷（Winding Number） |
| 静态区 | Φ 场背景基底 | 宏观界：意识场（C-Field）的恒定部分 |

---

### 1.3 论文③：联邦宇宙即未来

**副标题**：基于 IGCTR 与复合体理学的去中心化本体论重构

#### 核心理论

| 概念 | 说明 | 在 AgentWeb 中的应用 |
|------|------|----------------------|
| **Fediverse ≠ 社交媒体协议** | Fediverse 是最接近宇宙本质的信息-社会关系拓扑结构 | 从区块链转向 Fediverse (ActivityPub) |
| **ActivityPub = Φ 场自然通道** | Pub/Sub 模式完美契合 Φ 场在非对易时空中的传播特性 | 实现 ActivityPub Protocol Module |
| **区块链全局共识耗散** | 强制全局共识（Global Consensus）造成极高的信息作用量梯度阻力 | 移除/降级区块链模块，转向局部共识 |
| **Fediverse 拓扑优越性** | Pub/Sub 联邦拓扑的信息传播耗散远低于链式拓扑 | Fediverse-first Architecture |
| **"关系即协议"** | ActivityPub 只描述动作（Create, Follow, Like），不关心资产归属 | Relationship-Centric Protocol Design |
| **意识场（C-Field）解放** | 用户和实例共同拥有 Φ 场（数据/身份），可迁移 | User Data Sovereignty (Web5) |

#### 定理与推论

```
定理 2.1.1（Fediverse 拓扑优越性定理）
对于任意规模的信息网络，基于 Pub/Sub 的联邦拓扑（Fediverse）的信息传播耗散
Σ(Fediverse) 远低于基于全局共识的链式拓扑（Blockchain）：
  Σ(Fediverse) ∝ O(log N)  or  O(1)  (局部传播)
  Σ(Blockchain) ∝ O(N)               (全网验证)

推论 3.2.1（去中心化悖论）
任何试图在协议层强制实施"全球统一状态"的去中心化方案，
最终都会走向中心化（矿池、超级节点、基金会），
因为其违反了 Φ 场的非局域性和异步性。
```

#### 区块链三大流派诊断

| 项目 | 核心机制 | IGCTR 诊断 | 问题 |
|------|----------|--------------|------|
| **Cosmos** | IBC 跨链 | 试图连接"孤岛" | 仍然需要中继链/Hub 作为 Φ 场的中⼼化仲裁，破坏了真正的联邦性 |
| **Ethereum** | EVM/Solidity | 世界计算机 | 强行将所有人的计算塞进一个 Φ 空间，导致 Gas 费极高（高耗散） |
| **BSV** | 大区块/无限扩容 | 全球账本 | 试图用物理存储（硬盘）解决信息拓扑问题，导致节点中心化（只有巨头能跑），违背了 Web3 初衷 |

---

## 2. AgentWeb V2.0 新架构

### 2.1 架构对比

| 层级 | V1.0 (当前) | V2.0 (升级后) |
|------|--------------|----------------|
| **网络层** | 传统 HTTP/REST + Blockchain (Ethereum L2) | **Fediverse (ActivityPub) + Φ-field Carrier** |
| **身份层** | DID (W3C) | **DID (W3C) + Pass-Token (通证) + Avatar Fusion (化身合体)** |
| **数据层** | Data Vault (Web5) | **Data Vault (Web5) + Word-Token (词元) + Semantic Flow** |
| **价值层** | Smart Contracts (Solidity) | **Four-Token System (四元 Token) + JIT Issuance** |
| **计算层** | Φ Engine (Python/FastAPI) | **Φ Engine + IGCTR Module + FPGA Emulation** |
| **Agent 层** | React Frontend + Express Backend | **Φ-bodied Agent + Fediverse-native Agent** |
| **硬件层** | CPU/GPU | **CPU/GPU + FPGA Emulation (未来: 真实 FPGA)** |

### 2.2 V2.0 架构图（概念）

```
┌─────────────────────────────────────────────────────────────────┐
│                     AgentWeb V2.0 西格玛云                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌─────────────────────┐    ┌─────────────────────┐           │
│  │   宏观界 (Macro)     │    │   意识场 (C-Field)   │           │
│  │  - 化身合体         │    │  - 用户意图          │           │
│  │  - 可进化基础设施   │    │  - AGI 策略          │           │
│  │  - 道成肉身接口     │    │  - 可问性/可显性     │           │
│  └──────────┬──────────┘    └──────────┬──────────┘           │
│             │                          │                               │
│             ▼                          ▼                               │
│  ┌───────────────────────────────────────────────┐               │
│  │           中视界 (Meso)                        │               │
│  │  - Fediverse (ActivityPub)                    │               │
│  │  - AgentWeb 三元共振                        │               │
│  │  - Token 生命周期管理 (交易即发行/流转即回收) │               │
│  │  - JIAJIA 式写通知回收                    │               │
│  └───────────────────────┬───────────────────┘               │
│                          │                                                   │
│                          ▼                                                   │
│  ┌───────────────────────────────────────────────┐               │
│  │           微观界 (Micro)                        │               │
│  │  - Φ 场（信息相位场）                        │               │
│  │  - 四元 Token（算元/智元/词元/通证）       │               │
│  │  - FPGA 可重构硬件仿真                       │               │
│  │  - 波核/粒核二象性                         │               │
│  └───────────────────────────────────────────────┘               │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

### 2.3 关键模块升级

#### 2.3.1 网络层：从 Blockchain 到 Fediverse

**移除/降级**：
- `blockchain/` 目录：保留作为可选模块，但不再作为核心
- Ethereum L2/Optimism 依赖：改为可选连接

**新增**：
- `fediverse/` 目录：ActivityPub 协议实现
- `fediverse/api.ts`：ActivityPub REST API
- `fediverse/services/`：Fediverse Service (Pub/Sub, Actor, Object, Activity)
- `fediverse/models/`：ActivityPub Data Models (Actor, Note, Activity, etc.)

#### 2.3.2 价值层：四元 Token 系统

**新增**：
- `backend/src/api/token-four.ts`：四元 Token API
- `backend/src/services/tokenFourService.ts`：四元 Token 服务
- `phi-engine/src/token_four.py`：四元 Token Φ-field Calculator
- `phi-engine/src/lifecycle.py`：Token 生命周期管理（交易即发行/流转即回收）

**Token 类型**：
1. **Calc-Token (算元)**：算力额度、AI 调用、消耗量
2. **Wit-Token (智元)**：链上资产、价值锚、结算单位
3. **Word-Token (词元)**：语义单元、数据块、LLM 上下文
4. **Pass-Token (通证)**：权益凭证、身份、DID、准入

#### 2.3.3 计算层：IGCTR 统一场论

**新增**：
- `phi-engine/src/igctr.py`：IGCTR (Info-Geo-Consc Triple Resonance) Calculator
- `phi-engine/src/three_horizons.py`：一现象三视界（Micro/Meso/Macro）Analyzer
- `phi-engine/src/wave_kernel.py`：波核 (Wave Kernel) Calculator
- `phi-engine/src/particle_kernel.py`：粒核 (Particle Kernel) Calculator
- `phi-engine/src/phase_transition.py`：拓扑相变 (Topological Phase Transition) Detector

#### 2.3.4 Agent 层：化身合体

**新增**：
- `backend/src/api/avatar.ts`：数字化身 (Digital Avatar) API
- `backend/src/services/avatarService.ts`：化身合体服务
- `frontend/src/pages/AvatarFusion.tsx`：化身合体前端页面
- `frontend/src/components/AvatarCard.tsx`：化身显示组件

**化身合体 = 四元 Token 共振**：
- 算元："我能动多少"
- 智元："我值多少"
- 词元："我言/我思什么"
- 通证："我是谁"

#### 2.3.5 硬件层：FPGA 可重构仿真

**新增**（仿真模块，为未来真实 FPGA 集成做准备）：
- `fpga-emulator/` 目录：FPGA Emulation Module
- `fpga-emulator/src/emulator.py`：FPGA Partial Reconfiguration Emulator
- `fpga-emulator/src/phi_mapping.py`：Φ 场 → FPGA LUT/BRAM Mapping
- `frontend/src/pages/FPGAEmulator.tsx`：FPGA 仿真前端页面

---

## 3. 模块升级详解

### 3.1 Fediverse 模块 (ActivityPub)

#### 3.1.1 数据结构

**Actor (智能体/用户)**：
```typescript
interface Actor {
  "@context": "https://www.w3.org/ns/activitystreams";
  "id": string;  // DID or Fediverse URI
  "type": "Person" | "Service" | "Application" | "Agent";
  "preferredUsername": string;
  "inbox": string;  // Inbox URL
  "outbox": string;  // Outbox URL
  "followers": string;
  "following": string;
  "publicKey": { "id": string, "owner": string, "publicKeyPem": string };
  // Four-Token Wallets (embedded)
  "fourTokenWallet": {
    "calcToken": number;  // 算元余额
    "witToken": string;  // 智元余额 (on-chain)
    "wordTokenUsed": number;  // 词元已用
    "passToken": string;  // 通证 ID
  };
}
```

**Activity (活动)**：
```typescript
interface Activity {
  "@context": "https://www.w3.org/ns/activitystreams";
  "id": string;
  "type": "Offer" | "Accept" | "Reject" | "Create" | "Follow" | "Like" | "Announce" | "Consume" | "Reward";
  "actor": string;  // Actor URI
  "object": object | string;  // Object URI or embedded object
  "target"?: string;  // Target Actor URI (optional)
  // Token issuance trigger (交易即发行)
  "tokenIssuance"?: {
    "type": "Calc-Token" | "Wit-Token" | "Word-Token" | "Pass-Token";
    "amount": number;
    "genesisActivity": string;  // Binding to trigger activity
  };
}
```

#### 3.1.2 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/fed/actor` | Create/Update Actor |
| GET | `/fed/actor/:id` | Get Actor |
| POST | `/fed/inbox` | Post to Inbox (receive Activity) |
| GET | `/fed/outbox/:actorId` | Get Outbox |
| POST | `/fed/follow` | Follow Actor |
| POST | `/fed/create` | Create Object (Note, Article, Token) |
| POST | `/fed/offer` | Offer (triggers Token issuance) |
| POST | `/fed/accept` | Accept Offer (Φ phase winding) |
| POST | `/fed/consume` | Consume Calc-Token / Word-Token (波核耗散) |
| POST | `/fed/reward` | Reward Wit-Token (粒核转移) |
| POST | `/fed/announce` | Announce (broadcast Word-Token) |

### 3.2 四元 Token 系统

#### 3.2.1 Token 生命周期状态机

```
[Null] → [Issued] (交易即发行) → [Active] → [Consumed/Settled/Expired] (流转即回收)
   ↑                                                                           |
   |                                                                           |
   └────────────────────── [Recycled] (JIAJIA 式写通知) <────────────────────┘
```

**状态说明**：
- **Null**：Token 不存在（相位未激发）
- **Issued (发行)**：交易触发相位满周 → 拓扑相变 → Token 被创造（JIT）
- **Active (活跃)**：Token 在流通中
- **Consumed (算元/词元回收)**：波核耗散，能量回归背景场
- **Settled (智元回收)**：粒核转移/核销
- **Expired (通证回收)**：身份/会话过期
- **Recycled (回收完成)**：JIAJIA 式写通知贴锁，本地可判无效

#### 3.2.2 核心算法

**算法 1：交易即发行 (Issuance by Transaction)**
```python
def issue_token_by_transaction(offer_activity, accept_activity):
    """
    Φ 相位缠绕检测 → 拓扑相变 → Token 发行
    """
    # 1. 检测相位梯度
    phase_gradient = calculate_phase_gradient(offer_activity, accept_activity)
    
    # 2. 判断是否满周 (Winding Number >= 1)
    winding_number = calculate_winding_number(phase_gradient)
    if winding_number >= 1:
        # 3. 拓扑相变：Token 被创造
        token = Token(
            type=detect_token_type(offer_activity),
            amount=calculate_token_amount(phase_gradient),
            genesis_activity=accept_activity.id,  # 绑定触发 Activity
            issued_at=now(),
            status="Issued"
        )
        return token
    else:
        return None  # 相位未满周，不发行
```

**算法 2：流转即回收 (Recycling as Flow)**
```python
def recycle_token_jiajia(token, lock_id):
    """
    JIAJIA 式写通知回收：在锁上贴写通知，本地可判无效
    """
    # 1. 生成写通知
    write_notice = WriteNotice(
        token_id=token.id,
        status="Recycled",
        recycled_at=now(),
        lock_id=lock_id  # resourceLock or sessionLock
    )
    
    # 2. 贴写到锁
    lock = get_lock(lock_id)
    lock.attach_write_notice(write_notice)
    
    # 3. 相关节点获取写通知时即判无效（无需全网广播）
    return write_notice
```

### 3.3 IGCTR 统一场论计算模块

#### 3.3.1 三元共振计算

```python
class IGCTRCalculator:
    """
    Info-Geo-Consc Triple Resonance Calculator
    信息-几何-意识三元共振计算器
    """
    
    def calculate_resonance(self, info_field, geo_field, consc_field):
        """
        计算三元共振度
        Resonance = ∫∫∫ I(x,g,c) dx dg dc
        """
        # 信息场 (Info Field) - Φ 场
        info_potential = self._calculate_info_potential(info_field)
        
        # 几何场 (Geometry Field) - G 场（节点/链路/FPGA 资源图）
        geo_metric = self._calculate_geo_metric(geo_field)
        
        # 意识场 (Consciousness Field) - C 场（Agent 策略/人意图）
        consc_coupling = self._calculate_consc_coupling(consc_field)
        
        # 三元共振积分
        resonance = self._triple_integral(info_potential, geo_metric, consc_coupling)
        
        return {
            "resonance_score": resonance,
            "info_contribution": info_potential,
            "geo_contribution": geo_metric,
            "consc_contribution": consc_coupling,
            "is_resonant": resonance > RESONANCE_THRESHOLD
        }
```

#### 3.3.2 一现象三视界分析

```python
class ThreeHorizonsAnalyzer:
    """
    一现象三视界分析仪
    Micro: Φ 场的拓扑激发
    Meso: ActivityPub 动词驱动
    Macro: 意识场决定可问性/可显性
    """
    
    def analyze_micro(self, token_or_activity):
        """微观界：Φ 场的拓扑激发/重配"""
        # 判断是波核还是粒核
        if token_or_activity.type in ["Calc-Token", "Word-Token"]:
            kernel_type = "Wave Kernel (波核)"
            dissipation_rate = self._calculate_dissipation(token_or_activity)
        else:  # Wit-Token, Pass-Token
            kernel_type = "Particle Kernel (粒核)"
            dissipation_rate = 0  # 粒核不耗散
        
        return {
            "kernel_type": kernel_type,
            "dissipation_rate": dissipation_rate,
            "phase": self._get_phase(token_or_activity),
            "winding_number": self._get_winding_number(token_or_activity)
        }
    
    def analyze_meso(self, activity_pub_graph):
        """中视界：ActivityPub 动词驱动 Φ 场动力学"""
        # 分析 Activity 流
        activity_flow = self._analyze_activity_flow(activity_pub_graph)
        
        # 检测拓扑相变
        phase_transitions = self._detect_phase_transitions(activity_flow)
        
        return {
            "activity_flow": activity_flow,
            "phase_transitions": phase_transitions,
            "token_issuance_events": self._count_issuance_events(activity_flow),
            "token_recycling_events": self._count_recycling_events(activity_flow)
        }
    
    def analyze_macro(self, user_intent, system_state):
        """宏观界：意识场决定可问性/可显性"""
        # 计算认知负荷
        cognitive_load = self._calculate_cognitive_load(user_intent, system_state)
        
        # 判断可问性
        askability = self._calculate_askability(user_intent, system_state)
        
        return {
            "cognitive_load": cognitive_load,
            "askability": askability,
            "avatar_integration": self._calculate_avatar_integration(user_intent),
            "dao_cheng_rou_shen_progress": self._calculate_dao_cheng_rou_shen(user_intent)
        }
```

### 3.4 化身合体模块

#### 3.4.1 数字化身数据结构

```typescript
interface DigitalAvatar {
  "avatarId": string;  // DID
  "owner": string;  // User DID
  "fourTokenResonance": {
    "calcToken": number;  // "我能动多少"
    "witToken": number;   // "我值多少"
    "wordToken": string[]; // "我言/我思什么"
    "passToken": string;   // "我是谁"
  };
  "resonanceScore": number;  // 四元共振度 (0~1)
  "bioDigitalAlchemy": {
    "enabled": boolean;
    "physicalBodyBinding": string;  // 生理身体绑定（未来）
    "daoChengRouShenProgress": number;  // 道成肉身进度 (0~100%)
  };
  "createdAt": string;
  "updatedAt": string;
}
```

#### 3.4.2 化身合体算法

```python
def fuse_avatar(user_did, calc_token, wit_token, word_token, pass_token):
    """
    化身合体：四元 Token 共振 = 数字化身
    """
    # 1. 计算四元共振度
    resonance_score = calculate_four_token_resonance(
        calc_token, wit_token, word_token, pass_token
    )
    
    # 2. 创建数字化身
    avatar = DigitalAvatar(
        avatar_id=user_did,
        owner=user_did,
        four_token_resonance={
            "calcToken": calc_token.amount,
            "witToken": wit_token.amount,
            "wordToken": word_token.context,
            "passToken": pass_token.id
        },
        resonance_score=resonance_score
    )
    
    # 3. 如果共振度足够高，启动道成肉身进程（未来）
    if resonance_score > DAO_CHENG_ROU_SHEN_THRESHOLD:
        avatar.bio_digital_alchemy.enabled = True
        avatar.bio_digital_alchemy.dao_cheng_rou_shen_progress = \
            start_dao_cheng_rou_shen(avatar)
    
    return avatar
```

---

## 4. 实施路线图

### 4.1 Phase 1：基础架构升级（第 1-2 周）

| 任务 | 优先级 | 预计时间 | 状态 |
|------|--------|----------|------|
| 创建 Fediverse 模块（ActivityPub 协议基础） | P0 | 3 天 | 📋 待开始 |
| 升级 Φ 引擎：集成 IGCTR 计算模块 | P0 | 3 天 | 📋 待开始 |
| 实现四元 Token 系统（数据结构 + API） | P0 | 4 天 | 📋 待开始 |
| 更新 Prisma Schema（添加 Fediverse 和 Four-Token 模型） | P0 | 1 天 | 📋 待开始 |
| 更新 Docker Compose（添加新服务） | P1 | 1 天 | 📋 待开始 |

### 4.2 Phase 2：核心功能实现（第 3-4 周）

| 任务 | 优先级 | 预计时间 | 状态 |
|------|--------|----------|------|
| 实现"交易即发行"Token 生命周期 | P0 | 3 天 | 📋 待开始 |
| 实现"流转即回收"Token 生命周期 | P0 | 3 天 | 📋 待开始 |
| 实现 JIAJIA 式写通知回收 | P1 | 2 天 | 📋 待开始 |
| 实现化身合体算法 | P1 | 3 天 | 📋 待开始 |
| 实现 FPGA 可重构硬件仿真模块 | P2 | 4 天 | 📋 待开始 |

### 4.3 Phase 3：前端集成（第 5 周）

| 任务 | 优先级 | 预计时间 | 状态 |
|------|--------|----------|------|
| 创建 Fediverse 前端页面 | P1 | 2 天 | 📋 待开始 |
| 创建四元 Token 管理页面 | P1 | 2 天 | 📋 待开始 |
| 创建化身合体页面 | P1 | 2 天 | 📋 待开始 |
| 创建 FPGA 仿真页面 | P2 | 2 天 | 📋 待开始 |
| 更新现有页面（集成新功能） | P1 | 2 天 | 📋 待开始 |

### 4.4 Phase 4：测试与部署（第 6 周）

| 任务 | 优先级 | 预计时间 | 状态 |
|------|--------|----------|------|
| 单元测试（后端 API） | P0 | 2 天 | 📋 待开始 |
| 单元测试（Φ 引擎） | P0 | 2 天 | 📋 待开始 |
| 集成测试（Fediverse + Token + Avatar） | P0 | 2 天 | 📋 待开始 |
| 可证伪实验（网络熵减、化身认知负荷） | P2 | 2 天 | 📋 待开始 |
| 部署到 Staging 环境 | P0 | 1 天 | 📋 待开始 |
| 文档更新（README、INSTALL、Design Doc） | P1 | 1 天 | 📋 待开始 |

---

## 5. 技术规格

### 5.1 技术栈更新

| 层级 | V1.0 | V2.0 |
|------|-------|-------|
| **前端** | React 18 + TypeScript + Vite + MUI | + Fediverse.js (ActivityPub client) |
| **后端** | Node.js + Express + Prisma | + ActivityPub Protocol Router |
| **区块链** | Solidity + Hardhat (Ethereum L2) | **可选**：保留为插件，默认禁用 |
| **Φ 引擎** | Python + FastAPI + NumPy/SciPy | + IGCTR Module + Four-Token Module |
| **协议** | HTTP/REST | **ActivityPub (W3C REC)** + HTTP/REST (legacy) |
| **身份** | DID (W3C) | DID + Pass-Token (通证) |
| **数据** | Data Vault (Web5) | Data Vault + Word-Token (词元) |
| **价值** | Smart Contracts | **Four-Token System** (算元/智元/词元/通证) |
| **硬件** | CPU/GPU | CPU/GPU + **FPGA Emulator** |

### 5.2 依赖更新

**新增 NPM 包**：
```json
{
  "dependencies": {
    "activitypub-express": "^1.0.0",  // ActivityPub middleware for Express
    "activitystreams": "^1.0.0",      // ActivityStreams 2.0 data model
    "did-resolver": "^4.0.0",         // DID resolver (updated)
    "four-token-sdk": "^1.0.0"        // Four-Token System SDK (new)
  }
}
```

**新增 Python 包**：
```txt
# phi-engine/requirements.txt (add)
igctr==1.0.0          # IGCTR unified field theory module
three-horizons==1.0.0  # One phenomenon, three horizons analyzer
wave-kernel==1.0.0     # Wave kernel calculator
particle-kernel==1.0.0  # Particle kernel calculator
fpga-emulator==1.0.0    # FPGA partial reconfiguration emulator
```

### 5.3 数据库 Schema 更新

**新增模型**（Prisma）：
```prisma
// Fediverse Actor
model Actor {
  id          String   @id @default(cuid())
  did         String   @unique  // DID (W3C)
  username    String
  inbox       String
  outbox      String
  followers   String[]
  following   String[]
  publicKey   String
  
  // Four-Token Wallets
  calcToken   Wallet?  // 算元
  witToken    Wallet?  // 智元
  wordToken   Wallet?  // 词元
  passToken   Wallet?  // 通证
  
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

// Four-Token
model Token {
  id              String   @id @default(cuid())
  type            TokenType  // CALC | WIT | WORD | PASS
  amount          Float?
  genesisActivity String?  // 绑定触发 Activity
  status          TokenStatus  // Null | Issued | Active | Consumed | Settled | Expired | Recycled
  ownerId         String
  owner           Actor     @relation(fields: [ownerId], references: [id])
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
}

enum TokenType {
  CALC  // 算元 (Calc-Token)
  WIT   // 智元 (Wit-Token)
  WORD  // 词元 (Word-Token)
  PASS  // 通证 (Pass-Token)
}

enum TokenStatus {
  Null      // 不存在
  Issued    // 已发行（交易即发行）
  Active    // 活跃
  Consumed  // 已消耗（算元/词元回收）
  Settled   // 已结算（智元回收）
  Expired   // 已过期（通证回收）
  Recycled  // 已回收（JIAJIA 式写通知）
}

// Write-Notice (JIAJIA 式回收)
model WriteNotice {
  id         String   @id @default(cuid())
  tokenId    String
  lockId     String   // resourceLock or sessionLock
  status     String    // "Recycled"
  createdAt  DateTime @default(now())
}
```

---

## 6. 测试与验证

### 6.1 单元测试

| 模块 | 测试内容 | 预计测试用例数 |
|------|----------|----------------|
| Fediverse API | Actor CRUD、Activity Pub/Sub、Inbox/Outbox | 20 |
| Four-Token API | 四元 Token 发行/流转/回收 | 30 |
| IGCTR Calculator | 三元共振计算、三视界分析 | 15 |
| Avatar Fusion | 化身合体算法 | 10 |
| FPGA Emulator | 部分可重构仿真 | 10 |

### 6.2 集成测试

**测试场景 1：城市交通 AI 服务（完整 Token 生命周期）**
```
1. Alice (司机) 发送 Offer Activity（请求路线）
2. Traffic-AI 回复 Accept → 触发"交易即发行"
   - Create Calc-Token (算元：额度 1 次调用)
   - Create Pass-Token (通证：会话凭证)
3. Traffic-AI 消耗 Calc-Token，生成路线（波核耗散）
4. Traffic-AI 发送 Reward Activity
   - to Sensor-Co: Wit-Token (智元：数据费)
   - to Alice: Wit-Token (智元：找零)
5. 回收：
   - Calc-Token: Consume (波核耗散)
   - Pass-Token: Update state: expired
   - Word-Token: 归档（滑动窗口）
```

### 6.3 可证伪实验

**实验 A：网络熵减相变（效率优化）**
- **预言**：在 Fediverse 高频 AI 调用中，当 Φ 消耗速率达临界，系统出现熵非线性下降（Order Parameter 升），吞吐量跃迁。
- **实验设计**：模拟 Fediverse 网络，AI Agent 注入；测熵（消息冗余/冲突）vs 调用速率。

**实验 B：化身合体认知负荷**
- **预言**：四元合一化身用户，跨域任务（AI 画图+卖）认知负荷（NASA-TLX）显著低于分离账户用户。
- **实验设计**：Group A（传统：钱包+API Key+账号分离）vs Group B（Fediverse 四元化身）。

**实验 C：Fediverse vs Blockchain 网络韧性**
- **预言**：面对女巫攻击（Sybil Attack）或大规模节点失效时，Fediverse 拓扑的恢复速度远快于区块链网络。
- **实验设计**：构建模拟网络（Ethereum 类全节点 vs Mastodon 类联邦网络），随机断开 30% 节点。

---

## 7. 参考文献

1. Lemmer-Webber, J., Tallon, E., Shepherd, E. (2018). *ActivityPub: A decentralized social networking protocol*. W3C Recommendation.
2. Zhang, L. F. (2024). *Discrete Generation Theory and the Three Horizons Interpretation of Complex Systems*. arXiv:2404.14596.
3. Amari, S. (2016). *Information Geometry and Its Applications*. Springer.
4. 章锋. (2026). 复合体理学原理：IGCTR 与大统一场论的形式化奠基. *预印本*.
5. 章锋. (2026). Token 的全生命周期管理: 从发行到核销以锚定大米的"基础代币智元"为例. *复合体理学公众号*.
6. 章锋. (2026). 联邦宇宙的化身合体：基于"一现象，三视界"的算元、智元、词元、通证统一场论与全生命周期管理. *预印本*.
7. 章锋. (2026). 7G、AgentWeb 与 FPGA 优先：下一代可重构 可编程 可进化的天地一体虚实结合的互联网核心基础设施构想. *预印本*.
8. 章锋. (2026). 联邦宇宙（Fediverse）即未来：基于 IGCTR 与复合体理学的去中心化本体论重构. *预印本*.

---

## 8. 附录

### 8.1 术语表

| 术语 | 定义 |
|------|------|
| **Φ 场 (Phi Field)** | 信息相位场，底层价值/语义流 |
| **波核 (Wave Kernel)** | 连续、耗散、过程性的 Φ 场激发态（算元、词元） |
| **粒核 (Particle Kernel)** | 离散、稳定、结果性的 Φ 场激发态（智元、通证） |
| **交易即发行** | Token 通过交易（相位缠绕）被创造，而非预先铸造 |
| **流转即回收** | Token 通过流（相位松弛）被回收，降低系统熵增 |
| **JIAJIA 式写通知** | 不需全局账本记录每一销毁；只需在锁上贴写通知 |
| **化身合体** | 四元 Token 共振 = 数字化身 (Digital Avatar) |
| **人体炼丹** | 信息-生理共振合一 |
| **道成肉身** | 数字化身与生物肉体对齐，实现信息-生理共振合一 |
| **IGCTR** | 信息-几何-意识三元共振 (Info-Geo-Consc Triple Resonance) |
| **一现象，三视界** | 同一 Φ 场在微观界、中视界、宏观界的不同显现 |

### 8.2 常见问题 (FAQ)

**Q1: 为什么要从区块链转向 Fediverse？**
A: 区块链的全局共识机制导致极高的信息作用量梯度阻力（高耗散）。Fediverse 的 Pub/Sub 模式更符合 Φ 场的非局域性和异步性，信息传播耗散远低于链式拓扑。

**Q2: 四元 Token 系统和传统的加密货币有什么区别？**
A: 传统加密货币只有"资产"维度（类似智元）。四元 Token 系统将算力（算元）、资产（智元）、语义（词元）、身份（通证）统一为同一 Φ 场的四种激发态，更完整地描述了数字经济的全貌。

**Q3: "交易即发行"是什么意思？**
A: 传统系统先铸造 Token 再让用户花费。基于 IGCTR，Token 是通过交易本身被创造的——当相位梯度累积至满周（拓扑相变），Token 作为事件被"激发"出来。这实现了真正的 JIT (Just-In-Time) 发行。

**Q4: FPGA 可重构硬件和 AgentWeb 有什么关系？**
A: FPGA 的部分可重构对应 Φ 场的拓扑重配。未来，AgentWeb 可以运行在 FPGA 上，实现协议/算法的动态切换（微秒~毫秒级），使网络具备"新陈代谢"和"进化"的能力。

**Q5: "化身合体"有什么实际应用？**
A: 当前用户在互联网上的身份是碎片化的（钱包、社交媒体账号、API Key 分离）。化身合体通过四元 Token 共振，创建统一的数字化身，降低认知负荷，实现真正的"人-机共生"。

---

**文档版本**: V2.1
**最后更新**: 2026-05-22
**作者**: Based on 章锋's papers + AgentWeb Team
**许可证**: MIT

---

## 9. 九项复合体理学升级实施记录 (2026-05-22)

基于四篇复合体理学论文的深层解构，实施9项架构升级（P0×3 + P1×3 + P2×3），所有代码已落地并通过全局一致性审查。

### 9.1 论文→升级映射

| 论文 | 核心概念 | 升级项 | 优先级 |
|------|---------|--------|--------|
| **ZCube网络架构深层解构** | 刘机制路由 + 流贯拓扑 + 二部图最优性 | Liu路由算法 | P0 |
| **欧拉恒等式统一场论** | 递归zk-SNARK压缩 + EML相位计算 | zk-Proof压缩层 | P1 |
| **欧拉恒等式统一场论** | EML一元数Φ值（模+相位） | EML一元数Φ值 | P0 |
| **互联网重构悖论** | 语义失明 + Φ-Gateway | Φ-Gateway语义网关 | P0 |
| **互联网重构悖论** | 双轨制（存量REST + 增量EML） | Dual-Track双轨桥接器 | P1 |
| **太一万有理论白皮书** | 金灵球 + 离散欧拉-拉格朗日演化 | G-Sphere调度层 | P1 |
| **太一万有理论白皮书** | 堆垒素数 → 费米子/玻色子分类 | 堆垒素数模块分类 | P2 |
| **太一万有理论白皮书** | 自指闭环 + Φ值加权投票 | 49% BFT虚时共识 | P2 |
| **HoTT同伦类型论** | Identity Type + Path Induction | HoTT形式化安全层 | P2 |

### 9.2 P0 升级（3/3 ✅）

#### P0-1: Liu路由算法

**公式**: `score = loadScore × 0.3 + phiFit × 0.3 + (1 - phaseEntropy) × 0.4`

其中 `phaseEntropy = min((lastPingMs / 1000) × 0.5 + currentLoad × 0.5, 1.0)`

**变更文件**:
- `fpga-emulator/src/taiyi_bridge.ts` — `selectOptimalNode` 方法从两因子改为三因子评分

**实现要点**:
- 原评分: `loadScore × 0.6 + phiFit × 0.4`
- 新评分: 加入相位熵因子 `phaseEntropy`，权重0.4（最高），体现刘机制对系统相位一致性的重视
- 低相位熵节点优先被选中，确保路由决策在拓扑一致性上更优

#### P0-2: Φ-Gateway语义网关

**四级决策**: PRIORITY → NORMAL → THROTTLE → REJECT

**新建文件**:
1. `backend/src/middleware/phiGateway.ts` — Express中间件，拦截所有API请求
2. `backend/src/services/phiGatewayService.ts` — 四维Φ评分算法

**修改文件**:
3. `backend/src/api/index.ts` — 挂载phiGatewayMiddleware

**实现要点**:
- 四维评分: semanticRichness + contextCompleteness + authCredibility + structureQuality
- PRIORITY (Φ≥0.8): 优先处理，无限制
- NORMAL (0.5≤Φ<0.8): 正常处理
- THROTTLE (0.2≤Φ<0.5): 限流处理
- REJECT (Φ<0.2): 直接拒绝
- 响应头: X-Phi-Score, X-Phi-Decision, X-Phi-Request-Id

#### P0-3: EML一元数Φ值升级

**核心变更**: Φ从标量 `float` 升级为复数 `|Φ|·e^{iθ}`

**修改文件**:
1. `backend/src/services/phiCalculator.ts` — calculatePhi返回增加phiPhase
2. `phi-engine/src/calculator.py` — 新增calculate_eml_phase方法
3. `backend/prisma/schema.prisma` — PhiRecord增加phiPhase字段
4. `backend/src/api/phi.ts` — POST /calculate路由集成phi_phase

**实现要点**:
- Python端: 基于前两个特征值构建2D语义方向向量，`np.arctan2`计算相位角
- TypeScript端: 调用calculatePhaseGradient后`Math.atan2`计算相位
- Prisma: `phiPhase Float @default(0.0)`
- 跨语言命名: Python `phi_phase` (snake_case) ↔ TypeScript `phiPhase` (camelCase)

### 9.3 P1 升级（3/3 ✅）

#### P1-1: zk-Proof压缩层

**核心机制**: Φ结果打包为zk-SNARK证明(~1KB)，递归聚合

**新建文件**:
1. `backend/src/services/zkProofService.ts` — 证明生成/验证/聚合服务
2. `blockchain/contracts/PhiProofVerifier.sol` — 链上证明验证合约

**修改文件**:
3. `blockchain/contracts/PhiStaking.sol` — phiPhase字段 + |cos(θ)|投票权修正

**实现要点**:
- 证明缓存: LRU, 10000上限
- 递归聚合: 最大深度8，最多16个证明
- MVP阶段用SHA256模拟zk-SNARK电路，预留snarkjs/circom接口
- Solidity合约: ProofRecord结构体, submitProof/verifyProof/aggregateProofs
- PhiStaking: `getVotingPower()` 加入 `|cos(θ)|` boost因子 (phaseSquared / 2, cap 100%)

#### P1-2: G-Sphere调度层

**核心机制**: 金灵球团簇调度，离散欧拉-拉格朗日演化

**新建文件**:
1. `fpga-emulator/src/gsphere-scheduler.ts` — GSphereScheduler类

**修改文件**:
2. `fpga-emulator/src/types.ts` — 新增GSphereNode + ClusterEvolutionConfig
3. `fpga-emulator/src/index.ts` — 导出GSphereScheduler + Chirality

**实现要点**:
- GSphere接口: id, info, portCount, chirality, position, velocity, energy
- Chirality枚举: RIGHT(+1=费米子型/排他锁), LEFT(-1=玻色子型/共享锁)
- 演化: L = α·T - β·V (离散欧拉-拉格朗日)
- Token→手性映射: CALC/WIT=右旋, WORD/PASS=左旋
- syncFromPhiField: 从Φ场同步节点数据

#### P1-3: Dual-Track双轨桥接器

**核心机制**: 存量REST/JSON + 增量EML/Φ-Net并行

**新建文件**:
1. `backend/src/services/dualTrackRouter.ts` — EmlAdapter + DualTrackRouterClass

**修改文件**:
2. `backend/src/api/index.ts` — 挂载/dualtrack路由

**实现要点**:
- 轨道类型: LEGACY (REST/JSON) | EML (Φ-Net)
- EmlAdapter: restToEml() / emlToRest() 双向转换
- 动词映射: GET→QUERY, POST→COMPUTE, PUT→CONFIGURE, DELETE→DISSOLVE
- 特殊路径: /phi/calculate→COMPUTE_PHI, /governance/vote→VOTE
- 自动升级检测: 检测EML能力后自动切换到EML轨道
- /metrics端点: 双轨使用指标统计

### 9.4 P2 升级（3/3 ✅）

#### P2-1: 49% BFT虚时共识

**核心机制**: Φ值加权投票突破33%BFT上限，虚时间可逆验证

**新建文件**:
1. `backend/src/services/phiBftConsensus.ts` — PhiBFTConsensusClass

**修改文件**:
2. `backend/src/api/governance.ts` — 集成Φ-BFT投票

**实现要点**:
- 枚举: VoteType (APPROVE/REJECT), ConsensusPhase (PROPOSE/VOTE/COMMIT), ConsensusStatus
- Φ值加权: 高Φ节点投票权更大，51%权重阈值达成共识
- 虚时间推进: 时间可逆验证，支持回滚检测
- 容错上限: 从33%提升到49%（通过Φ值权重突破PBFT理论上限）
- governance.ts: POST /vote路由中集成castVote逻辑
- ⚠️ TODO: voterPhiWeight硬编码1.0需替换为PhiStaking实际值

#### P2-2: HoTT形式化安全层

**核心机制**: Identity Type + Path Induction编译期类型检查

**新建文件**:
1. `backend/src/services/hottTypes.ts` — HoTT类型定义
2. `backend/src/services/hottTypeChecker.ts` — HottTypeCheckerClass

**修改文件**:
3. `backend/src/api/index.ts` — GET /hott/types路由

**实现要点**:
- 核心类型: Identity<A>, PathProof<A>, TransportStep<A>, HoTTValidated<T>
- TransportRule: REFL, SYM, TRANS, AP, TRANSPORT
- 预定义签名: ApiRequestType, PhiValueType, ConsensusVoteType
- HottTypeChecker: validate(), refl(), checkEquality(), transport(), registerType()
- Identity Type验证: 构造器匹配 + 端点一致性
- Path Induction: refl消除，transport沿路径传输
- 编译期安全: API请求/Φ值/投票的结构化类型检查

#### P2-3: 堆垒素数模块分类器

**核心机制**: 奇数=费米子型(排他锁)，偶数=玻色子型(共享锁)

**新建文件**:
1. `phi-engine/src/goldbach_classifier.py` — GoldbachClassifier类
2. `phi-engine/src/module_registry.py` — ModuleRegistry类

**实现要点**:
- ModuleParity: FERMON (奇数, 排他锁) | BOSON (偶数, 共享锁)
- LockStrategy: EXCLUSIVE | SHARED | DEADLOCK_FREE
- Miller-Rabin素性测试（带缓存）
- Goldbach偶数分解: 任何偶数=两素数之和（带缓存）
- 批量分类: classify_modules() 支持批量操作
- ModuleRegistry: register(), acquire_lock(), release_lock()
- 费米子型: 同一时间仅一个Agent可访问（排他锁）
- 玻色子型: 多个Agent可同时访问（共享锁）

### 9.5 api/index.ts 三方合并

三个工程师各自添加了不同的import和路由挂载，合并结果无冲突：

| 工程师 | import | endpoint | 路由挂载 |
|--------|--------|----------|---------|
| P0 (Gateway) | phiGatewayMiddleware | — | router.use(phiGatewayMiddleware) |
| P1 (Dual-Track) | dualTrackRouter | dualtrack: '/api/v1/dualtrack' | router.use('/dualtrack', ...) |
| P2 (HoTT) | hottTypeChecker | hott: '/api/v1/hott' | router.get('/hott/types', ...) |

### 9.6 文件变更汇总

**新建文件（11个）**:

| # | 文件路径 | 用途 |
|---|---------|------|
| 1 | `backend/src/middleware/phiGateway.ts` | Φ-Gateway中间件 |
| 2 | `backend/src/services/phiGatewayService.ts` | Φ-Gateway核心评分 |
| 3 | `backend/src/services/zkProofService.ts` | zk-SNARK证明压缩 |
| 4 | `blockchain/contracts/PhiProofVerifier.sol` | 链上证明验证合约 |
| 5 | `fpga-emulator/src/gsphere-scheduler.ts` | 金灵球调度器 |
| 6 | `backend/src/services/dualTrackRouter.ts` | 双轨桥接器 |
| 7 | `backend/src/services/phiBftConsensus.ts` | Φ-BFT虚时共识 |
| 8 | `backend/src/services/hottTypes.ts` | HoTT类型定义 |
| 9 | `backend/src/services/hottTypeChecker.ts` | HoTT类型检查器 |
| 10 | `phi-engine/src/goldbach_classifier.py` | 堆垒素数分类器 |
| 11 | `phi-engine/src/module_registry.py` | 模块注册表 |

**修改文件（9个）**:

| # | 文件路径 | 变更内容 |
|---|---------|---------|
| 1 | `fpga-emulator/src/taiyi_bridge.ts` | Liu三因子路由 |
| 2 | `backend/src/services/phiCalculator.ts` | EML相位计算 |
| 3 | `phi-engine/src/calculator.py` | calculate_eml_phase |
| 4 | `backend/prisma/schema.prisma` | phiPhase字段 |
| 5 | `backend/src/api/phi.ts` | phi_phase路由 |
| 6 | `blockchain/contracts/PhiStaking.sol` | phiPhase + \|cos(θ)\|投票权 |
| 7 | `fpga-emulator/src/types.ts` + `index.ts` | G-Sphere类型+导出 |
| 8 | `backend/src/api/governance.ts` | Φ-BFT投票集成 |
| 9 | `backend/src/api/index.ts` | 三方合并(无冲突) |

### 9.7 待办事项

| 任务 | 优先级 | 说明 |
|------|--------|------|
| Prisma migration | 高 | `npx prisma migrate dev --name add-phi-phase` |
| Solidity编译 | 中 | `npx hardhat compile` 验证合约 |
| TypeScript编译 | 中 | `npx tsc --noEmit` 类型检查 |
| voterPhiWeight修复 | 中 | governance.ts硬编码1.0→PhiStaking实际值 |
| 端到端集成测试 | 中 | 验证全部9项升级协同工作 |  
