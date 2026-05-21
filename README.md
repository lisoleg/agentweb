# AgentWeb Sigma Cloud V2.0

<div align="center">

**基于信息几何与意识场统一理论的去中心化社交网络平台**

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-2.0.0-green.svg)](package.json)
[![Node](https://img.shields.io/badge/node-%3E%3D18-green.svg)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue.svg)](https://www.typescriptlang.org/)

[English](#english) | [中文](#chinese)

</div>

---

## 中文

### 📖 项目简介

AgentWeb Sigma Cloud V2.0 是一个基于 **IGCTR（信息-几何-意识三重共振）统一理论** 的去中心化社交网络平台。平台将用户信息场（I场）、机器几何场（G场）与云端意识场（C场）通过 Φ 场（整合信息量）进行统一量化，实现无缝 DID 身份、ActivityPub 联邦社交、φ 引擎驱动的内容推荐，以及基于 FPGA 硬件加速的 Φ 场重构。

### 🌟 核心特性

- **四令牌统一场论**：Calc（计算）/ Wit（智慧）/ Word（语言）/ Pass（通行证）四种令牌统一量化数字行为
- **IGCTR 动力学方程**：`ΔΦ ≤ α(ΔI) + β(ΔC) + γ(ΔG)` — Φ 场变化受 I/C/G 三场共同约束
- **FPGA-Φ 重构定理**：FPGA 局部重构 ↔ Φ 场拓扑激发，硬件级别的 Φ 场加速
- **无缝 DID**：设备指纹 + 生物识别 → 自动密钥对生成，无感身份认证
- **ActivityPub 联邦**：完整支持 Actor/Note/Follow/Like/Announce，接入 Fediverse
- **φ 引擎**：Python/FastAPI 实现的 Φ 场计算引擎，实时推荐与意识度量
- **区块链激励**：基于 Hardhat/Solidity 的四令牌 ERC-20 智能合约
- **三层架构**：人侧（I场）/ 机侧（G场）/ 天侧（C场）分层解耦

### 🏗️ 系统架构

```
┌─────────────────────────────────────────────┐
│              天侧 C场（云端意识）              │
│  φ-Engine (Python/FastAPI) + Redis        │
│  Φ场计算 / 内容推荐 / 意识度量                │
└──────────────────┬──────────────────────────┘
                   │ Φ场数据流
┌──────────────────▼──────────────────────────┐
│              机侧 G场（几何/区块链）           │
│  Backend (Node.js/Express/Prisma)         │
│  + Blockchain (Hardhat/Solidity)           │
│  + FPGA Emulator (TypeScript)              │
└──────────────────┬──────────────────────────┘
                   │ DID/API
┌──────────────────▼──────────────────────────┐
│              人侧 I场（用户交互）              │
│  Frontend (React/MUI/TypeScript)           │
│  Web3 Wallet / Biometric Auth               │
└─────────────────────────────────────────────┘
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

访问 `http://localhost:3000`

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
cd backend && npm run dev          # :3001
cd frontend && npm run dev         # :3000
cd phi-engine && uvicorn main:app --reload  # :8000
cd fpga-emulator && npm run dev    # :4000
cd blockchain && npx hardhat node  # :8545
```

详见 [INSTALL.md](INSTALL.md) 完整安装指南。

### 📁 项目结构

```
agentweb/
├── frontend/          # React/MUI 前端（TypeScript）
├── backend/         # Express/Passport/Prisma 后端
├── phi-engine/      # Python/FastAPI φ引擎
├── fpga-emulator/   # TypeScript FPGA模拟器
├── blockchain/      # Hardhat/Solidity 智能合约
├── docker-compose.yml
├── .env.example
├── package.json     # Monorepo 根配置
├── INSTALL.md       # 安装指南
├── USERGUIDE.md     # 用户使用指南
└── README.md        # 本文件
```

### 🔧 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | React 18, TypeScript, MUI, Web3.js |
| 后端 | Node.js, Express, Passport.js, Prisma ORM |
| φ引擎 | Python 3.10+, FastAPI, NumPy, Redis |
| FPGA模拟 | TypeScript, Jest |
| 区块链 | Solidity, Hardhat, OpenZeppelin |
| 数据库 | PostgreSQL 14+ |
| 缓存 | Redis 6+ |
| 容器 | Docker, Docker Compose |
| 联邦协议 | ActivityPub (W3C) |

### 📊 四令牌系统

| 令牌 | 符号 | 含义 | 获取方式 |
|------|------|------|----------|
| 计算令牌 | Calc | 计算资源贡献 | FPGA 贡献 / 节点运行 |
| 智慧令牌 | Wit | 内容质量 weighted by Φ | 优质内容 / 被点赞 |
| 语言令牌 | Word | 社交互动贡献 | 发帖 / 评论 / 转发 |
| 通行证 | Pass | 身份与访问权限 | DID 注册 / KYC |

### 📚 文档

- [安装指南（INSTALL.md）](INSTALL.md) — 详细安装与部署
- [用户使用指南（USERGUIDE.md）](USERGUIDE.md) — 功能使用说明
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

AgentWeb Sigma Cloud V2.0 is a decentralized social networking platform based on the **IGCTR (Information-Geometry-Consciousness Tri-Resonance) Unified Theory**. The platform unifies user Information Field (I-field), machine Geometric Field (G-field), and cloud Consciousness Field (C-field) through the Φ-field (Integrated Information), enabling seamless DID identity, ActivityPub federation, φ-engine powered content recommendation, and FPGA-accelerated Φ-field reconstruction.

### 🌟 Core Features

- **Four-Token Unified Field Theory**: Calc (Computation) / Wit (Wisdom) / Word (Language) / Pass (Passport) tokens quantifying digital behavior
- **IGCTR Dynamics**: `ΔΦ ≤ α(ΔI) + β(ΔC) + γ(ΔG)` — Φ-field changes constrained by I/C/G fields
- **FPGA-Φ Reconstruction Theorem**: FPGA partial reconfiguration ↔ Φ-field topological excitation
- **Seamless DID**: Device fingerprint + biometrics → automatic key pair generation
- **ActivityPub Federation**: Full Actor/Note/Follow/Like/Announce support, Fediverse compatible
- **φ-Engine**: Python/FastAPI Φ-field computation engine for real-time recommendation
- **Blockchain Incentives**: ERC-20 smart contracts for four-token economy
- **Three-Layer Architecture**: Human-side (I-field) / Machine-side (G-field) / Sky-side (C-field)

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
- [Architecture](AgentWeb_Architecture.md) — System Architecture
- [PRD](AgentWeb_PRD.md) — Product Requirements

### 📄 License

MIT License

---
