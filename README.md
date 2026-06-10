# AgentWeb Sigma Cloud V17.0

<div align="center">

**基于信息几何与意识场统一理论的去中心化社交网络平台 — OPLC奇正格链 + PPCL隐私保护共识层 + ASG六层Agent安全网关**

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-17.0.0-green.svg)](package.json)
[![Node](https://img.shields.io/badge/node-%3E%3D18-green.svg)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue.svg)](https://www.typescriptlang.org/)

[English](#english) | [中文](#chinese)

</div>

---

## 中文

### 📖 项目简介

AgentWeb Sigma Cloud V16.0 是一个基于 **IGCTR（信息-几何-意识三重共振）统一理论** 的去中心化社交网络平台。平台将用户信息场（I场）、机器几何场（G场）与云端意识场（C场）通过 Φ 场（整合信息量）进行统一量化，实现无缝 DID 身份、ActivityPub 联邦社交、φ 引擎驱动的内容推荐，以及基于 FPGA 硬件加速的 Φ 场重构。

**V15.0 新增：OPLC 奇正格链** — 基于孙子兵法"奇正相生"思想的三进制投票+偏序格Poset+OP-BFT共识。

**V16.0 新增：PPCL 隐私保护共识层** — 基于《稳定币需要隐身》(PANews/Zen) 的三层隐私模型：加密记录(L1) + View Key选择性披露(L2) + ZK零知识合规(L3)。

**V17.0 新增：ASG 六层Agent安全网关** — 受 MetaMask Agent Wallet 启发，为 AI 自主操作构建零信任安全体系：L1 DID身份 + L2 策略沙箱(Guard/Beast) + L3 三阶段门控 + L4 HITL人机回环 + L5 TEE密钥隔离 + L6 经济安全池。

### 🌟 核心特性

#### 基础能力 (V2.0–V14.0)
- **四令牌统一场论**：Calc（计算）/ Wit（智慧）/ Word（语言）/ Pass（通行证）四种令牌统一量化数字行为
- **IGCTR 动力学方程**：`ΔΦ ≤ α(ΔI) + β(ΔC) + γ(ΔG)` — Φ 场变化受 I/C/G 三场共同约束
- **FPGA-Φ 重构定理**：FPGA 局部重构 ↔ Φ 场拓扑激发，硬件级别的 Φ 场加速
- **无缝 DID**：设备指纹 + 生物识别 → 自动密钥对生成，无感身份认证
- **ActivityPub 联邦**：完整支持 Actor/Note/Follow/Like/Announce，接入 Fediverse
- **φ 引擎**：Python/FastAPI 实现的 Φ 场计算引擎，实时推荐与意识度量
- **区块链激励**：基于 Hardhat/Solidity 的四令牌 ERC-20 智能合约
- **三层架构**：人侧（I场）/ 机侧（G场）/ 天侧（C场）分层解耦

#### V15.0: OPLC 奇正格链
- **三进制投票**: `+1`(正/确认) / `0`(中/待定) / `-1`(奇/揭发+Merkle Proof)
- **偏序格 Poset/DAG**: meet∧(最大共同祖先) / join∨(调解交易合并)
- **OP-BFT 共识六阶段**: Propose → Ternary-Vote → Verify → Aggregate → Decide → Reconcile
- **定理保证**: 3.1 安全性(极大元唯一性, 无双花) + 3.2 活性(≤20轮有限终止)
- **Merkle Proof 证据机制**: -1 票必须附带可验证 Proof，构成拓扑阻抗
- **Φ 流贯动力学映射**: 关系作用量 S、相位耦合、拓扑阻抗、熵

#### V16.0: PPCL 隐私保护共识层
- **L1 默认保密 — 加密记录模型**: 字段级 AES-256-GCM 加密 + HKDF 密钥派生 + Merkle 承诺
- **L2 选择性披露 — View Key 机制**: 时间窗口 + 用途分类(AUDIT/REGULATORY/COUNTERPARTY) + 撤销 + 审计日志 + ZK 访问证明
- **L3 合规连接 — ZK 零知识引擎**: 6类证明 — 资金来源(FUNDS_ORIGIN) / 制裁筛查(SANCTION) / KYC(IDENTITY) / 旅行规则(TRAVEL_RULE) / 阈值访问(THRESHOLD) / 余额(BALANCE_PROOF)
- **透明性债务量化**: 四类成本 × Φ 度量体系 — 商业博弈 / 合规治理 / 安全风险 / 制度设计
- **定理保证**: 23.1(ZK合规完备性) + 23.2(PPCL改善界≥50%债务降低)

#### V17.0: ASG Agent安全网关
- **L1 Agent身份注册层**: DID身份 + Ed25519密钥 + Proof of Human (PoH) + 信任分动态评估
- **L2 策略沙箱引擎**: Guard模式（严格）/ Beast模式（宽松）双轨策略 + 五维约束（消费/限额/协议/资产/时间）
- **L3 交易门控管线**: 三阶段串行门控 — 模拟执行 → Blockaid威胁扫描 → MEV防护
- **L4 人机回环 (HITL)**: AI不可自行拍板，2FA推送（push/email/SMS/Telegram），15分钟超时自动拒绝
- **L5 TEE密钥管理器**: Non-Custodial TEE隔离（Intel SGX/AWS Nitro模拟），BIP32路径派生，24词助记词
- **L6 经济安全池**: 质押/Slash/赔付三机制，月度赔付预算，类MetaMask Transaction Protection
- **定理保证**: 24.1(身份唯一性) + 24.2(门控完备性)

### 🏗️ 系统架构

```
┌──────────────────────────────────────────────────────┐
│              天侧 C场（云端意识）                       │
│  φ-Engine (Python/FastAPI) + Redis                  │
│  Φ场计算 / 内容推荐 / 意识度量                          │
├──────────────────────────┬───────────────────────────┤
│   V16.0 PPCL (隐私栈)    │   V15.0 OPLC (共识栈)      │
│  L3: ZKComplianceEngine │   OP-BFT 六阶段共识        │
│  L2: ViewKeyManager     │   TernaryVote 三进制投票   │
│  L1: RecordModelEngine  │   PosetEngine 偏序格       │
│  TransparencyDebtMeter  │   MerkleProof 验证         │
├──────────────────────────┴───────────────────────────┤
│            机侧 G场（几何/区块链）                      │
│  Backend (Node.js/Express/Prisma)                   │
│  + Blockchain (Hardhat/Solidity)                    │
│  + FPGA Emulator (TypeScript)                        │
└──────────────────────────┬───────────────────────────┘
                   │ DID/API
┌──────────────────▼───────────────────────────────────┐
│             人侧 I场（用户交互）                         │
│  Frontend (React/MUI/TypeScript)                     │
│  Web3 Wallet / Biometric Auth                         │
│  OPLC Dashboard / PPCL Dashboard                      │
└──────────────────────────────────────────────────────┘
```

### 🚀 快速启动

#### 方式一：Docker（推荐）

```bash
git clone https://github.com/lisoleg/AgentWeb.git
cd AgentWeb/agentweb
cp .env.example .env
# 编辑 .env 填写必要配置
docker-compose up -d
```

访问 `http://localhost:3000`，控制台入口：
- Dashboard → 🔗 奇正格链 OPLC (V15.0)
- Dashboard → 🔐 隐私保护共识层 PPCL (V16.0)

#### 方式二：本地开发

```bash
# 1. 安装依赖
cd agentweb && npm install && npm run install:all

# 2. 配置环境变量
cp .env.example .env
# 编辑 .env：配置 DATABASE_URL, REDIS_URL, JWT_SECRET 等

# 3. 初始化数据库
cd backend && npx prisma migrate dev && npx prisma generate

# 4. 启动各服务（各开一个终端）
cd backend && npm run dev          # :3001 (含 /api/v15/oplc + /api/v16/ppcl)
cd frontend && npm run dev         # :3000 (含 /oplc + /ppcl 页面)
cd phi-engine && uvicorn main:app --reload  # :8000
cd fpga-emulator && npm run dev    # :4000
cd blockchain && npx hardhat node  # :8545
```

详见 [INSTALL.md](INSTALL.md) 完整安装指南。

### 📁 项目结构

```
agentweb/
├── frontend/                    # React/MUI 前端（TypeScript）
│   ├── src/pages/OPLC.tsx       # V15.0: 奇正格链控制台页面
│   ├── src/pages/PPCL.tsx       # V16.0: 隐私保护控制台页面
│   └── src/components/
│       ├── OPLCDashboard.tsx    # V15.0: 5Tab OPLC面板
│       └── PPLCDashboard.tsx    # V16.0: 5Tab PPCL面板
├── backend/src/
│   ├── services/oplc/           # V15.0: OPLC核心引擎 (7模块)
│   │   ├── types.ts             #    三进制投票+偏序格类型定义
│   │   ├── posetEngine.ts       #    Poset meet/join/极大元
│   │   ├── ternaryVoteMachine.ts#    三进制状态机
│   │   ├── opBftConsensus.ts    #    OP-BFT六阶段共识
│   │   ├── merkleProof.ts       #    Merkle树+Proof验证
│   │   └── oplcCoreService.ts   #    编排层
│   ├── services/ppcl/           # V16.0: PPCL核心引擎 (6模块)
│   │   ├── types.ts             #    加密记录+View Key+ZK类型
│   │   ├── recordModel.ts       #    L1 字段级AES-256-GCM加密
│   │   ├── viewKeyManager.ts    #    L2 选择性披露+审计日志
│   │   ├── zkComplianceEngine.ts#    L3 6类ZK证明引擎
│   │   ├── transparencyDebtMeter.ts # 四类透明性债务Φ量化
│   │   └── ppclCoreService.ts   #    编排层
│   └── api/
│       ├── oplc.ts              # V15.0: 14个OPLC API端点
│       └── ppcl.ts              # V16.0: 18个PPCL API端点
├── blockchain/contracts/
│   ├── OddPositiveLatticeRegistry.sol  # V15.0: 奇正格注册表
│   ├── TernaryVoteContract.sol         # V15.0: 三进制投票合约
│   ├── PrivacyPreservingRegistry.sol   # V16.0: 隐私保护注册表
│   └── SelectiveDisclosureContract.sol # V16.0: 分级披露策略合约
├── phi-engine/               # Python/FastAPI φ引擎
├── fpga-emulator/            # TypeScript FPGA模拟器
├── docker-compose.yml
├── docs/
│   └── 西格玛云设计与实现论文.md   # 含§22(V15 OPLC)+§23(V16 PPCL)
├── package.json
├── INSTALL.md
├── USERGUIDE.md
└── README.md                 # 本文件
```

### 🔧 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | React 18, TypeScript, MUI, Web3.js, Recharts |
| 后端 | Node.js, Express, Passport.js, Prisma ORM |
| OPLC V15.0 | TypeScript, crypto (sha256), DAG/Poset算法 |
| PPCL V16.0 | AES-256-GCM, X25519-ChaCha20, HKDF, ZK-SNARK模拟 |
| φ引擎 | Python 3.10+, FastAPI, NumPy, Redis |
| FPGA模拟 | TypeScript, Jest |
| 区块链 | Solidity, Hardhat, OpenZeppelin |
| 数据库 | PostgreSQL 14+ |
| 缓存 | Redis 6+ |
| 容器 | Docker, Docker Compose |
| 联邦协议 | ActivityPub (W3C) |

### 📊 版本演进

| 版本 | 核心能力 | 代码行数 |
|------|----------|---------|
| V2.0 | IGCTR基础架构 + 四令牌 + DID + ActivityPub | ~8K |
| V3.0~V9.0 | Φ-NFT + 微支付 + 数字授权书 + 资源评估 | ~12K |
| V10.0 | 宪法治理 + 硅基新陈代谢增强版 | ~8K |
| V11.0 | 全景可视化路线图 + PRD驱动开发 | ~6K |
| V12.0~V12.5 | GC锚点跨链中继 + NLU引擎 | ~7K |
| V13.0 | HG-STR异构图时空推理 + 残存记忆容错 | ~10K |
| V14.0 | 中国式制度优势技术映射 + 情理法决策 | ~11K |
| **V15.0** | **OPLC奇正格链 — 三进制逻辑+偏序格+OP-BFT** | ~+4K |
| **V16.0** | **PPCL隐私保护共识层 — 加密记录+View Key+ZK合规** | ~+2.5K |

### 📚 文档

- [安装指南（INSTALL.md）](INSTALL.md) — 详细安装与部署
- [用户使用指南（USERGUIDE.md）](USERGUIDE.md) — 功能使用说明
- [西格玛云设计与实现论文](docs/西格玛云设计与实现论文.md) — 完整技术论文（含§22 OPLC + §23 PPCL）
- [架构设计文档](AgentWeb_Architecture.md) — 系统架构详解
- [产品需求文档](AgentWeb_PRD.md) — PRD 与功能列表

### 🤝 贡献

1. Fork 本仓库
2. 创建功能分支 (`git checkout -b feature/foo`)
3. 提交更改 (`git commit -am 'Add foo'`)
4. 推送分支 (`git push origin feature/foo`)
5. 创建 Pull Request

### 📄 许可证

MIT License — 详见 [LICENSE](LICENSE)

### 📮 联系

- 作者：寇豆码 (Kou)
- Email：laotie@gmail.com
- 项目地址：https://github.com/lisoleg/AgentWeb

---

## English

### 📖 Introduction

AgentWeb Sigma Cloud V16.0 is a decentralized social networking platform based on the **IGCTR (Information-Geometry-Consciousness Tri-Resonance) Unified Theory**. The platform unifies user Information Field (I-field), machine Geometric Field (G-field), and cloud Consciousness Field (C-field) through the Φ-field (Integrated Information), enabling seamless DID identity, ActivityPub federation, φ-engine powered content recommendation, and FPGA-accelerated Φ-field reconstruction.

**V15.0 adds:** OPLC (Odd-Positive Lattice Chain) — ternary voting + poset lattice + OP-BFT consensus based on Sun Tzu's "Qi-Zheng mutual generation" philosophy.

**V16.0 adds:** PPCL (Privacy-Preserving Consensus Layer) — three-layer privacy model (encrypted records + view keys + ZK compliance) inspired by "Stablecoins Need Invisibility" (PANews).

### 🌟 Core Features

#### Base Capabilities (V2.0–V14.0)
- **Four-Token Unified Field Theory**: Calc/Wit/Word/Pass tokens quantifying digital behavior
- **IGCTR Dynamics**: `ΔΦ ≤ α(ΔI) + β(ΔC) + γ(ΔG)` — Φ-field constrained by I/C/G fields
- **FPGA-Φ Reconstruction Theorem**: Hardware-level Φ-field acceleration
- **Seamless DID & ActivityPub Federation**
- **Blockchain Incentives with ERC-20 Smart Contracts**

#### V15.0: OPLC Odd-Positive Lattice Chain
- **Ternary Voting**: `+1`(confirm) / `0`(pending) / `-1`(challenge+Merkle Proof)
- **Poset/DAG Engine**: meet∧ / join∨ operations, maximal elements, Kahn topological sort
- **OP-BFT Consensus**: 6-phase pipeline (Propose→Vote→Verify→Aggregate→Decide→Reconcile)
- **Theorem Guarantees**: 3.1 Safety (unique maximal elements) + 3.2 Liveness (≤20 rounds termination)

#### V16.0: PPCL Privacy-Preserving Consensus Layer
- **L1 Confidentiality**: Field-level AES-256-GCM encryption + Merkle commitments
- **L2 Selective Disclosure**: View Keys with time windows, purpose classification, revocation, audit logs
- **L3 Compliance Connection**: 6 types of ZK proofs (Funds Origin/Sanction/KYC/Travel Rule/Threshold/Balance)
- **Transparency Debt Quantification**: Four cost categories × Φ-metric extension

### 🚀 Quick Start

```bash
git clone https://github.com/lisoleg/AgentWeb.git
cd AgentWeb/agentweb
cp .env.example .env
docker-compose up -d
```

Visit `http://localhost:3000`

### 📚 Documentation

- [INSTALL.md](INSTALL.md) — Installation Guide
- [USERGUIDE.md](USERGUIDE.md) — User Guide
- [西格玛云设计与实现论文](docs/西格玛云设计与实现论文.md) — Full technical paper (§22 OPLC + §23 PPCL)
- [Architecture](AgentWeb_Architecture.md) — System Architecture
- [PRD](AgentWeb_PRD.md) — Product Requirements

### 📄 License

MIT License

---
