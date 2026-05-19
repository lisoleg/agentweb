# AgentWeb 西格玛云 - 详细设计文档

**文档版本**: v1.0  
**创建日期**: 2026-05-18  
**架构师**: 高见远（Gao）  
**项目代号**: 西格玛云 / AgentWeb  
**文档状态**: 正式版

---

## 目录

1. [概述与设计原则](#1-概述与设计原则)
2. [系统架构设计](#2-系统架构设计)
3. [核心模块设计](#3-核心模块设计)
4. [数据模型设计](#4-数据模型设计)
5. [API接口设计](#5-api接口设计)
6. [安全设计](#6-安全设计)
7. [性能优化设计](#7-性能优化设计)
8. [部署架构设计](#8-部署架构设计)
9. [技术选型依据](#9-技术选型依据)
10. [未来演进规划](#10-未来演进规划)

---

## 1. 概述与设计原则

### 1.1 项目背景

AgentWeb（西格玛云）是基于Web5理念设计的下一代数字社会基础设施，旨在构建人机和谐共存的数字共产主义新范式。项目融合了复合体理学理论、去中心化身份（DID）、Φ价值度量、虚时全息共识等技术，为用户提供自主掌控的数字身份和主权化数据管理能力。

### 1.2 设计愿景

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│   ┌─────────┐     ┌─────────┐     ┌─────────┐     ┌─────────┐     │
│   │  用户   │ ←→  │ AgentWeb │ ←→  │  Agent  │ ←→  │ 内容生态 │     │
│   │ (人侧)  │     │ (机侧)   │     │ (服务)   │     │ (天侧)   │     │
│   └─────────┘     └─────────┘     └─────────┘     └─────────┘     │
│                                                                     │
│   核心理念：Φ价值度量 + 虚时全息共识 + 数据主权                       │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 1.3 设计原则

#### 1.3.1 功能性原则

| 原则 | 描述 | 实现方式 |
|------|------|----------|
| **模块化** | 各功能模块独立可替换 | 微服务架构、清晰的模块边界 |
| **可扩展** | 支持水平扩展和垂直扩展 | 无状态设计、分布式架构 |
| **可观测** | 完整的日志、监控、追踪 | 结构化日志、Metrics、Traces |
| **容错性** | 单点故障不影响整体 | 冗余设计、熔断降级 |
| **事务性** | 关键操作保证原子性 | 分布式事务、补偿机制 |

#### 1.3.2 非功能性原则

| 原则 | 目标 | 量化指标 |
|------|------|----------|
| **性能** | 高吞吐量、低延迟 | TPS ≥ 1,000,000, 延迟 < 1s |
| **可用性** | 持续可用、快速恢复 | 99.99% uptime |
| **安全性** | 数据保密、身份可信 | 零信任架构、全链路加密 |
| **可维护性** | 代码清晰、文档完善 | 单元测试覆盖率 ≥ 80% |
| **互操作性** | 标准兼容、生态集成 | W3C DID/VC、Web5 |

### 1.4 核心概念定义

#### Φ值（整合信息值）

Φ值是AgentWeb系统中衡量信息整合程度和价值的标准，基于整合信息理论（IIT）实现。

```
Φ = ∫∫ I(x;t) dx dt

其中：
- I(x;t) 是互信息函数
- x 表示系统状态空间
- t 表示虚时间维度
```

**Φ值的应用场景**：
- 内容质量评估
- 用户贡献量化
- Agent能力度量
- 网络健康度指标

#### DID（去中心化身份）

W3C标准的去中心化标识符，用户自主控制的数字身份。

```
DID Document = {
  "@context": "https://www.w3.org/ns/did/v1",
  "id": "did:agentweb:z6Mkf5...",
  "verificationMethod": [...],
  "authentication": [...],
  "service": [...]
}
```

#### 虚时演化共识

借鉴量子力学概念，将共识过程视为量子态演化：

```
|Ψ(t)⟩ = U(t)|Ψ₀⟩

其中：
- |Ψ₀⟩ 是初始状态
- U(t) 是虚时间演化算子
- |Ψ(t)⟩ 是演化后的状态
```

---

## 2. 系统架构设计

### 2.1 整体架构

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                           AgentWeb 系统架构                                   │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────────┐ │
│  │                         用户交互层 (Presentation Layer)                   │ │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐       │ │
│  │  │ Yandex扩展   │ │ Web应用     │ │ 移动端      │ │ API客户端   │       │ │
│  │  │ (本地Φ引擎)  │ │ (React)     │ │ (React Native)│ │ (SDK)       │       │ │
│  │  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘       │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
│                                      │                                        │
│                                      ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────────────┐ │
│  │                         网关层 (Gateway Layer)                           │ │
│  │  ┌─────────────────────────────────────────────────────────────────┐     │ │
│  │  │                    Nginx / API Gateway                            │     │ │
│  │  │   - 负载均衡    - SSL终止    - 认证鉴权    - 限流熔断              │     │ │
│  │  └─────────────────────────────────────────────────────────────────┘     │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
│                                      │                                        │
│                                      ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────────────┐ │
│  │                         服务层 (Service Layer)                           │ │
│  │                                                                          │ │
│  │  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐        │ │
│  │  │   身份服务       │  │   内容服务       │  │   治理服务       │        │ │
│  │  │   DID/VC管理     │  │   发布/订阅      │  │   提案/投票      │        │ │
│  │  └──────────────────┘  └──────────────────┘  └──────────────────┘        │ │
│  │                                                                          │ │
│  │  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐        │ │
│  │  │   Φ计算服务      │  │   Agent服务      │  │   支付服务       │        │ │
│  │  │   价值度量       │  │   注册/协作      │  │   微支付通道     │        │ │
│  │  └──────────────────┘  └──────────────────┘  └──────────────────┘        │ │
│  │                                                                          │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
│                                      │                                        │
│                                      ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────────────┐ │
│  │                         数据层 (Data Layer)                              │ │
│  │                                                                          │ │
│  │  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐        │ │
│  │  │   PostgreSQL     │  │   Redis          │  │   TimescaleDB    │        │ │
│  │  │   主数据库       │  │   缓存/队列      │  │   时序数据       │        │ │
│  │  └──────────────────┘  └──────────────────┘  └──────────────────┘        │ │
│  │                                                                          │ │
│  │  ┌──────────────────┐  ┌──────────────────┐                             │ │
│  │  │   IPFS           │  │   对象存储       │                             │ │
│  │  │   冷存储         │  │   (S3/OSS)       │                             │ │
│  │  └──────────────────┘  └──────────────────┘                             │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
│                                      │                                        │
│                                      ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────────────┐ │
│  │                         区块链层 (Blockchain Layer)                     │ │
│  │                                                                          │ │
│  │  ┌──────────────────────────┐  ┌──────────────────────────────────┐     │ │
│  │  │      Ethereum L2         │  │           BSV区块链              │     │ │
│  │  │      (机侧共识)           │  │           (天侧存储)              │     │ │
│  │  │  - AgentRegistry        │  │  - Metanet协议                  │     │ │
│  │  │  - PhiStaking            │  │  - 微支付通道                   │     │ │
│  │  │  - Governance            │  │  - SPV验证                      │     │ │
│  │  └──────────────────────────┘  └──────────────────────────────────┘     │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 三层架构详解

#### 人侧（用户层）

人侧是用户与系统交互的入口，主要由Yandex浏览器扩展和Web应用组成。

**核心能力**：
- 本地Φ计算引擎（WebAssembly）
- 无感DID生成与管理
- 隐私保护（P2P通信）
- 离线功能支持

**技术实现**：
```typescript
// 本地Φ计算引擎接口
interface LocalPhiEngine {
  calculatePhi(interactionData: InteractionData): Promise<PhiResult>;
  verifyCredential(vc: VerifiableCredential): Promise<boolean>;
  signData(data: string): Promise<string>;
}
```

#### 机侧（共识层）

机侧是系统的共识和治理核心，构建在Ethereum L2之上。

**核心合约**：
- AgentRegistry：Agent注册与管理
- PhiStaking：Φ代币质押与投票
- Governance：链上治理机制
- ZKVerifier：零知识证明验证

**架构特点**：
- EVM兼容（使用Optimism/Arbitrum）
- 低Gas费用
- 成熟的开发者生态

#### 天侧（存储层）

天侧负责永久存储和数据确权，构建在BSV区块链之上。

**核心协议**：
- Metanet协议：结构化数据上链
- 微支付通道：即时小额支付
- SPV验证：轻节点安全验证

### 2.3 模块依赖关系

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              模块依赖图                                       │
└─────────────────────────────────────────────────────────────────────────────┘

                          ┌───────────────┐
                          │   前端 (Web)   │
                          └───────┬───────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              核心服务层                                       │
│  ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐   │
│  │ 认证服务│───→│DID服务  │    │内容服务 │    │治理服务 │    │支付服务 │   │
│  └────┬────┘    └────┬────┘    └────┬────┘    └────┬────┘    └────┬────┘   │
│       │              │              │              │              │         │
│       └──────────────┴──────────────┴──────────────┴──────────────┘         │
│                                      │                                       │
│                                      ▼                                       │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                           Φ计算引擎                                   │    │
│  │   - 本地WASM计算  - 后端GPU加速  - 实时评估  - 历史趋势               │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              区块链层                                        │
│                                                                              │
│  ┌─────────────────────────────────┐  ┌─────────────────────────────────┐   │
│  │      Ethereum L2 (机侧)         │  │       BSV区块链 (天侧)          │   │
│  │                                 │  │                                 │   │
│  │  ┌─────────┐ ┌─────────┐       │  │  ┌─────────┐ ┌─────────┐        │   │
│  │  │智能合约│ │代币合约│       │  │  │Metanet │ │微支付  │        │   │
│  │  └─────────┘ └─────────┘       │  │  └─────────┘ └─────────┘        │   │
│  └─────────────────────────────────┘  └─────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              数据存储层                                      │
│  ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐    │
│  │PostgreSQL│   │  Redis  │    │TimescaleDB│  │  IPFS  │    │ S3/OSS │    │
│  │ 关系数据  │    │ 缓存/队列 │    │ 时序数据  │    │  冷存储  │    │ 大文件  │    │
│  └─────────┘    └─────────┘    └─────────┘    └─────────┘    └─────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. 核心模块设计

### 3.1 DID身份管理模块

#### 3.1.1 设计概述

DID（Decentralized Identifier）是AgentWeb系统的身份基础，提供用户自主控制的数字身份。

#### 3.1.2 架构设计

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            DID管理架构                                       │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   客户端SDK     │     │   DID服务       │     │   区块链        │
│                 │     │                 │     │                 │
│ - DID创建       │────→│ - DID生成       │────→│ - DID Registry  │
│ - 签名/验证     │←────│ - 文档解析      │←────│ - 链上锚定      │
│ - VC管理        │     │ - 凭证管理      │     │                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘
        │                       │
        │                       │
        ▼                       ▼
┌─────────────────┐     ┌─────────────────┐
│   本地存储      │     │   PostgreSQL    │
│   (加密)        │     │   (缓存)        │
└─────────────────┘     └─────────────────┘
```

#### 3.1.3 核心算法

**DID生成算法**：

```typescript
// DID生成使用Ed25519密钥对
class DIDGenerator {
  async generate(): Promise<DIDResult> {
    // 1. 生成设备指纹
    const deviceFingerprint = await this.collectDeviceFingerprint();
    
    // 2. 生成加密随机数
    const entropy = await this.generateSecureEntropy();
    
    // 3. 派生种子
    const seed = crypto.createHash('sha256')
      .update(deviceFingerprint + entropy)
      .digest();
    
    // 4. 生成密钥对
    const keyPair = await this.generateKeyPair(seed);
    
    // 5. 生成DID
    const did = this.encodeDID(keyPair.publicKey);
    
    // 6. 生成DID Document
    const document = this.createDIDDocument(did, keyPair);
    
    return { did, document, keyPair };
  }
  
  private encodeDID(publicKey: Buffer): string {
    // 使用base58编码
    const encoded = base58_encode(publicKey);
    return `did:agentweb:${encoded}`;
  }
}
```

**无感认证流程**：

```typescript
interface DIDAuthProtocol {
  // 1. 客户端发起认证请求
  async authenticate(): Promise<AuthChallenge> {
    const challenge = crypto.randomBytes(32);
    const sessionId = await this.createSession();
    
    return {
      sessionId,
      challenge: challenge.toString('base64'),
      expiresAt: Date.now() + 5 * 60 * 1000 // 5分钟有效期
    };
  }
  
  // 2. 客户端签名挑战
  async signChallenge(challenge: string, keyId: string): Promise<string> {
    const privateKey = await this.getPrivateKey(keyId);
    const signature = await crypto.sign(
      'Ed25519',
      Buffer.from(challenge),
      privateKey
    );
    return signature.toString('base64');
  }
  
  // 3. 服务端验证签名
  async verify(
    challenge: string,
    signature: string,
    did: string
  ): Promise<boolean> {
    const document = await this.resolveDID(did);
    const publicKey = document.verificationMethod[0].publicKeyJwk;
    
    return crypto.verify(
      'Ed25519',
      Buffer.from(challenge),
      publicKey,
      Buffer.from(signature, 'base64')
    );
  }
}
```

#### 3.1.4 数据结构

```typescript
// DID Document (W3C标准)
interface DIDDocument {
  '@context': [
    'https://www.w3.org/ns/did/v1',
    'https://w3id.org/security/v1'
  ];
  id: string;                    // DID标识符
  verificationMethod: VerificationMethod[];
  authentication: string[];       // 认证方法
  assertionMethod: string[];      // 断言方法
  capabilityInvocation: string[]; // 授权调用
  capabilityDelegation: string[]; // 授权委托
  service: ServiceEndpoint[];     // 服务端点
  created: string;                // 创建时间
  updated: string;               // 更新时间
}

interface VerificationMethod {
  id: string;
  type: 'Ed25519VerificationKey2018' | 'EcdsaSecp256k1VerificationKey2019';
  controller: string;
  publicKeyJwk?: JsonWebKey;
  publicKeyMultibase?: string;
}

interface ServiceEndpoint {
  id: string;
  type: string;
  serviceEndpoint: string | Url | DIDCommEndpoint;
}
```

### 3.2 Φ值计算引擎模块

#### 3.2.1 设计概述

Φ值是AgentWeb系统的核心价值度量指标，基于整合信息理论（IIT）计算。

#### 3.2.2 架构设计

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          Φ计算引擎架构                                       │
└─────────────────────────────────────────────────────────────────────────────┘

┌───────────────────────────────────────────────────────────────────────────┐
│                              Φ计算调度层                                   │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                        PhiOrchestrator                               │   │
│  │   - 请求路由    - 负载均衡    - 结果缓存    - 监控告警              │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└───────────────────────────────────────────────────────────────────────────┘
                    │                               │
                    ▼                               ▼
┌─────────────────────────────┐     ┌─────────────────────────────┐
│      本地计算 (WASM)         │     │       云端计算 (GPU)        │
│                             │     │                             │
│  ┌─────────────────────┐   │     │  ┌─────────────────────┐     │
│  │  phi_calc.wasm      │   │     │  │  Φ计算服务集群      │     │
│  │  - Rust实现         │   │     │  │  - FastAPI服务     │     │
│  │  - Web Worker       │   │     │  │  - NumPy/SciPy    │     │
│  │  - 实时计算         │   │     │  │  - GPU加速         │     │
│  └─────────────────────┘   │     │  └─────────────────────┘     │
│                             │     │                             │
│  适用场景:                   │     │  适用场景:                   │
│  - 轻量级计算                │     │  - 批量计算                  │
│  - 离线计算                  │     │  - 深度分析                  │
│  - 用户端实时反馈            │     │  - 模型训练                  │
└─────────────────────────────┘     └─────────────────────────────┘
```

#### 3.2.3 Φ计算算法

**核心公式**：

```
Φ = ∫₀ᵀ ∫ₓ I(x,t) dx dt

其中：
- Φ: 整合信息值
- T: 时间范围
- x: 状态空间
- I(x,t): 互信息密度函数
```

**实现算法**：

```python
class PhiCalculator:
    """
    Φ值计算器
    
    使用多种算法组合实现：
    1. 时间延迟嵌入 (Time-Delay Embedding)
    2. 互信息估计 (Mutual Information Estimation)
    3. 数值积分 (Numerical Integration)
    """
    
    def __init__(
        self,
        embedding_dim: int = 3,
        time_delay: int = 5,
        n_bins: int = 20
    ):
        self.embedding_dim = embedding_dim
        self.time_delay = time_delay
        self.n_bins = n_bins
        
    def calculate(self, time_series: np.ndarray) -> float:
        """
        计算Φ值
        
        Args:
            time_series: 输入时间序列
            
        Returns:
            Φ值
        """
        # 1. 状态空间重构
        phase_space = self._reconstruct_phase_space(time_series)
        
        # 2. 估计概率分布
        prob = self._estimate_probabilities(phase_space)
        
        # 3. 计算互信息
        mi = self._compute_mutual_information(prob)
        
        # 4. 执行双重积分
        phi = self._integrate(mi, time_series)
        
        return phi
    
    def _reconstruct_phase_space(
        self,
        series: np.ndarray
    ) -> np.ndarray:
        """
        相空间重构
        
        使用时间延迟嵌入方法重构相空间
        """
        n = len(series) - (self.embedding_dim - 1) * self.time_delay
        phase_space = np.zeros((n, self.embedding_dim))
        
        for i in range(self.embedding_dim):
            start = i * self.time_delay
            phase_space[:, i] = series[start:start + n]
        
        return phase_space
    
    def _estimate_probabilities(
        self,
        phase_space: np.ndarray
    ) -> np.ndarray:
        """
        概率估计
        
        使用直方图方法估计联合概率分布
        """
        # 归一化
        ps_norm = (phase_space - phase_space.mean(axis=0)) / (
            phase_space.std(axis=0) + 1e-10
        )
        
        # 计算直方图
        hist, _ = np.histogramdd(ps_norm, bins=self.n_bins, density=True)
        
        # 转换为概率
        return hist / (hist.sum() + 1e-10)
    
    def _compute_mutual_information(
        self,
        joint_prob: np.ndarray
    ) -> float:
        """
        互信息计算
        
        I(X;Y) = Σ P(x,y) log(P(x,y) / (P(x)P(y)))
        """
        # 边际概率
        p_x = joint_prob.sum(axis=1)
        p_y = joint_prob.sum(axis=0)
        
        # 避免除零
        joint_prob = np.maximum(joint_prob, 1e-10)
        p_x = np.maximum(p_x, 1e-10)
        p_y = np.maximum(p_y, 1e-10)
        
        # 计算互信息
        mi = np.sum(
            joint_prob * np.log2(
                joint_prob / np.outer(p_x, p_y)
            )
        )
        
        return mi
    
    def _integrate(
        self,
        mi: float,
        time_series: np.ndarray
    ) -> float:
        """
        数值积分
        
        Φ = ∫₀ᵀ ∫ I(x,t) dx dt
        """
        T = len(time_series)
        
        # 简化的积分计算
        # 实际实现中应使用更精确的数值方法
        phi = mi * T * self.time_delay
        
        return max(0, phi)
```

#### 3.2.4 性能优化

```python
class OptimizedPhiCalculator(PhiCalculator):
    """
    优化版Φ计算器
    
    优化策略:
    1. 向量化计算
    2. GPU加速
    3. 缓存复用
    """
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        
        # 检查GPU可用性
        self.use_gpu = self._check_cupy_available()
        
        if self.use_gpu:
            import cupy as cp
            self.xp = cp
        else:
            self.xp = np
            
    def calculate_batch(
        self,
        time_series_list: List[np.ndarray]
    ) -> List[float]:
        """
        批量计算
        
        使用并行化提升吞吐量
        """
        from concurrent.futures import ThreadPoolExecutor
        
        with ThreadPoolExecutor(max_workers=4) as executor:
            results = list(executor.map(self.calculate, time_series_list))
            
        return results
```

### 3.3 Agent管理模块

#### 3.3.1 设计概述

Agent是系统中提供服务的实体，可以是AI助手、软件机器人或自动化服务。

#### 3.3.2 架构设计

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          Agent管理架构                                       │
└─────────────────────────────────────────────────────────────────────────────┘

┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   开发者     │     │   协议层     │     │   区块链     │
│              │     │              │     │              │
│ - 注册Agent  │────→│ - 验证元数据 │────→│ - AgentRegistry│
│ - 定义能力   │←────│ - 签名验证   │←────│ - 链上记录   │
│ - 监控状态   │     │ - 路由分发   │     │              │
└──────────────┘     └──────────────┘     └──────────────┘
                            │
                            ▼
                    ┌──────────────┐
                    │   执行层     │
                    │              │
                    │ - 能力调用   │
                    │ - 结果返回   │
                    │ - 信誉更新   │
                    └──────────────┘
```

#### 3.3.3 Agent注册流程

```typescript
interface AgentRegistration {
  // 1. 开发者提交注册请求
  async register(params: RegisterParams): Promise<RegisterResult> {
    // 验证参数
    this.validateParams(params);
    
    // 检查名称唯一性
    const exists = await this.checkNameExists(params.name);
    if (exists) {
      throw new Error('Agent name already exists');
    }
    
    // 生成Agent ID
    const agentId = this.generateAgentId(params.owner, params.name);
    
    // 调用合约注册
    const tx = await this.contract.register(
      params.name,
      params.description,
      this.encodeCapabilities(params.capabilities)
    );
    
    // 等待链上确认
    await tx.wait();
    
    // 保存到本地数据库
    await this.saveAgentInfo({
      agentId,
      ...params,
      registeredAt: Date.now(),
      txHash: tx.hash
    });
    
    return { agentId, txHash: tx.hash };
  }
  
  // 2. 调用Agent能力
  async invoke(params: InvokeParams): Promise<InvokeResult> {
    // 验证Agent存在
    const agent = await this.getAgent(params.agentId);
    if (!agent) {
      throw new Error('Agent not found');
    }
    
    // 验证调用权限
    await this.verifyPermissions(params.agentId, params.capabilityId);
    
    // 计算Φ值消耗
    const phiCost = await this.calculatePhiCost(params);
    
    // 检查用户Φ余额
    const userPhi = await this.getUserPhiBalance(params.caller);
    if (userPhi < phiCost) {
      throw new Error('Insufficient Φ balance');
    }
    
    // 执行调用
    const startTime = Date.now();
    const result = await this.executeCapability(agent, params);
    const executionTime = Date.now() - startTime;
    
    // 更新Agent信誉
    await this.updateReputation(params.agentId, result.success);
    
    // 扣除Φ值
    await this.deductPhi(params.caller, phiCost);
    
    // 返回结果
    return {
      result: result.data,
      phiCost,
      executionTime,
      success: result.success
    };
  }
}
```

#### 3.3.4 信誉系统

```typescript
interface ReputationSystem {
  // 信誉评分计算
  calculateReputation(agentId: string): number {
    const stats = this.getAgentStats(agentId);
    
    // 评分公式
    // R = α * success_rate + β * avg_rating + γ * activity - δ * penalty
    
    const successRate = stats.successCount / stats.totalCalls;
    const avgRating = stats.totalRating / stats.ratedCalls;
    const activity = this.calculateActivityScore(stats.lastActiveAt);
    const penalty = this.calculatePenalty(stats);
    
    const reputation =
      0.4 * successRate * 100 +     // 成功率权重40%
      0.3 * avgRating +              // 平均评分权重30%
      0.2 * activity * 100 +         // 活跃度权重20%
      0.1 * stats.stakeAmount / 1000 - // 质押量权重10%
      penalty;                        // 惩罚项
    
    return Math.max(0, Math.min(100, reputation));
  }
  
  // 信誉等级
  getReputationLevel(reputation: number): string {
    if (reputation >= 90) return 'S';
    if (reputation >= 80) return 'A';
    if (reputation >= 70) return 'B';
    if (reputation >= 60) return 'C';
    if (reputation >= 50) return 'D';
    return 'F';
  }
}
```

### 3.4 治理模块

#### 3.4.1 设计概述

治理模块实现去中心化决策机制，允许Φ代币持有者参与平台治理。

#### 3.4.2 治理流程

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            治理流程                                          │
└─────────────────────────────────────────────────────────────────────────────┘

提案创建 ──→ 社区讨论 ──→ 投票期 ──→ 结果计算 ──→ 执行/拒绝

   │                        │
   │                        ▼
   │              ┌─────────────────────┐
   │              │     投票规则         │
   │              │                      │
   │              │ - 投票权重 = f(质押量)│
   │              │ - 通过条件:          │
   │              │   支持票 > 反对票    │
   │              │   且参与率 > 阈值    │
   │              └─────────────────────┘
   │
   ▼
┌─────────────────────┐
│     提案模板        │
│                     │
│ - 标题 (≤100字)    │
│ - 描述 (≤5000字)   │
│ - 执行计划 (JSON)   │
│ - 参数调整建议      │
│ - 影响评估          │
└─────────────────────┘
```

#### 3.4.3 合约实现

```solidity
// Governance.sol
contract Governance {
    // 提案结构
    struct Proposal {
        uint256 id;
        address proposer;
        string title;
        string description;
        bytes calldata;
        ProposalState state;
        uint256 votesFor;
        uint256 votesAgainst;
        uint256 startTime;
        uint256 endTime;
        uint256 quorum;
        mapping(address => bool) hasVoted;
        mapping(address => uint256) voteAmount;
    }
    
    // 提案状态
    enum ProposalState {
        Pending,
        Active,
        Passed,
        Rejected,
        Executed,
        Cancelled
    }
    
    // 参数
    uint256 public votingPeriod = 7 days;
    uint256 public quorumThreshold = 5000000e18; // 500万Φ代币
    uint256 public proposalThreshold = 1000000e18; // 100万Φ代币
    
    // 创建提案
    function createProposal(
        string calldata title,
        string calldata description,
        bytes calldata calldata_
    ) external returns (uint256) {
        require(
            phiToken.balanceOf(msg.sender) >= proposalThreshold,
            "Insufficient Φ to create proposal"
        );
        
        uint256 proposalId = proposalCount++;
        
        Proposal storage proposal = proposals[proposalId];
        proposal.id = proposalId;
        proposal.proposer = msg.sender;
        proposal.title = title;
        proposal.description = description;
        proposal.calldata = calldata_;
        proposal.state = ProposalState.Active;
        proposal.startTime = block.timestamp;
        proposal.endTime = block.timestamp + votingPeriod;
        proposal.quorum = quorumThreshold;
        
        emit ProposalCreated(proposalId, msg.sender, title);
        
        return proposalId;
    }
    
    // 投票
    function castVote(uint256 proposalId, bool support) external {
        Proposal storage proposal = proposals[proposalId];
        
        require(
            proposal.state == ProposalState.Active,
            "Proposal is not active"
        );
        require(
            block.timestamp < proposal.endTime,
            "Voting period has ended"
        );
        require(
            !proposal.hasVoted[msg.sender],
            "Already voted"
        );
        
        uint256 votingPower = phiStaking.getVotingPower(msg.sender);
        require(votingPower > 0, "No voting power");
        
        proposal.hasVoted[msg.sender] = true;
        proposal.voteAmount[msg.sender] = votingPower;
        
        if (support) {
            proposal.votesFor += votingPower;
        } else {
            proposal.votesAgainst += votingPower;
        }
        
        emit VoteCast(proposalId, msg.sender, support, votingPower);
    }
    
    // 执行提案
    function executeProposal(uint256 proposalId) external {
        Proposal storage proposal = proposals[proposalId];
        
        require(
            proposal.state == ProposalState.Passed,
            "Proposal has not passed"
        );
        require(
            block.timestamp >= proposal.endTime,
            "Voting period has not ended"
        );
        
        proposal.state = ProposalState.Executed;
        
        // 执行calldata
        (bool success, ) = address(this).delegatecall(proposal.calldata);
        require(success, "Execution failed");
        
        emit ProposalExecuted(proposalId);
    }
    
    // 计算提案状态
    function updateProposalState(uint256 proposalId) external {
        Proposal storage proposal = proposals[proposalId];
        
        if (proposal.state == ProposalState.Active) {
            if (block.timestamp >= proposal.endTime) {
                // 检查是否通过
                if (proposal.votesFor > proposal.votesAgainst &&
                    (proposal.votesFor + proposal.votesAgainst) >= proposal.quorum) {
                    proposal.state = ProposalState.Passed;
                } else {
                    proposal.state = ProposalState.Rejected;
                }
            }
        }
    }
}
```

---

## 4. 数据模型设计

### 4.1 实体关系图

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           实体关系图                                        │
└─────────────────────────────────────────────────────────────────────────────┘

┌──────────────┐          ┌──────────────┐          ┌──────────────┐
│     User     │          │    DID      │          │      VC      │
│              │ 1──────0  │              │ 1──────*  │              │
│ - id         │          │ - id        │          │ - id         │
│ - email      │          │ - did       │          │ - userId     │
│ - password   │          │ - document  │          │ - issuer     │
│ - phiValue   │          │ - createdAt │          │ - type       │
│ - createdAt  │          └──────────────┘          │ - revoked   │
└──────┬───────┘                                    └──────┬───────┘
       │                                                   │
       │ 1                                                   │ 1
       │                                                     │
       ▼                                                     ▼
┌──────────────┐                                    ┌──────────────┐
│    Agent     │                                    │  NewsContent │
│              │                                    │              │
│ - id         │                                    │ - id         │
│ - userId     │                                    │ - authorId   │
│ - name       │                                    │ - content    │
│ - reputation │                                    │ - phiValue   │
│ - isActive   │                                    │ - bsvTxId    │
└──────┬───────┘                                    └──────┬───────┘
       │                                                   │
       │ *                                                   │ *
       ▼                                                     ▼
┌──────────────┐                                    ┌──────────────┐
│     Task     │                                    │ Interaction  │
│              │                                    │              │
│ - id         │                                    │ - id         │
│ - agentId    │                                    │ - contentId  │
│ - status     │                                    │ - userId     │
│ - result     │                                    │ - type       │
└──────────────┘                                    └──────────────┘

┌──────────────┐          ┌──────────────┐
│   Proposal   │          │     Vote     │
│              │ 1──────*  │              │
│ - id         │          │ - id         │
│ - userId     │          │ - proposalId │
│ - title      │          │ - userId     │
│ - status     │          │ - support    │
│ - votesFor   │          │ - power      │
│ - votesAgainst│          └──────────────┘
└──────────────┘
```

### 4.2 数据库Schema

```prisma
// Prisma Schema定义

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ============ 用户模块 ============

model User {
  id            String    @id @default(uuid())
  email         String    @unique
  password      String    // bcrypt hash
  nickname      String?
  avatar        String?
  did           String?   @unique
  phiValue      Float     @default(0)
  phiLocked     Float     @default(0)  // 锁定的Φ值（质押中）
  role          UserRole  @default(USER)
  status        UserStatus @default(ACTIVE)
  lastLoginAt   DateTime?
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  // 关系
  didDocument   DIDDocument?
  credentials   VerifiableCredential[]
  agents        Agent[]
  proposals     Proposal[]
  votes         Vote[]
  newsContents  NewsContent[]
  interactions  Interaction[]
  phiHistory    PhiHistory[]

  @@index([email])
  @@index([did])
  @@map("users")
}

enum UserRole {
  USER
  ADMIN
  MODERATOR
}

enum UserStatus {
  ACTIVE
  SUSPENDED
  BANNED
}

model DIDDocument {
  id            String    @id @default(uuid())
  did           String    @unique
  document      Json      // W3C DID Document
  privateKey    String?   // 加密存储
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  user          User?     @relation(fields: [userId], references: [id])
  userId        String?   @unique

  @@map("did_documents")
}

model VerifiableCredential {
  id                  String    @id @default(uuid())
  userId              String
  issuer              String
  credentialSchema    String?
  type                String[]
  credentialSubject   Json
  proof               Json
  validFrom           DateTime
  validUntil          DateTime?
  revoked             Boolean   @default(false)
  revokedAt           DateTime?
  createdAt           DateTime  @default(now())

  user                User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([issuer])
  @@map("verifiable_credentials")
}

// ============ Agent模块 ============

model Agent {
  id            String    @id @default(uuid())
  userId        String
  name          String
  description   String?
  capabilities  Json      // 能力列表
  metadata      Json?     // 额外元数据
  reputation    Float     @default(50)
  stakeAmount   Float     @default(0)
  totalCalls    Int       @default(0)
  successCalls  Int       @default(0)
  avgRating     Float     @default(0)
  isActive      Boolean   @default(true)
  registeredAt  DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  user          User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  tasks         Task[]

  @@unique([name])
  @@index([userId])
  @@index([reputation])
  @@map("agents")
}

model Task {
  id            String    @id @default(uuid())
  agentId       String
  callerId      String
  capabilityId  String
  inputData     Json
  outputData    Json?
  phiCost       Float     @default(0)
  status        TaskStatus @default(PENDING)
  errorMessage  String?
  startedAt     DateTime?
  completedAt   DateTime?
  createdAt     DateTime  @default(now())

  agent         Agent     @relation(fields: [agentId], references: [id], onDelete: Cascade)

  @@index([agentId])
  @@index([callerId])
  @@index([status])
  @@map("tasks")
}

enum TaskStatus {
  PENDING
  RUNNING
  COMPLETED
  FAILED
  CANCELLED
}

// ============ 内容模块 ============

model NewsContent {
  id            String    @id @default(uuid())
  authorId      String
  title         String
  content       String
  contentHash   String    @unique  // SHA-256
  phiValue      Float
  phiBreakdown  Json?      // Φ值计算明细
  bsvTxId       String?    // BSV上链交易ID
  metadata      Json?
  status        ContentStatus @default(PUBLISHED)
  viewCount     Int       @default(0)
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  author        User      @relation(fields: [authorId], references: [id], onDelete: Cascade)
  interactions  Interaction[]
  tags          ContentTag[]

  @@index([authorId])
  @@index([phiValue])
  @@index([createdAt])
  @@map("news_contents")
}

enum ContentStatus {
  DRAFT
  PUBLISHED
  HIDDEN
  DELETED
}

model Interaction {
  id            String    @id @default(uuid())
  contentId     String
  userId        String
  type          InteractionType
  data          Json?      // 额外数据（如评论内容）
  createdAt     DateTime  @default(now())

  content       NewsContent @relation(fields: [contentId], references: [id], onDelete: Cascade)
  user          User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([contentId, userId, type])  // 每个用户每种互动只能一次
  @@index([contentId])
  @@index([userId])
  @@map("interactions")
}

enum InteractionType {
  LIKE
  BOOKMARK
  SHARE
  REPORT
}

model ContentTag {
  id            String    @id @default(uuid())
  contentId     String
  tag           String

  content       NewsContent @relation(fields: [contentId], references: [id], onDelete: Cascade)

  @@unique([contentId, tag])
  @@index([tag])
  @@map("content_tags")
}

// ============ 治理模块 ============

model Proposal {
  id            String    @id @default(uuid())
  userId        String
  title         String
  description   String    @db.Text
  calldata      String?   @db.Text
  status        ProposalStatus @default(PENDING)
  votesFor      BigInt    @default(0)
  votesAgainst  BigInt    @default(0)
  quorum        BigInt
  startTime     DateTime
  endTime       DateTime
  executedAt    DateTime?
  createdAt     DateTime  @default(now())

  proposer      User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  votes         Vote[]

  @@index([userId])
  @@index([status])
  @@index([endTime])
  @@map("proposals")
}

enum ProposalStatus {
  PENDING
  ACTIVE
  PASSED
  REJECTED
  EXECUTED
  CANCELLED
}

model Vote {
  id            String    @id @default(uuid())
  proposalId    String
  userId        String
  support       Boolean
  votingPower   BigInt
  createdAt     DateTime  @default(now())

  proposal      Proposal  @relation(fields: [proposalId], references: [id], onDelete: Cascade)
  user          User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([proposalId, userId])
  @@index([proposalId])
  @@index([userId])
  @@map("votes")
}

// ============ Φ值模块 ============

model PhiHistory {
  id            String    @id @default(uuid())
  userId        String
  phiValue      Float     // 变化后的值
  delta         Float     // 变化量
  reason        String    // 变化原因
  source        PhiSource // 来源
  metadata      Json?
  createdAt     DateTime  @default(now())

  user          User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, createdAt])
  @@index([source])
  @@map("phi_history")
}

enum PhiSource {
  CONTENT_REWARD      // 内容奖励
  INTERACTION_REWARD  // 互动奖励
  STAKING_REWARD     // 质押奖励
  GOVERNANCE_REWARD  // 治理奖励
  TASK_PAYMENT       // 任务支付
  TASK_REVENUE       // 任务收入
  SYSTEM_PENALTY     // 系统惩罚
  STAKING_LOCK       // 质押锁定
}

// ============ 支付模块 ============

model Transaction {
  id            String    @id @default(uuid())
  fromUserId    String?
  toUserId      String?
  toAgentId     String?
  type          TransactionType
  amount        Float
  phiAmount     Float
  status        TransactionStatus @default(PENDING)
  txHash        String?   @unique
  metadata      Json?
  createdAt     DateTime  @default(now())
  confirmedAt   DateTime?

  @@index([fromUserId])
  @@index([toUserId])
  @@index([toAgentId])
  @@index([txHash])
  @@map("transactions")
}

enum TransactionType {
  TRANSFER
  STAKING_DEPOSIT
  STAKING_WITHDRAW
  TASK_PAYMENT
  CONTENT_REWARD
  GOVERNANCE_REWARD
  SYSTEM_FEE
}

enum TransactionStatus {
  PENDING
  CONFIRMED
  FAILED
  CANCELLED
}
```

### 4.3 索引设计

```sql
-- 高频查询索引
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_did ON users(did);
CREATE INDEX idx_agents_name ON agents(name);
CREATE INDEX idx_agents_reputation ON agents(reputation DESC);
CREATE INDEX idx_news_contents_phi ON news_contents(phi_value DESC);
CREATE INDEX idx_news_contents_created ON news_contents(created_at DESC);
CREATE INDEX idx_proposals_status ON proposals(status);
CREATE INDEX idx_proposals_end_time ON proposals(end_time);
CREATE INDEX idx_phi_history_user_time ON phi_history(user_id, created_at DESC);

-- 复合索引
CREATE INDEX idx_news_contents_author_created ON news_contents(author_id, created_at DESC);
CREATE INDEX idx_interactions_content_user ON interactions(content_id, user_id);
CREATE INDEX idx_votes_proposal_user ON votes(proposal_id, user_id);
```

---

## 5. API接口设计

### 5.1 API架构

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              API架构                                        │
└─────────────────────────────────────────────────────────────────────────────┘

                          ┌───────────────┐
                          │   API Gateway │
                          │   (Nginx)     │
                          └───────┬───────┘
                                  │
                                  ▼
                    ┌───────────────────────────┐
                    │      认证中间件            │
                    │   JWT验证 / DID Auth      │
                    └─────────────┬─────────────┘
                                  │
        ┌──────────────────────────┼──────────────────────────┐
        │                          │                          │
        ▼                          ▼                          ▼
┌───────────────┐        ┌───────────────┐        ┌───────────────┐
│  Auth API     │        │  DID API      │        │  Content API  │
│  /api/v1/auth │        │  /api/v1/did  │        │  /api/v1/news │
└───────────────┘        └───────────────┘        └───────────────┘
        │                          │                          │
        ▼                          ▼                          ▼
┌───────────────┐        ┌───────────────┐        ┌───────────────┐
│  Agent API    │        │  Phi API      │        │ Governance API│
│  /api/v1/agent│        │  /api/v1/phi  │        │  /api/v1/gov  │
└───────────────┘        └───────────────┘        └───────────────┘
```

### 5.2 API端点规范

#### 基础格式

**请求头**：
```
Content-Type: application/json
Authorization: Bearer <jwt_token>
X-Request-ID: <uuid>
X-API-Version: v1
```

**响应格式**：
```json
// 成功响应
{
  "code": 0,
  "message": "Success",
  "data": { ... },
  "timestamp": "2026-05-18T12:00:00.000Z",
  "requestId": "uuid"
}

// 错误响应
{
  "code": 1001,
  "message": "Invalid parameter",
  "details": { ... },
  "timestamp": "2026-05-18T12:00:00.000Z",
  "requestId": "uuid"
}
```

#### 错误码定义

| 错误码 | 名称 | HTTP状态码 | 描述 |
|--------|------|-----------|------|
| 0 | SUCCESS | 200 | 成功 |
| 1001 | INVALID_PARAM | 400 | 参数错误 |
| 1002 | MISSING_PARAM | 400 | 缺少必填参数 |
| 1003 | INVALID_FORMAT | 400 | 格式错误 |
| 2001 | UNAUTHORIZED | 401 | 未授权 |
| 2002 | TOKEN_EXPIRED | 401 | Token过期 |
| 2003 | FORBIDDEN | 403 | 禁止访问 |
| 3001 | NOT_FOUND | 404 | 资源不存在 |
| 4001 | CONFLICT | 409 | 资源冲突 |
| 5001 | INTERNAL_ERROR | 500 | 服务器内部错误 |
| 5002 | SERVICE_UNAVAILABLE | 503 | 服务不可用 |

### 5.3 核心API接口

#### 5.3.1 认证接口

```yaml
/auth/register:
  post:
    tags:
      - Authentication
    summary: 用户注册
    requestBody:
      required: true
      content:
        application/json:
          schema:
            type: object
            required:
              - email
              - password
            properties:
              email:
                type: string
                format: email
                example: user@example.com
              password:
                type: string
                minLength: 8
                example: securepassword123
              nickname:
                type: string
                example: CryptoUser
    responses:
      '200':
        description: 注册成功
        content:
          application/json:
            schema:
              type: object
              properties:
                code:
                  type: integer
                  example: 0
                data:
                  type: object
                  properties:
                    userId:
                      type: string
                    accessToken:
                      type: string
                    refreshToken:
                      type: string
                    expiresIn:
                      type: integer
                      example: 3600

/auth/login:
  post:
    tags:
      - Authentication
    summary: 用户登录
    requestBody:
      required: true
      content:
        application/json:
          schema:
            type: object
            required:
              - email
              - password
            properties:
              email:
                type: string
                format: email
              password:
                type: string
    responses:
      '200':
        description: 登录成功
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/LoginResponse'

/auth/did-auth:
  post:
    tags:
      - Authentication
    summary: DID无感登录
    description: 使用DID进行无感认证，无需密码
    requestBody:
      required: true
      content:
        application/json:
          schema:
            type: object
            properties:
              challenge:
                type: string
              signature:
                type: string
              did:
                type: string
    responses:
      '200':
        description: 认证成功
```

#### 5.3.2 DID接口

```yaml
/did/create:
  post:
    tags:
      - DID
    summary: 创建DID
    security:
      - BearerAuth: []
    requestBody:
      required: true
      content:
        application/json:
          schema:
            type: object
            properties:
              method:
                type: string
                enum: [agentweb]
                default: agentweb
              options:
                type: object
                properties:
                  useExistingKey:
                    type: boolean
                  keyType:
                    type: string
                    enum: [Ed25519, ECDSA]
    responses:
      '200':
        description: DID创建成功
        content:
          application/json:
            schema:
              type: object
              properties:
                data:
                  type: object
                  properties:
                    did:
                      type: string
                      example: did:agentweb:z6Mkf5r8o...
                    document:
                      type: object
                      description: W3C DID Document
                    privateKeyId:
                      type: string

/did/resolve/{did}:
  get:
    tags:
      - DID
    summary: 解析DID
    parameters:
      - name: did
        in: path
        required: true
        schema:
          type: string
    responses:
      '200':
        description: DID Document
        content:
          application/json:
            schema:
              type: object
              properties:
                data:
                  type: object
                  properties:
                    document:
                      type: object
                    metadata:
                      type: object

/vc/issue:
  post:
    tags:
      - VC
    summary: 签发凭证
    security:
      - BearerAuth: []
    requestBody:
      required: true
      content:
        application/json:
          schema:
            type: object
            required:
              - issuer
              - subject
              - claims
            properties:
              issuer:
                type: string
                description: 签发者DID
              subject:
                type: string
                description: 主题DID
              type:
                type: array
                items:
                  type: string
              claims:
                type: object
              validUntil:
                type: string
                format: date-time
    responses:
      '200':
        description: 凭证签发成功
        content:
          application/json:
            schema:
              type: object
              properties:
                data:
                  type: object
                  properties:
                    credential:
                      type: object
                      description: 可验证凭证
                    txHash:
                      type: string

/vc/verify:
  post:
    tags:
      - VC
    summary: 验证凭证
    requestBody:
      required: true
      content:
        application/json:
          schema:
            type: object
            properties:
              credential:
                type: object
    responses:
      '200':
        description: 验证结果
        content:
          application/json:
            schema:
              type: object
              properties:
                data:
                  type: object
                  properties:
                    valid:
                      type: boolean
                    claims:
                      type: object
                    issuer:
                      type: string
                    validFrom:
                      type: string
                    validUntil:
                      type: string
```

#### 5.3.3 Φ值接口

```yaml
/phi/calculate:
  post:
    tags:
      - Phi
    summary: 计算Φ值
    description: 基于交互数据计算整合信息值
    requestBody:
      required: true
      content:
        application/json:
          schema:
            type: object
            properties:
              interactionData:
                type: object
                properties:
                  userId:
                    type: string
                  contentId:
                    type: string
                  timeSeries:
                    type: array
                    items:
                      type: number
                  events:
                    type: array
                    items:
                      type: object
              contentFeatures:
                type: array
                items:
                  type: number
              mode:
                type: string
                enum: [standard, fast, precise]
                default: standard
    responses:
      '200':
        description: Φ值计算结果
        content:
          application/json:
            schema:
              type: object
              properties:
                data:
                  type: object
                  properties:
                    phiValue:
                      type: number
                      description: 原始Φ值
                    normalizedPhi:
                      type: number
                      description: 归一化Φ值 (0-100)
                    details:
                      type: object

/phi/balance/{userId}:
  get:
    tags:
      - Phi
    summary: 查询用户Φ余额
    parameters:
      - name: userId
        in: path
        required: true
        schema:
          type: string
    responses:
      '200':
        description: Φ余额信息
        content:
          application/json:
            schema:
              type: object
              properties:
                data:
                  type: object
                  properties:
                    available:
                      type: number
                    locked:
                      type: number
                    total:
                      type: number

/phi/history/{userId}:
  get:
    tags:
      - Phi
    summary: 获取Φ历史记录
    parameters:
      - name: userId
        in: path
        required: true
        schema:
          type: string
      - name: page
        in: query
        schema:
          type: integer
          default: 1
      - name: pageSize
        in: query
        schema:
          type: integer
          default: 20
          maximum: 100
      - name: source
        in: query
        schema:
          type: string
          enum: [CONTENT_REWARD, INTERACTION_REWARD, STAKING_REWARD, GOVERNANCE_REWARD, TASK_PAYMENT, TASK_REVENUE, SYSTEM_PENALTY, STAKING_LOCK]
    responses:
      '200':
        description: Φ历史记录列表
```

#### 5.3.4 Agent接口

```yaml
/agent/register:
  post:
    tags:
      - Agent
    summary: 注册Agent
    security:
      - BearerAuth: []
    requestBody:
      required: true
      content:
        application/json:
          schema:
            type: object
            required:
              - name
              - description
              - capabilities
            properties:
              name:
                type: string
                maxLength: 50
              description:
                type: string
                maxLength: 500
              capabilities:
                type: array
                items:
                  type: object
                  properties:
                    id:
                      type: string
                    name:
                      type: string
                    description:
                      type: string
                    endpoint:
                      type: string
                    parameters:
                      type: object
              stakeAmount:
                type: number
                minimum: 0
    responses:
      '200':
        description: Agent注册成功
        content:
          application/json:
            schema:
              type: object
              properties:
                data:
                  type: object
                  properties:
                    agentId:
                      type: string
                    txHash:
                      type: string

/agent/list:
  get:
    tags:
      - Agent
    summary: 获取Agent列表
    parameters:
      - name: page
        in: query
        schema:
          type: integer
      - name: pageSize
        in: query
        schema:
          type: integer
      - name: sortBy
        in: query
        schema:
          type: string
          enum: [reputation, totalCalls, createdAt]
      - name: category
        in: query
        schema:
          type: string
      - name: search
        in: query
        schema:
          type: string
    responses:
      '200':
        description: Agent列表

/agent/{agentId}/invoke:
  post:
    tags:
      - Agent
    summary: 调用Agent能力
    security:
      - BearerAuth: []
    parameters:
      - name: agentId
        in: path
        required: true
        schema:
          type: string
    requestBody:
      required: true
      content:
        application/json:
          schema:
            type: object
            properties:
              capabilityId:
                type: string
              parameters:
                type: object
    responses:
      '200':
        description: 调用结果
```

#### 5.3.5 治理接口

```yaml
/governance/proposals:
  get:
    tags:
      - Governance
    summary: 获取提案列表
    parameters:
      - name: status
        in: query
        schema:
          type: string
          enum: [PENDING, ACTIVE, PASSED, REJECTED, EXECUTED, CANCELLED]
      - name: page
        in: query
        schema:
          type: integer
      - name: pageSize
        in: query
        schema:
          type: integer
    responses:
      '200':
        description: 提案列表

  post:
    tags:
      - Governance
    summary: 创建提案
    security:
      - BearerAuth: []
    requestBody:
      required: true
      content:
        application/json:
          schema:
            type: object
            properties:
              title:
                type: string
              description:
                type: string
              calldata:
                type: string
    responses:
      '200':
        description: 提案创建成功

/governance/proposals/{proposalId}:
  get:
    tags:
      - Governance
    summary: 获取提案详情
    parameters:
      - name: proposalId
        in: path
        required: true
        schema:
          type: string
    responses:
      '200':
        description: 提案详情

/governance/proposals/{proposalId}/vote:
  post:
    tags:
      - Governance
    summary: 投票
    security:
      - BearerAuth: []
    parameters:
      - name: proposalId
        in: path
        required: true
        schema:
          type: string
    requestBody:
      required: true
      content:
        application/json:
          schema:
            type: object
            properties:
              support:
                type: boolean
    responses:
      '200':
        description: 投票成功
```

---

## 6. 安全设计

### 6.1 安全架构

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              安全架构                                        │
└─────────────────────────────────────────────────────────────────────────────┘

┌───────────────────────────────────────────────────────────────────────────┐
│                            身份认证层                                      │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐         │
│  │ JWT认证 │  │DID Auth│  │OAuth2.0 │  │API Key  │  │生物特征 │         │
│  └─────────┘  └─────────┘  └─────────┘  └─────────┘  └─────────┘         │
└───────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌───────────────────────────────────────────────────────────────────────────┐
│                            授权控制层                                      │
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │                        RBAC + ABAC                                   │ │
│  │   - 角色权限    - 属性策略    - 资源隔离    - 最小权限                │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌───────────────────────────────────────────────────────────────────────────┐
│                            数据安全层                                      │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐         │
│  │传输加密 │  │存储加密 │  │数据脱敏 │  │完整性校验│  │隐私计算 │         │
│  │TLS 1.3 │  │AES-256 │  │K-匿名化 │  │HMAC/SHA │  │零知识证明│         │
│  └─────────┘  └─────────┘  └─────────┘  └─────────┘  └─────────┘         │
└───────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌───────────────────────────────────────────────────────────────────────────┐
│                            应用安全层                                      │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐         │
│  │输入验证 │  │SQL注入防│  │XSS防护  │  │CSRF防护 │  │限流熔断 │         │
│  │Zod/Joi │  │ORM转义 │  │CSP头    │  │Token验证│  │RateLimit│         │
│  └─────────┘  └─────────┘  └─────────┘  └─────────┘  └─────────┘         │
└───────────────────────────────────────────────────────────────────────────┘
```

### 6.2 身份认证设计

#### 6.2.1 多因素认证

```typescript
interface MFAService {
  // 启用MFA
  async enableMFA(userId: string, method: MFAMethod): Promise<MFASetup> {
    switch (method) {
      case 'totp':
        return this.setupTOTP(userId);
      case 'sms':
        return this.setupSMS(userId);
      case 'webauthn':
        return this.setupWebAuthn(userId);
      default:
        throw new Error('Unsupported MFA method');
    }
  }
  
  // TOTP设置
  private async setupTOTP(userId: string): Promise<MFASetup> {
    const secret = crypto.randomBytes(20);
    const otpauth = otplib.authenticator.keyuri(
      userId,
      'AgentWeb',
      secret.toString('base32')
    );
    
    // 保存加密的secret
    await this.saveMFASecret(userId, {
      method: 'totp',
      secret: this.encrypt(secret),
      enabled: false
    });
    
    return {
      method: 'totp',
      qrCode: await this.generateQRCode(otpauth),
      manualKey: secret.toString('base32')
    };
  }
  
  // 验证MFA
  async verifyMFA(userId: string, token: string): Promise<boolean> {
    const mfa = await this.getMFASecret(userId);
    if (!mfa || !mfa.enabled) {
      return true; // 未启用MFA
    }
    
    switch (mfa.method) {
      case 'totp':
        return otplib.authenticator.verify({
          token,
          secret: this.decrypt(mfa.secret)
        });
      case 'webauthn':
        return this.verifyWebAuthnAssertion(userId, token);
      default:
        return false;
    }
  }
}
```

#### 6.2.2 DID认证协议

```typescript
interface DIDAuthProtocol {
  // 1. 服务端生成挑战
  generateChallenge(): AuthChallenge {
    return {
      challenge: crypto.randomBytes(32).toString('base64'),
      nonce: crypto.randomBytes(16).toString('hex'),
      expiresAt: Date.now() + 5 * 60 * 1000, // 5分钟
      audience: 'https://agentweb.io'
    };
  }
  
  // 2. 客户端构建认证响应
  async buildAuthResponse(
    did: string,
    challenge: AuthChallenge
  ): Promise<AuthResponse> {
    // 获取DID Document
    const doc = await this.resolveDID(did);
    
    // 选择认证方法
    const authMethod = doc.authentication[0];
    
    // 签名挑战
    const dataToSign = JSON.stringify({
      challenge: challenge.challenge,
      nonce: challenge.nonce,
      audience: challenge.audience,
      timestamp: Date.now()
    });
    
    const signature = await this.sign(dataToSign, authMethod);
    
    return {
      did,
      challenge: challenge.challenge,
      nonce: challenge.nonce,
      signature,
      proofPurpose: 'authentication'
    };
  }
  
  // 3. 服务端验证
  async verifyAuthResponse(
    response: AuthResponse
  ): Promise<AuthResult> {
    // 验证DID
    const doc = await this.resolveDID(response.did);
    
    // 验证签名
    const isValid = await this.verifySignature(
      response.signature,
      doc,
      response.proofPurpose
    );
    
    if (!isValid) {
      return { valid: false, error: 'Invalid signature' };
    }
    
    // 验证nonce未被使用（防重放）
    if (await this.isNonceUsed(response.nonce)) {
      return { valid: false, error: 'Replay attack detected' };
    }
    
    // 标记nonce已使用
    await this.markNonceUsed(response.nonce);
    
    // 生成会话Token
    const token = this.generateSessionToken(response.did);
    
    return { valid: true, token, did: response.did };
  }
}
```

### 6.3 数据安全设计

#### 6.3.1 加密策略

```typescript
class EncryptionService {
  // 数据加密密钥管理
  private masterKey: Buffer;  // 主密钥（从KMS获取）
  private dataKey: Buffer;    // 数据加密密钥
  
  // 初始化
  async initialize(): Promise<void> {
    // 从KMS获取主密钥
    this.masterKey = await this.kms.getMasterKey();
    
    // 派生数据密钥
    this.dataKey = crypto.pbkdf2Sync(
      this.masterKey,
      'agentweb-salt',
      100000,
      32,
      'sha256'
    );
  }
  
  // 加密数据
  encrypt(plaintext: string): EncryptedData {
    // 生成随机IV
    const iv = crypto.randomBytes(16);
    
    // AES-256-GCM加密
    const cipher = crypto.createCipheriv('aes-256-gcm', this.dataKey, iv);
    
    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    return {
      iv: iv.toString('hex'),
      ciphertext: encrypted,
      authTag: authTag.toString('hex'),
      algorithm: 'AES-256-GCM'
    };
  }
  
  // 解密数据
  decrypt(data: EncryptedData): string {
    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      this.dataKey,
      Buffer.from(data.iv, 'hex')
    );
    
    decipher.setAuthTag(Buffer.from(data.authTag, 'hex'));
    
    let decrypted = decipher.update(data.ciphertext, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }
  
  // 私钥加密存储
  async encryptPrivateKey(privateKey: Buffer, userId: string): Promise<string> {
    // 生成用户专属密钥
    const userKey = await this.deriveUserKey(userId);
    
    // 加密私钥
    const encrypted = crypto.pbkdf2Sync(
      privateKey,
      userKey,
      100000,
      32,
      'sha256'
    );
    
    return encrypted.toString('hex');
  }
}
```

#### 6.3.2 隐私保护

```typescript
class PrivacyService {
  // K-匿名化
  kAnonymize(data: any[], quasiIdentifiers: string[], k: number = 5): any[] {
    const groups = this.groupByQuasiIdentifiers(data, quasiIdentifiers);
    
    return Object.values(groups)
      .filter(group => group.length >= k)
      .flat();
  }
  
  // 差分隐私
  addLaplaceNoise(value: number, epsilon: number, sensitivity: number): number {
    const scale = sensitivity / epsilon;
    const noise = this.sampleLaplace(scale);
    return value + noise;
  }
  
  // 零知识证明（简化示例）
  async generateZKProof(
    witness: any,
    statement: any
  ): Promise<ZKProof> {
    // 使用 snarkjs 或 circom 生成的证明
    const { proof, publicSignals } = await this.zkCircuit.generateProof({
      witness,
      public: statement
    });
    
    return { proof, publicSignals };
  }
  
  async verifyZKProof(
    proof: ZKProof,
    verificationKey: any
  ): Promise<boolean> {
    return this.zkCircuit.verifyProof(verificationKey, proof);
  }
}
```

### 6.4 API安全设计

```typescript
// 安全中间件
class SecurityMiddleware {
  // Helmet安全头
  helmet = helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'nonce-{NONCE}'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'", "wss:", "https:"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"]
      }
    },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true
    },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
  });
  
  // CORS配置
  cors = cors({
    origin: process.env.ALLOWED_ORIGINS?.split(','),
    credentials: true,
    maxAge: 86400
  });
  
  // 请求限流
  rateLimit = rateLimit({
    windowMs: 15 * 60 * 1000, // 15分钟
    max: 100, // 每个IP限制100次
    message: {
      code: 3001,
      message: '请求过于频繁，请稍后再试'
    },
    standardHeaders: true,
    legacyHeaders: false
  });
  
  // 输入验证
  inputValidation = (schema: ZodSchema) => {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        req.body = await schema.parseAsync(req.body);
        next();
      } catch (error) {
        next(new AppError(1001, '参数验证失败', error));
      }
    };
  };
  
  // CSRF防护
  csrfProtection = (req: Request, res: Response, next: NextFunction) => {
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      return next();
    }
    
    const csrfToken = req.headers['x-csrf-token'];
    const sessionToken = req.session?.csrfToken;
    
    if (!csrfToken || csrfToken !== sessionToken) {
      return next(new AppError(2003, 'CSRF验证失败'));
    }
    
    next();
  };
}
```

---

## 7. 性能优化设计

### 7.1 性能目标

| 指标 | 当前目标 | 终极目标 |
|------|----------|----------|
| TPS | 10,000+ | 1,000,000+ |
| API延迟 (P99) | < 100ms | < 10ms |
| Φ计算延迟 | < 500ms | < 50ms |
| 前端加载时间 | < 2s | < 500ms |
| 可用性 | 99.9% | 99.99% |

### 7.2 前端性能优化

```typescript
// 1. 代码分割
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Identity = lazy(() => import('./pages/Identity'));

// 2. 资源预加载
const prefetchAssets = () => {
  // 预加载关键资源
  const criticalAssets = [
    '/fonts/main.woff2',
    '/icons/sprite.svg'
  ];
  
  criticalAssets.forEach(href => {
    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = 'font'; // 或 'image', 'script'
    link.href = href;
    document.head.appendChild(link);
  });
};

// 3. 服务端渲染
// pages/_document.tsx
class MyDocument extends Document {
  render() {
    return (
      <Html>
        <Head>
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link rel="dns-prefetch" href="https://api.agentweb.io" />
        </Head>
        <body>
          <Main />
          <NextScript />
        </body>
      </Html>
    );
  }
}

// 4. 缓存策略
// next.config.js
module.exports = {
  headers: async () => [
    {
      source: '/static/(.*)',
      headers: [
        { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }
      ]
    },
    {
      source: '/(.*)',
      headers: [
        { key: 'Cache-Control', value: 'no-cache' }
      ]
    }
  ]
};
```

### 7.3 后端性能优化

```typescript
// 1. 数据库查询优化
class OptimizedQuery {
  // 使用SELECT N+1避免
  async getUsersWithAgents(): Promise<User[]> {
    return this.prisma.user.findMany({
      include: {
        agents: true,  // Prisma自动JOIN
        credentials: {
          where: { revoked: false }  // 提前过滤
        }
      }
    });
  }
  
  // 分页查询
  async getPaginatedContents(page: number, pageSize: number) {
    const [contents, total] = await Promise.all([
      this.prisma.newsContent.findMany({
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: { author: { select: { id: true, nickname: true } } }
      }),
      this.prisma.newsContent.count()
    ]);
    
    return { contents, total, page, pageSize };
  }
  
  // 索引优化查询
  async searchContents(query: string) {
    return this.prisma.newsContent.findMany({
      where: {
        OR: [
          { title: { search: query } },      // 全文搜索
          { content: { search: query } }
        ]
      },
      orderBy: { phiValue: 'desc' }  // 使用索引
    });
  }
}

// 2. 缓存策略
class CacheService {
  private redis: Redis;
  
  // 多级缓存
  async get<T>(key: string): Promise<T | null> {
    // L1: 进程内缓存
    const l1 = this.l1Cache.get(key);
    if (l1) return l1;
    
    // L2: Redis缓存
    const l2 = await this.redis.get(key);
    if (l2) {
      this.l1Cache.set(key, JSON.parse(l2));
      return JSON.parse(l2);
    }
    
    // L3: 数据库
    const data = await this.db.query(key);
    if (data) {
      await this.redis.setex(key, 3600, JSON.stringify(data));
      this.l1Cache.set(key, data);
    }
    
    return data;
  }
  
  // 缓存失效
  async invalidate(pattern: string): Promise<void> {
    const keys = await this.redis.keys(pattern);
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
    this.l1Cache.clear();
  }
}

// 3. 连接池优化
const dbPool = new Pool({
  max: 20,           // 最大连接数
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// 4. 批处理
async function batchProcess(items: any[], batchSize: number = 100) {
  const results = [];
  
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map(item => processItem(item))
    );
    results.push(...batchResults);
  }
  
  return results;
}
```

### 7.4 Φ计算性能优化

```python
# 1. 向量化计算
class VectorizedPhiCalculator:
    def calculate_batch(self, time_series_list: List[np.ndarray]) -> np.ndarray:
        """
        使用向量化计算提升批量处理性能
        """
        # 将所有时间序列padding到相同长度
        max_len = max(len(ts) for ts in time_series_list)
        padded = np.zeros((len(time_series_list), max_len))
        
        for i, ts in enumerate(time_series_list):
            padded[i, :len(ts)] = ts
        
        # 批量计算相空间重构
        phase_spaces = self._batch_phase_reconstruction(padded)
        
        # 批量计算互信息
        mi_values = self._batch_mutual_information(phase_spaces)
        
        return mi_values
    
    def _batch_phase_reconstruction(self, data: np.ndarray) -> np.ndarray:
        """批量相空间重构"""
        # 使用广播和滑动窗口实现向量化
        n_samples, n_points = data.shape
        dim, delay = self.embedding_dim, self.time_delay
        
        output_len = n_points - (dim - 1) * delay
        result = np.zeros((n_samples, output_len, dim))
        
        for d in range(dim):
            result[:, :, d] = data[:, d*delay:d*delay + output_len]
        
        return result

# 2. GPU加速
class GPUPhiCalculator:
    def __init__(self):
        try:
            import cupy as cp
            self.xp = cp
            self.use_gpu = True
        except ImportError:
            self.xp = np
            self.use_gpu = False
    
    def calculate(self, time_series: np.ndarray) -> float:
        if self.use_gpu:
            # 移动到GPU
            ts = self.xp.asarray(time_series)
            # GPU计算
            result = self._gpu_phase_reconstruction(ts)
            result = self._gpu_mutual_information(result)
            # 移回CPU
            return float(self.xp.asnumpy(result))
        else:
            # CPU回退
            return super().calculate(time_series)
```

---

## 8. 部署架构设计

### 8.1 部署架构总览

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          部署架构                                          │
└─────────────────────────────────────────────────────────────────────────────┘

┌───────────────────────────────────────────────────────────────────────────┐
│                              全球边缘节点                                    │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐          │
│  │ Asia    │  │ Europe  │  │   US    │  │   US    │  │ Oceania │          │
│  │ Tokyo   │  │Frankfurt│  │ Virginia│  │ Oregon  │  │ Sydney  │          │
│  └─────────┘  └─────────┘  └─────────┘  └─────────┘  └─────────┘          │
│       │            │            │            │            │                 │
│       └────────────┴────────────┴────────────┴────────────┘                 │
│                              CDN (Cloudflare/AWS CloudFront)                │
└───────────────────────────────────────────────────────────────────────────┘
                                      │
                                      │ 静态资源
                                      ▼
┌───────────────────────────────────────────────────────────────────────────┐
│                              负载均衡层                                     │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │               Global Load Balancer (AWS ALB / Cloudflare)            │  │
│  │   - SSL Termination  - Health Check  - Geographic Routing          │  │
│  └─────────────────────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────────────────────┘
                                      │
        ┌─────────────────────────────┼─────────────────────────────┐
        │                             │                             │
        ▼                             ▼                             ▼
┌───────────────┐          ┌───────────────┐          ┌───────────────┐
│  Kubernetes   │          │  Kubernetes   │          │  Kubernetes   │
│  Cluster (AZ) │          │ Cluster (EU)  │          │ Cluster (US)  │
│               │          │               │          │               │
│ ┌───────────┐ │          │ ┌───────────┐ │          │ ┌───────────┐ │
│ │Frontend   │ │          │ │Frontend   │ │          │ │Frontend   │ │
│ │Deployment │ │          │ │Deployment │ │          │ │Deployment │ │
│ └───────────┘ │          │ └───────────┘ │          │ └───────────┘ │
│ ┌───────────┐ │          │ ┌───────────┐ │          │ ┌───────────┐ │
│ │Backend    │ │          │ │Backend    │ │          │ │Backend    │ │
│ │Deployment │ │          │ │Deployment │ │          │ │Deployment │ │
│ └───────────┘ │          │ └───────────┘ │          │ └───────────┘ │
│ ┌───────────┐ │          │ ┌───────────┐ │          │ ┌───────────┐ │
│ │Phi Engine │ │          │ │Phi Engine │ │          │ │Phi Engine │ │
│ │Deployment │ │          │ │Deployment │ │          │ │Deployment │ │
│ └───────────┘ │          │ └───────────┘ │          │ └───────────┘ │
└───────────────┘          └───────────────┘          └───────────────┘
        │                             │                             │
        └─────────────────────────────┴─────────────────────────────┘
                                      │
                    ┌─────────────────┼─────────────────┐
                    │                 │                 │
                    ▼                 ▼                 ▼
          ┌───────────────┐   ┌───────────────┐   ┌───────────────┐
          │ PostgreSQL   │   │    Redis      │   │   IPFS/S3     │
          │ Master-Slave │   │    Cluster    │   │   Storage     │
          └───────────────┘   └───────────────┘   └───────────────┘
```

### 8.2 Kubernetes配置

```yaml
# frontend-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: agentweb-frontend
  namespace: agentweb
spec:
  replicas: 3
  selector:
    matchLabels:
      app: frontend
  template:
    metadata:
      labels:
        app: frontend
    spec:
      containers:
        - name: frontend
          image: agentweb/frontend:latest
          ports:
            - containerPort: 5173
          resources:
            requests:
              cpu: 100m
              memory: 256Mi
            limits:
              cpu: 500m
              memory: 512Mi
          env:
            - name: VITE_API_URL
              valueFrom:
                configMapKeyRef:
                  name: agentweb-config
                  key: api_url
          readinessProbe:
            httpGet:
              path: /health
              port: 5173
            initialDelaySeconds: 10
            periodSeconds: 5
          livenessProbe:
            httpGet:
              path: /health
              port: 5173
            initialDelaySeconds: 30
            periodSeconds: 10

---
# backend-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: agentweb-backend
  namespace: agentweb
spec:
  replicas: 5
  selector:
    matchLabels:
      app: backend
  template:
    metadata:
      labels:
        app: backend
    spec:
      containers:
        - name: backend
          image: agentweb/backend:latest
          ports:
            - containerPort: 3000
          resources:
            requests:
              cpu: 500m
              memory: 512Mi
            limits:
              cpu: 2000m
              memory: 2Gi
          env:
            - name: DATABASE_URL
              valueFrom:
                secretKeyRef:
                  name: agentweb-secrets
                  key: database_url
            - name: REDIS_URL
              valueFrom:
                secretKeyRef:
                  name: agentweb-secrets
                  key: redis_url
          envFrom:
            - configMapRef:
                name: agentweb-config

---
# HorizontalPodAutoscaler
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: agentweb-backend-hpa
  namespace: agentweb
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: agentweb-backend
  minReplicas: 3
  maxReplicas: 20
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
    - type: Resource
      resource:
        name: memory
        target:
          type: Utilization
          averageUtilization: 80
```

### 8.3 CI/CD流程

```yaml
# .github/workflows/deploy.yaml
name: Deploy to Production

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          
      - name: Install dependencies
        run: npm ci
        
      - name: Run tests
        run: npm test -- --coverage
        
      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/lcov.info
          
  build:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          
      - name: Build Docker images
        run: |
          docker build -t agentweb/frontend:${{ github.sha }} ./frontend
          docker build -t agentweb/backend:${{ github.sha }} ./backend
          docker build -t agentweb/phi-engine:${{ github.sha }} ./phi-engine
          
      - name: Push to Registry
        run: |
          echo ${{ secrets.DOCKER_TOKEN }} | docker login -u ${{ secrets.DOCKER_USER }} --password-stdin
          docker push agentweb/frontend:${{ github.sha }}
          docker push agentweb/backend:${{ github.sha }}
          docker push agentweb/phi-engine:${{ github.sha }}
          
      - name: Deploy to Kubernetes
        uses: azure/k8s-deploy@v4
        with:
          namespace: agentweb
          manifests: |
            k8s/frontend-deployment.yaml
            k8s/backend-deployment.yaml
            k8s/phi-engine-deployment.yaml
          images: |
            agentweb/frontend:${{ github.sha }}
            agentweb/backend:${{ github.sha }}
            agentweb/phi-engine:${{ github.sha }}
```

---

## 9. 技术选型依据

### 9.1 前端技术栈

| 技术 | 选择 | 理由 |
|------|------|------|
| React 18 | ⭐⭐⭐⭐⭐ | 生态丰富、Hooks完善、社区活跃 |
| TypeScript | ⭐⭐⭐⭐⭐ | 类型安全、IDE支持、降低错误率 |
| Vite | ⭐⭐⭐⭐⭐ | 极速HMR、现代化构建、插件丰富 |
| Zustand | ⭐⭐⭐⭐ | 轻量级、Hooks原生、性能优秀 |
| ECharts | ⭐⭐⭐⭐ | 图表丰富、性能好、文档完善 |

### 9.2 后端技术栈

| 技术 | 选择 | 理由 |
|------|------|------|
| Node.js 20 | ⭐⭐⭐⭐ | 前后端统一、高并发、性能优秀 |
| Express | ⭐⭐⭐⭐ | 轻量灵活、中间件丰富、稳定 |
| Prisma | ⭐⭐⭐⭐⭐ | 类型安全、自动迁移、开发效率高 |
| Redis | ⭐⭐⭐⭐⭐ | 高性能、丰富数据结构、持久化支持 |

### 9.3 区块链技术栈

| 技术 | 选择 | 理由 |
|------|------|------|
| Optimism | ⭐⭐⭐⭐⭐ | EVM兼容、低Gas、生态成熟 |
| Hardhat | ⭐⭐⭐⭐⭐ | 开发体验好、插件丰富、调试能力强 |
| BSV | ⭐⭐⭐⭐ | 高TPS、低费用、Metanet协议 |

### 9.4 Φ计算技术栈

| 技术 | 选择 | 理由 |
|------|------|------|
| Python 3.11 | ⭐⭐⭐⭐⭐ | 科学计算生态、NumPy/SciPy |
| FastAPI | ⭐⭐⭐⭐⭐ | 异步高性能、自动文档、类型验证 |
| NumPy/SciPy | ⭐⭐⭐⭐⭐ | 向量化计算、数值分析 |
| Rust (WASM) | ⭐⭐⭐⭐ | 性能极致、安全性、跨平台 |

---

## 10. 未来演进规划

### 10.1 短期规划（3-6个月）

- [ ] 完成MVP功能（DID、Φ值、Agent、治理）
- [ ] 测试网部署和社区测试
- [ ] 安全审计和漏洞修复
- [ ] 性能优化和压力测试

### 10.2 中期规划（6-12个月）

- [ ] 主网上线
- [ ] Φ值算法优化
- [ ] 虚时演化共识实现
- [ ] 移动端应用开发

### 10.3 长期规划（1-3年）

- [ ] 全息边界存储系统
- [ ] 跨链互操作
- [ ] 去中心化治理升级
- [ ] AI能力深度集成

---

## 附录

### A. 参考资料

1. W3C DID Core Specification
2. W3C Verifiable Credentials Data Model 1.1
3. IIT 4.0 - Integrated Information Theory
4. HotStuff: BFT Consensus with Linearity and Responsiveness
5. Metanet Protocol Whitepaper
6. Optimism Bedrock Architecture

### B. 术语表

| 术语 | 定义 |
|------|------|
| Φ值 | 整合信息值，衡量信息整合程度 |
| DID | 去中心化标识符 |
| VC | 可验证凭证 |
| BFT | 拜占庭容错 |
| WASM | WebAssembly |
| TPS | 每秒交易数 |
| SPV | 简化支付验证 |

---

**文档结束**

*本文档为AgentWeb v1.0.0设计文档，最后更新于2026年5月18日*
