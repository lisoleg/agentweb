# AgentWeb 西格玛云 - 详细安装用户指南

**文档版本**: v1.0  
**创建日期**: 2026-05-18  
**文档维护者**: 高见远（Gao）  
**项目代号**: 西格玛云 / AgentWeb  
**文档状态**: 正式版

---

## 目录

1. [概述](#1-概述)
2. [系统要求](#2-系统要求)
3. [安装前准备](#3-安装前准备)
4. [快速安装（Docker方式）](#4-快速安装docker方式)
5. [完整安装（手动方式）](#5-完整安装手动方式)
6. [后端服务配置](#6-后端服务配置)
7. [区块链合约部署](#7-区块链合约部署)
8. [前端应用配置](#8-前端应用配置)
9. [Φ引擎服务配置](#9-φ引擎服务配置)
10. [开发环境验证](#10-开发环境验证)
11. [生产环境部署](#11-生产环境部署)
12. [故障排除](#12-故障排除)
13. [常见问题FAQ](#13-常见问题faq)

---

## 1. 概述

### 1.1 文档目的

本文档为AgentWeb（西格玛云）项目提供完整的安装和配置指南，适用于开发、测试和生产环境。AgentWeb是基于Web5的下一代数字社会基础设施，集成了去中心化身份（DID）、Φ价值度量、虚时全息共识等技术。

### 1.2 项目组件

AgentWeb项目包含以下核心组件：

| 组件 | 技术栈 | 端口 | 描述 |
|------|--------|------|------|
| **Frontend** | React 18 + TypeScript + Vite | 5173 | Web前端应用 |
| **Backend** | Node.js + Express + Prisma | 3000 | REST API服务 |
| **Phi Engine** | Python + FastAPI | 8000 | Φ值计算引擎 |
| **PostgreSQL** | PostgreSQL 16 | 5432 | 主数据库 |
| **Redis** | Redis 7 | 6379 | 缓存和消息队列 |

### 1.3 安装方式选择

| 安装方式 | 适用场景 | 复杂度 | 推荐度 |
|---------|---------|--------|--------|
| **Docker Compose** | 快速验证、本地开发 | ⭐ | ⭐⭐⭐⭐⭐ |
| **手动安装** | 生产环境、深度定制 | ⭐⭐⭐⭐ | ⭐⭐⭐ |
| **混合安装** | 部分组件Docker化 | ⭐⭐⭐ | ⭐⭐⭐⭐ |

---

## 2. 系统要求

### 2.1 硬件要求

#### 开发环境（最低配置）

| 资源 | 最低要求 | 推荐配置 |
|------|----------|----------|
| CPU | 4核心 | 8核心+ |
| 内存 | 8GB | 16GB+ |
| 存储 | 20GB | 50GB+ SSD |
| 网络 | 100Mbps | 1Gbps |

#### 生产环境（推荐配置）

| 资源 | 小型部署 | 中型部署 | 大型部署 |
|------|----------|----------|----------|
| CPU | 8核心 | 16核心 | 32核心+ |
| 内存 | 16GB | 32GB | 64GB+ |
| 存储 | 100GB SSD | 500GB SSD | 1TB+ SSD |
| 网络 | 1Gbps | 10Gbps | 10Gbps+ |

### 2.2 软件要求

#### 基础软件

| 软件 | 版本要求 | 用途 |
|------|----------|------|
| **操作系统** | Windows 10+/Linux (Ubuntu 20.04+)/macOS 12+ | 运行环境 |
| **Git** | 2.30+ | 版本控制 |
| **Docker** | 24.0+ | 容器化（可选） |
| **Docker Compose** | 2.20+ | 容器编排（可选） |

#### 开发工具

| 软件 | 版本要求 | 用途 |
|------|----------|------|
| **Node.js** | 20.0+ | 前端和后端运行时 |
| **npm** | 10.0+ | Node.js包管理器 |
| **Python** | 3.11+ | Φ引擎运行时 |
| **pip** | 23.0+ | Python包管理器 |

#### 数据库和缓存

| 软件 | 版本要求 | 用途 |
|------|----------|------|
| **PostgreSQL** | 16.0+ | 主数据库 |
| **Redis** | 7.0+ | 缓存和消息队列 |

### 2.3 网络要求

- **互联网连接**: 需要访问npm、Docker Hub等外部仓库
- **端口可用性**: 以下端口必须未被占用：
  - 3000（后端API）
  - 5173（前端开发服务器）
  - 5432（PostgreSQL）
  - 6379（Redis）
  - 8000（Φ引擎）

---

## 3. 安装前准备

### 3.1 克隆项目代码

```bash
# 使用Git克隆仓库
git clone https://github.com/agentweb/agentweb.git

# 进入项目目录
cd agentweb

# 查看项目结构
ls -la
```

### 3.2 目录结构说明

```
agentweb/
├── frontend/              # 前端应用（React + TypeScript）
├── backend/               # 后端服务（Node.js + Express）
├── blockchain/            # 智能合约（Solidity + Hardhat）
├── phi-engine/            # Φ计算引擎（Python + FastAPI）
├── scripts/               # 工具脚本
├── docker-compose.yml     # Docker编排配置
├── package.json           # 根目录Monorepo配置
└── .env.example          # 环境变量模板
```

### 3.3 创建环境配置文件

```bash
# 复制环境变量模板
cp .env.example .env

# 或手动创建
touch .env
```

### 3.4 配置环境变量

编辑 `.env` 文件，配置必要的环境变量：

```bash
# ============ 数据库配置 ============
DB_USER=agentweb
DB_PASSWORD=your_secure_database_password
DB_NAME=agentweb
DB_PORT=5432

# ============ Redis配置 ============
REDIS_PASSWORD=your_secure_redis_password
REDIS_PORT=6379

# ============ JWT配置 ============
JWT_SECRET=your-super-secret-jwt-key-at-least-32-characters
JWT_EXPIRES_IN=7d
JWT_REFRESH_EXPIRES_IN=30d

# ============ 后端配置 ============
NODE_ENV=development
PORT=3000
LOG_LEVEL=info

# ============ Ethereum配置 ============
# 测试网（推荐开发使用）
ETH_RPC_URL=https://sepolia.optimism.io
ETH_CHAIN_ID=11155111
# 主网
# ETH_RPC_URL=https://mainnet.optimism.io
# ETH_CHAIN_ID=10

# 部署者私钥（注意：测试网使用测试币，不要使用真实私钥）
ETH_PRIVATE_KEY=0x0000000000000000000000000000000000000000

# 合约地址（部署后填入）
CONTRACT_ADDRESS_AGENT_REGISTRY=
CONTRACT_ADDRESS_PHI_STAKING=
CONTRACT_ADDRESS_GOVERNANCE=

# ============ BSV配置 ============
BSV_NODE_URL=https://api.bsvblockchain.com
BSV_PRIVATE_KEY=your-bsv-private-key
BSV_NETWORK=testnet  # testnet / mainnet

# ============ Φ引擎配置 ============
PHI_ENGINE_PORT=8000
PHI_ENGINE_URL=http://localhost:8000

# ============ 前端配置 ============
VITE_API_URL=http://localhost:3000
VITE_WS_URL=ws://localhost:3000
```

### 3.5 防火墙配置（Linux）

```bash
# 开放必要端口
sudo ufw allow 3000/tcp   # 后端API
sudo ufw allow 5173/tcp   # 前端开发服务器
sudo ufw allow 8000/tcp   # Φ引擎
sudo ufw allow 5432/tcp   # PostgreSQL（仅本地）
sudo ufw allow 6379/tcp   # Redis（仅本地）

# 重启防火墙
sudo ufw reload
```

---

## 4. 快速安装（Docker方式）

### 4.1 前提条件

确保已安装Docker和Docker Compose：

```bash
# 检查Docker版本
docker --version
# Docker version 24.0.0+

# 检查Docker Compose版本
docker compose version
# Docker Compose version v2.20.0+
```

### 4.2 安装Docker（如果未安装）

#### Windows

1. 下载 [Docker Desktop for Windows](https://www.docker.com/products/docker-desktop/)
2. 运行安装程序
3. 启动Docker Desktop
4. 等待Docker daemon启动完成

#### Linux (Ubuntu)

```bash
# 更新包索引
sudo apt update

# 安装依赖包
sudo apt install apt-transport-https ca-certificates curl software-properties-common

# 添加Docker官方GPG密钥
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg

# 添加Docker仓库
echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# 安装Docker
sudo apt update
sudo apt install docker-ce docker-ce-cli containerd.io docker-compose-plugin

# 将当前用户添加到docker组
sudo usermod -aG docker $USER

# 重新登录使配置生效
newgrp docker
```

#### macOS

```bash
# 使用Homebrew安装
brew install --cask docker

# 或下载 [Docker Desktop for Mac](https://www.docker.com/products/docker-desktop/)
```

### 4.3 使用Docker Compose启动所有服务

```bash
# 进入项目目录
cd agentweb

# 构建并启动所有服务
docker-compose up -d

# 查看服务状态
docker-compose ps

# 查看日志
docker-compose logs -f
```

### 4.4 初始化数据库

```bash
# 等待PostgreSQL完全启动
sleep 10

# 执行数据库迁移
docker-compose exec backend npx prisma migrate deploy

# 填充种子数据（可选）
docker-compose exec backend npx prisma db seed
```

### 4.5 部署智能合约（测试网）

```bash
# 进入智能合约目录
cd blockchain

# 安装依赖
npm install

# 复制环境变量
cp .env.example .env
# 编辑.env，配置测试网RPC URL和私钥

# 部署到测试网
npx hardhat run scripts/deploy.ts --network sepolia
```

### 4.6 访问应用

启动完成后，访问以下地址：

| 服务 | 地址 | 描述 |
|------|------|------|
| 前端应用 | http://localhost:5173 | Web界面 |
| 后端API | http://localhost:3000 | REST API |
| Φ引擎API | http://localhost:8000 | Φ计算服务 |
| API文档 | http://localhost:3000/api/docs | Swagger文档 |
| Prisma Studio | http://localhost:5555 | 数据库管理 |

### 4.7 停止服务

```bash
# 停止所有服务
docker-compose down

# 停止并删除数据卷（慎用）
docker-compose down -v
```

---

## 5. 完整安装（手动方式）

### 5.1 安装Node.js

#### Windows

1. 下载 [Node.js 20 LTS](https://nodejs.org/)
2. 运行安装程序
3. 验证安装：
```powershell
node --version
npm --version
```

#### Linux (Ubuntu)

```bash
# 使用NodeSource安装Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# 验证安装
node --version
npm --version
```

#### macOS

```bash
# 使用Homebrew安装
brew install node@20

# 或从官网下载.pkg安装包
```

### 5.2 安装Python

#### Windows

1. 下载 [Python 3.11+](https://www.python.org/downloads/)
2. 运行安装程序
3. 勾选"Add Python to PATH"
4. 验证安装：
```powershell
python --version
pip --version
```

#### Linux (Ubuntu)

```bash
# 安装Python和pip
sudo apt update
sudo apt install -y python3.11 python3-pip python3.11-venv

# 验证安装
python3 --version
pip3 --version
```

#### macOS

```bash
# 使用Homebrew安装
brew install python@3.11

# 验证安装
python3 --version
```

### 5.3 安装PostgreSQL

#### Windows

1. 下载 [PostgreSQL 16](https://www.postgresql.org/download/windows/)
2. 运行安装程序
3. 设置postgres用户密码
4. 创建数据库：
```powershell
psql -U postgres -c "CREATE DATABASE agentweb;"
psql -U postgres -c "CREATE USER agentweb WITH PASSWORD 'your_password';"
psql -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE agentweb TO agentweb;"
```

#### Linux (Ubuntu)

```bash
# 安装PostgreSQL
sudo apt update
sudo apt install -y postgresql postgresql-contrib

# 启动服务
sudo systemctl start postgresql
sudo systemctl enable postgresql

# 创建数据库和用户
sudo -u postgres psql << EOF
CREATE DATABASE agentweb;
CREATE USER agentweb WITH PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE agentweb TO agentweb;
ALTER DATABASE agentweb OWNER TO agentweb;
\q
EOF
```

#### macOS

```bash
# 使用Homebrew安装
brew install postgresql@16
brew services start postgresql@16

# 创建数据库
createdb agentweb
```

### 5.4 安装Redis

#### Windows

```powershell
# 使用Chocolatey安装
choco install redis-64 -y

# 或下载 [Memurai](https://www.memurai.com/)（Redis兼容版）
```

#### Linux (Ubuntu)

```bash
# 安装Redis
sudo apt update
sudo apt install -y redis-server

# 启动服务
sudo systemctl start redis-server
sudo systemctl enable redis-server

# 配置密码（可选）
sudo redis-cli CONFIG SET requirepass "your_redis_password"
```

#### macOS

```bash
# 使用Homebrew安装
brew install redis
brew services start redis
```

### 5.5 安装项目依赖

#### 1. 安装前端依赖

```bash
cd agentweb/frontend
npm install
```

#### 2. 安装后端依赖

```bash
cd agentweb/backend
npm install
```

#### 3. 安装区块链工具

```bash
cd agentweb/blockchain
npm install
```

#### 4. 安装Φ引擎依赖

```bash
cd agentweb/phi-engine

# 创建虚拟环境（推荐）
python3 -m venv venv
source venv/bin/activate  # Linux/macOS
# 或 venv\Scripts\activate  # Windows

# 安装Python依赖
pip install -r requirements.txt
```

### 5.6 配置环境变量

#### 后端环境变量

```bash
cd agentweb/backend

# 创建.env文件
cat > .env << EOF
NODE_ENV=development
PORT=3000

# 数据库
DATABASE_URL="postgresql://agentweb:your_password@localhost:5432/agentweb"

# Redis
REDIS_URL="redis://localhost:6379"
REDIS_PASSWORD=""

# JWT
JWT_SECRET="your-super-secret-jwt-key-at-least-32-characters"
JWT_EXPIRES_IN="7d"

# Ethereum
ETH_RPC_URL="https://sepolia.optimism.io"
ETH_PRIVATE_KEY="0x0000000000000000000000000000000000000000"

# 日志
LOG_LEVEL=info
EOF
```

#### 前端环境变量

```bash
cd agentweb/frontend

# 创建.env文件
cat > .env << EOF
VITE_API_URL=http://localhost:3000
VITE_WS_URL=ws://localhost:3000
VITE_APP_NAME=AgentWeb
VITE_APP_VERSION=1.0.0
EOF
```

### 5.7 初始化数据库

```bash
cd agentweb/backend

# 生成Prisma客户端
npx prisma generate

# 执行数据库迁移
npx prisma migrate dev --name init

# 填充种子数据（可选）
npx prisma db seed
```

### 5.8 编译TypeScript代码

```bash
# 后端编译
cd agentweb/backend
npm run build

# 前端构建
cd agentweb/frontend
npm run build
```

---

## 6. 后端服务配置

### 6.1 后端目录结构

```
backend/
├── src/
│   ├── api/                 # API路由
│   │   ├── did.ts          # DID相关路由
│   │   ├── vc.ts           # VC相关路由
│   │   ├── phi.ts          # Φ值相关路由
│   │   ├── agent.ts        # Agent相关路由
│   │   ├── governance.ts    # 治理相关路由
│   │   └── news.ts         # 新闻流相关路由
│   ├── services/           # 业务逻辑层
│   │   ├── didService.ts
│   │   ├── phiService.ts
│   │   ├── agentService.ts
│   │   ├── bsvService.ts
│   │   ├── ethService.ts
│   │   └── zkService.ts
│   ├── middleware/         # 中间件
│   │   ├── auth.ts
│   │   ├── errorHandler.ts
│   │   ├── rateLimit.ts
│   │   └── validator.ts
│   ├── models/             # 数据模型
│   ├── utils/              # 工具函数
│   ├── workers/            # 后台任务
│   ├── index.ts            # 入口文件
│   └── app.ts              # 应用配置
├── prisma/
│   ├── schema.prisma       # 数据库Schema
│   ├── migrations/         # 迁移文件
│   └── seed.ts             # 种子数据
├── tests/                  # 测试
└── package.json
```

### 6.2 数据库Schema配置

`prisma/schema.prisma` 定义了核心数据模型：

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// 用户模型
model User {
  id            String    @id @default(uuid())
  email         String    @unique
  password      String
  did           String?   @unique
  phiValue      Float     @default(0)
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  agents        Agent[]
  proposals     Proposal[]
  votes         Vote[]
  credentials   VerifiableCredential[]

  @@map("users")
}

// DID文档
model DIDDocument {
  id            String    @id @default(uuid())
  did           String    @unique
  document      Json
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  @@map("did_documents")
}

// 可验证凭证
model VerifiableCredential {
  id            String    @id @default(uuid())
  userId        String
  issuer        String
  type          String[]
  credentialSubject Json
  proof         Json
  validUntil    DateTime?
  revoked       Boolean   @default(false)
  createdAt     DateTime  @default(now())

  user          User      @relation(fields: [userId], references: [id])

  @@map("verifiable_credentials")
}

// Agent模型
model Agent {
  id            String    @id @default(uuid())
  userId        String
  name          String
  description   String?
  capabilities  Json
  reputation    Float     @default(0)
  stakeAmount   Float     @default(0)
  isActive      Boolean   @default(true)
  registeredAt  DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  user          User      @relation(fields: [userId], references: [id])
  tasks         Task[]

  @@map("agents")
}

// 治理提案
model Proposal {
  id            String    @id @default(uuid())
  userId        String
  title         String
  description   String
  calldata      String?
  status        ProposalStatus @default(PENDING)
  votesFor      Int       @default(0)
  votesAgainst  Int       @default(0)
  startTime     DateTime
  endTime       DateTime
  createdAt     DateTime  @default(now())

  user          User      @relation(fields: [userId], references: [id])
  votes         Vote[]

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

// 投票记录
model Vote {
  id            String    @id @default(uuid())
  proposalId    String
  userId        String
  support       Boolean
  votingPower   Int
  createdAt     DateTime  @default(now())

  proposal      Proposal  @relation(fields: [proposalId], references: [id])
  user          User      @relation(fields: [userId], references: [id])

  @@unique([proposalId, userId])
  @@map("votes")
}

// 新闻内容
model NewsContent {
  id            String    @id @default(uuid())
  authorId      String
  content       String
  contentHash   String    @unique
  phiValue      Float
  bsvTxId       String?
  metadata      Json?
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  interactions  Interaction[]

  @@map("news_contents")
}

// 互动记录
model Interaction {
  id            String    @id @default(uuid())
  contentId     String
  userId        String
  type          InteractionType
  data          Json?
  createdAt     DateTime  @default(now())

  content       NewsContent @relation(fields: [contentId], references: [id])

  @@map("interactions")
}

enum InteractionType {
  LIKE
  COMMENT
  SHARE
  BOOKMARK
}

// Φ值历史记录
model PhiHistory {
  id            String    @id @default(uuid())
  userId        String
  phiValue      Float
  delta         Float
  reason        String
  metadata      Json?
  createdAt     DateTime  @default(now())

  @@index([userId, createdAt])
  @@map("phi_history")
}
```

### 6.3 启动后端服务

```bash
cd agentweb/backend

# 开发模式（热重载）
npm run dev

# 生产模式
npm run build
npm start
```

### 6.4 验证后端服务

```bash
# 健康检查
curl http://localhost:3000/health

# 预期响应
# {"status":"ok","timestamp":"2026-05-18T12:00:00.000Z","version":"1.0.0"}
```

---

## 7. 区块链合约部署

### 7.1 区块链目录结构

```
blockchain/
├── contracts/
│   ├── AgentRegistry.sol    # Agent注册合约
│   ├── PhiStaking.sol       # Φ质押合约
│   ├── Governance.sol       # 治理合约
│   ├── PhiToken.sol         # Φ代币合约
│   ├── ZKVerifier.sol       # ZK验证合约
│   └── interfaces/          # 合约接口
├── scripts/
│   ├── deploy.ts            # 主部署脚本
│   ├── deployAgentRegistry.ts
│   ├── deployPhiStaking.ts
│   └── verify.ts
├── test/                     # 合约测试
├── hardhat.config.ts
└── package.json
```

### 7.2 Hardhat配置

`hardhat.config.ts`:

```typescript
import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv";

dotenv.config();

const PRIVATE_KEY = process.env.ETH_PRIVATE_KEY || "";
const SEPOLIA_RPC_URL = process.env.ETH_RPC_URL || "https://sepolia.optimism.io";
const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY || "";

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  },
  networks: {
    hardhat: {
      chainId: 31337
    },
    sepolia: {
      url: SEPOLIA_RPC_URL,
      accounts: [PRIVATE_KEY],
      chainId: 11155111
    },
    optimism: {
      url: process.env.OPTIMISM_RPC_URL || "",
      accounts: [PRIVATE_KEY],
      chainId: 10
    },
    localhost: {
      url: "http://127.0.0.1:8545"
    }
  },
  etherscan: {
    apiKey: {
      sepolia: ETHERSCAN_API_KEY,
      optimisticSepolia: ETHERSCAN_API_KEY
    }
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS === "true",
    currency: "USD"
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts"
  }
};

export default config;
```

### 7.3 核心合约说明

#### AgentRegistry.sol

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract AgentRegistry {
    // Agent元数据结构
    struct Agent {
        address owner;
        string name;
        string description;
        bytes capabilities;  // ABI编码的能力列表
        uint256 reputation;
        uint256 stakeAmount;
        bool isActive;
        uint256 registeredAt;
    }

    // 状态变量
    mapping(bytes32 => Agent) public agents;
    mapping(address => bytes32[]) public ownerAgents;
    bytes32[] public agentList;

    // 事件
    event AgentRegistered(
        bytes32 indexed agentId,
        address indexed owner,
        string name,
        uint256 stakeAmount
    );
    event AgentUpdated(bytes32 indexed agentId);
    event ReputationUpdated(bytes32 indexed agentId, uint256 newReputation);

    // 注册Agent
    function register(
        string calldata name,
        string calldata description,
        bytes calldata capabilities
    ) external payable returns (bytes32) {
        require(msg.value >= MIN_STAKE_AMOUNT, "Insufficient stake");
        
        bytes32 agentId = keccak256(abi.encodePacked(
            msg.sender,
            name,
            block.timestamp
        ));

        agents[agentId] = Agent({
            owner: msg.sender,
            name: name,
            description: description,
            capabilities: capabilities,
            reputation: 0,
            stakeAmount: msg.value,
            isActive: true,
            registeredAt: block.timestamp
        });

        agentList.push(agentId);
        ownerAgents[msg.sender].push(agentId);

        emit AgentRegistered(agentId, msg.sender, name, msg.value);
        return agentId;
    }

    // 更新Agent信誉
    function updateReputation(bytes32 agentId, int256 delta) external {
        // 仅允许授权调用
        Agent storage agent = agents[agentId];
        require(agent.owner != address(0), "Agent does not exist");
        
        int256 newReputation = int256(agent.reputation) + delta;
        require(newReputation >= 0, "Reputation cannot be negative");
        
        agent.reputation = uint256(newReputation);
        emit ReputationUpdated(agentId, agent.reputation);
    }

    // 获取Agent列表
    function getAgentList() external view returns (bytes32[] memory) {
        return agentList;
    }

    // 获取Agent详情
    function getAgent(bytes32 agentId) external view returns (Agent memory) {
        return agents[agentId];
    }
}
```

#### PhiStaking.sol

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract PhiStaking {
    // 质押信息
    struct StakeInfo {
        uint256 amount;
        uint256 startTime;
        uint256 unlockTime;
        bool withdrawn;
    }

    // 状态变量
    mapping(address => uint256) public stakes;
    mapping(address => StakeInfo[]) public stakeHistory;
    uint256 public totalStaked;
    uint256 public constant ANNUAL_YIELD = 500; // 5%

    // 事件
    event Staked(address indexed user, uint256 amount);
    event Unstaked(address indexed user, uint256 amount);
    event RewardClaimed(address indexed user, uint256 reward);

    // 质押Φ代币
    function stake(uint256 amount) external {
        require(amount > 0, "Amount must be positive");
        
        // 转移代币（实际项目中应调用ERC20.transferFrom）
        
        stakes[msg.sender] += amount;
        totalStaked += amount;
        
        stakeHistory[msg.sender].push(StakeInfo({
            amount: amount,
            startTime: block.timestamp,
            unlockTime: block.timestamp + 30 days,
            withdrawn: false
        }));

        emit Staked(msg.sender, amount);
    }

    // 解质押
    function unstake(uint256 amount) external {
        require(stakes[msg.sender] >= amount, "Insufficient stake");
        
        // 检查锁定期
        StakeInfo[] storage history = stakeHistory[msg.sender];
        uint256 availableAmount = 0;
        
        for (uint i = 0; i < history.length; i++) {
            if (!history[i].withdrawn && block.timestamp >= history[i].unlockTime) {
                availableAmount += history[i].amount;
            }
        }
        
        require(availableAmount >= amount, "Funds are locked");
        
        stakes[msg.sender] -= amount;
        totalStaked -= amount;
        
        // 标记已提取
        uint256 remaining = amount;
        for (uint i = 0; i < history.length && remaining > 0; i++) {
            if (!history[i].withdrawn && block.timestamp >= history[i].unlockTime) {
                uint256 toWithdraw = min(remaining, history[i].amount);
                history[i].withdrawn = true;
                remaining -= toWithdraw;
            }
        }
        
        // 转移代币（实际项目中应调用ERC20.transfer）
        
        emit Unstaked(msg.sender, amount);
    }

    // 计算投票权重（基于质押时间和金额）
    function getVotingPower(address user) external view returns (uint256) {
        uint256 basePower = stakes[user];
        
        // 时间加成：每质押满1年增加10%
        for (uint i = 0; i < stakeHistory[user].length; i++) {
            StakeInfo memory stake = stakeHistory[user][i];
            if (!stake.withdrawn) {
                uint256 duration = block.timestamp - stake.startTime;
                uint256 years = duration / 365 days;
                uint256 bonus = stake.amount * years * 100 / 1000; // 10% per year
                basePower += bonus;
            }
        }
        
        return basePower;
    }

    // 计算奖励
    function calculateReward(address user) external view returns (uint256) {
        uint256 reward = 0;
        uint256 stakeAmount = stakes[user];
        
        for (uint i = 0; i < stakeHistory[user].length; i++) {
            StakeInfo memory stake = stakeHistory[user][i];
            if (!stake.withdrawn) {
                uint256 duration = block.timestamp - stake.startTime;
                reward += stake.amount * ANNUAL_YIELD * duration / (365 days * 10000);
            }
        }
        
        return reward;
    }

    function min(uint256 a, uint256 b) internal pure returns (uint256) {
        return a < b ? a : b;
    }
}
```

### 7.4 部署合约

#### 1. 配置环境变量

```bash
cd agentweb/blockchain

# 编辑.env文件
cat > .env << EOF
ETH_RPC_URL=https://sepolia.optimism.io
ETH_PRIVATE_KEY=0x0000000000000000000000000000000000000000000000000000000000000001
ETHERSCAN_API_KEY=your_etherscan_api_key
EOF
```

#### 2. 运行部署脚本

```bash
# 部署到本地测试网
npx hardhat run scripts/deploy.ts --network localhost

# 部署到Sepolia测试网
npx hardhat run scripts/deploy.ts --network sepolia

# 部署到主网（需要确认）
npx hardhat run scripts/deploy.ts --network optimism
```

#### 3. 部署脚本内容

`scripts/deploy.ts`:

```typescript
import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);
  console.log("Account balance:", (await deployer.provider.getBalance(deployer.address)).toString());

  // 部署AgentRegistry
  const AgentRegistry = await ethers.getContractFactory("AgentRegistry");
  const agentRegistry = await AgentRegistry.deploy();
  await agentRegistry.waitForDeployment();
  const agentRegistryAddress = await agentRegistry.getAddress();
  console.log("AgentRegistry deployed to:", agentRegistryAddress);

  // 部署PhiStaking
  const PhiStaking = await ethers.getContractFactory("PhiStaking");
  const phiStaking = await PhiStaking.deploy();
  await phiStaking.waitForDeployment();
  const phiStakingAddress = await phiStaking.getAddress();
  console.log("PhiStaking deployed to:", phiStakingAddress);

  // 部署Governance
  const Governance = await ethers.getContractFactory("Governance");
  const governance = await Governance.deploy(agentRegistryAddress, phiStakingAddress);
  await governance.waitForDeployment();
  const governanceAddress = await governance.getAddress();
  console.log("Governance deployed to:", governanceAddress);

  // 保存部署信息
  const deploymentInfo = {
    network: (await ethers.provider.getNetwork()).name,
    chainId: (await ethers.provider.getNetwork()).chainId.toString(),
    timestamp: new Date().toISOString(),
    contracts: {
      AgentRegistry: agentRegistryAddress,
      PhiStaking: phiStakingAddress,
      Governance: governanceAddress
    }
  };

  console.log("\n=== Deployment Info ===");
  console.log(JSON.stringify(deploymentInfo, null, 2));

  return deploymentInfo;
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
```

#### 4. 更新后端环境变量

部署成功后，将合约地址添加到后端 `.env` 文件：

```bash
# 后端.env文件
CONTRACT_ADDRESS_AGENT_REGISTRY=0x1234567890123456789012345678901234567890
CONTRACT_ADDRESS_PHI_STAKING=0x2345678901234567890123456789012345678901
CONTRACT_ADDRESS_GOVERNANCE=0x3456789012345678901234567890123456789012
```

---

## 8. 前端应用配置

### 8.1 前端目录结构

```
frontend/
├── src/
│   ├── components/           # 可复用组件
│   │   ├── common/          # 通用组件
│   │   │   ├── Button.tsx
│   │   │   ├── Modal.tsx
│   │   │   └── Loading.tsx
│   │   ├── did/             # DID相关组件
│   │   │   ├── DIDCard.tsx
│   │   │   ├── DIDDisplay.tsx
│   │   │   └── VCList.tsx
│   │   ├── phi/             # Φ值相关组件
│   │   │   ├── PhiGauge.tsx
│   │   │   ├── PhiDashboard.tsx
│   │   │   └── PhiHistory.tsx
│   │   ├── agent/           # Agent相关组件
│   │   │   ├── AgentCard.tsx
│   │   │   └── RegisterForm.tsx
│   │   └── governance/      # 治理相关组件
│   │       ├── ProposalList.tsx
│   │       └── VoteModal.tsx
│   ├── pages/               # 页面组件
│   │   ├── Login.tsx
│   │   ├── Dashboard.tsx
│   │   ├── Identity.tsx
│   │   ├── AgentWorkbench.tsx
│   │   ├── Governance.tsx
│   │   └── NewsFeed.tsx
│   ├── services/            # API服务
│   │   ├── api.ts           # Axios实例
│   │   ├── didService.ts
│   │   ├── phiService.ts
│   │   ├── agentService.ts
│   │   └── governanceService.ts
│   ├── hooks/               # 自定义Hooks
│   │   ├── useDID.ts
│   │   ├── usePhi.ts
│   │   └── useWebSocket.ts
│   ├── store/               # 状态管理（Zustand）
│   │   ├── didStore.ts
│   │   ├── phiStore.ts
│   │   ├── agentStore.ts
│   │   └── governanceStore.ts
│   ├── utils/               # 工具函数
│   │   ├── crypto.ts
│   │   ├── did.ts
│   │   └── format.ts
│   ├── types/               # TypeScript类型
│   ├── App.tsx              # 根组件
│   └── main.tsx             # 入口文件
├── public/
│   └── manifest.json        # PWA配置
├── package.json
├── tsconfig.json
└── vite.config.ts
```

### 8.2 启动前端开发服务器

```bash
cd agentweb/frontend

# 安装依赖（如未安装）
npm install

# 启动开发服务器
npm run dev

# 访问 http://localhost:5173
```

### 8.3 前端环境配置

`frontend/.env`:

```bash
# API配置
VITE_API_URL=http://localhost:3000
VITE_WS_URL=ws://localhost:3000

# 应用信息
VITE_APP_NAME=AgentWeb
VITE_APP_VERSION=1.0.0

# 功能开关
VITE_ENABLE_ANALYTICS=false
VITE_ENABLE_DEBUG=false
```

### 8.4 构建生产版本

```bash
cd agentweb/frontend

# 构建生产版本
npm run build

# 预览构建结果
npm run preview

# 构建产物位于 dist/ 目录
```

---

## 9. Φ引擎服务配置

### 9.1 Φ引擎目录结构

```
phi-engine/
├── src/
│   ├── __init__.py
│   ├── main.py              # FastAPI应用入口
│   ├── calculator.py        # Φ值计算核心
│   ├── integrator.py        # 数值积分器
│   ├── optimizer.py         # 优化算法
│   ├── api.py               # API路由
│   └── utils.py             # 工具函数
├── tests/
│   ├── test_calculator.py
│   └── test_api.py
├── requirements.txt
├── Dockerfile
└── .env
```

### 9.2 Φ计算核心算法

`src/calculator.py`:

```python
"""
Φ (Phi) Value Calculator - 整合信息理论实现
基于复合体理学框架，计算节点/内容的整合信息值
"""

import numpy as np
from scipy import integrate
from typing import Dict, List, Tuple, Optional
import hashlib
import json


class PhiCalculator:
    """
    Φ值计算器
    
    核心公式：Φ = ∫∫ I(x;t) dx dt
    其中 I(x;t) 是互信息函数
    
    实现基于整合信息理论（IIT 4.0）的近似算法
    """
    
    def __init__(
        self,
        discretization_steps: int = 100,
        time_horizon: float = 1.0,
        coupling_strength: float = 1.0
    ):
        self.dt = time_horizon / discretization_steps
        self.T = time_horizon
        self.N = discretization_steps
        self.coupling = coupling_strength
        
    def calculate_phi(
        self,
        interaction_data: Dict,
        content_features: Optional[np.ndarray] = None
    ) -> Dict:
        """
        计算Φ值
        
        Args:
            interaction_data: 交互数据，包含时间序列
            content_features: 可选的额外特征向量
            
        Returns:
            包含Φ值和计算详情的字典
        """
        # 提取时间序列
        time_series = self._extract_time_series(interaction_data)
        
        # 计算互信息矩阵
        mutual_info = self._compute_mutual_information(time_series)
        
        # 计算积分
        phi_value = self._integrate_phi(mutual_info)
        
        # 添加内容特征贡献
        if content_features is not None:
            phi_value += self._compute_feature_contribution(content_features)
        
        # 计算归一化分数
        normalized_phi = self._normalize_phi(phi_value)
        
        return {
            "phi_value": phi_value,
            "normalized_phi": normalized_phi,
            "details": {
                "mutual_information": mutual_info.tolist(),
                "integration_steps": self.N,
                "coupling_strength": self.coupling
            },
            "timestamp": self._get_timestamp()
        }
    
    def _extract_time_series(self, data: Dict) -> np.ndarray:
        """从交互数据中提取时间序列"""
        if "time_series" in data:
            return np.array(data["time_series"])
        
        # 从事件列表构建时间序列
        events = data.get("events", [])
        if not events:
            # 生成基于内容的默认序列
            content_hash = hashlib.sha256(
                json.dumps(data, sort_keys=True).encode()
            ).hexdigest()
            np.random.seed(int(content_hash[:8], 16))
            return np.random.randn(self.N)
        
        timestamps = [e.get("timestamp", i) for i, e in enumerate(events)]
        values = [e.get("value", 0) for e in events]
        
        # 插值到统一时间网格
        return np.interp(
            np.linspace(0, self.T, self.N),
            timestamps,
            values
        )
    
    def _compute_mutual_information(
        self,
        time_series: np.ndarray
    ) -> np.ndarray:
        """
        计算互信息矩阵
        
        使用概率密度估计和直方图方法
        """
        # 状态空间重构（时间延迟嵌入）
        delay = 5
        dimension = 3
        
        # 构建相空间
        phase_space = self._phase_space_reconstruction(
            time_series, delay, dimension
        )
        
        # 估计联合概率分布
        joint_prob = self._estimate_joint_probability(phase_space)
        
        # 计算互信息
        mutual_info = self._calculate_mi_from_joint_prob(joint_prob)
        
        return mutual_info
    
    def _phase_space_reconstruction(
        self,
        series: np.ndarray,
        delay: int,
        dim: int
    ) -> np.ndarray:
        """相空间重构"""
        n_points = len(series) - (dim - 1) * delay
        if n_points <= 0:
            return series.reshape(-1, 1)
        
        phase_space = np.zeros((n_points, dim))
        for i in range(dim):
            phase_space[:, i] = series[i * delay: i * delay + n_points]
        
        return phase_space
    
    def _estimate_joint_probability(
        self,
        phase_space: np.ndarray
    ) -> np.ndarray:
        """使用直方图估计联合概率"""
        n_bins = 20
        
        # 归一化
        ps_normalized = (phase_space - phase_space.mean(axis=0)) / (
            phase_space.std(axis=0) + 1e-10
        )
        
        # 计算直方图
        hist, _ = np.histogramdd(
            ps_normalized,
            bins=n_bins,
            density=True
        )
        
        # 转换为概率
        prob = hist / (hist.sum() + 1e-10)
        
        return prob
    
    def _calculate_mi_from_joint_prob(
        self,
        joint_prob: np.ndarray
    ) -> np.ndarray:
        """从联合概率计算互信息"""
        # 边际概率
        marginal_x = joint_prob.sum(axis=1)
        marginal_y = joint_prob.sum(axis=0)
        
        # 避免除零
        joint_prob = np.where(joint_prob > 0, joint_prob, 1e-10)
        marginal_x = np.where(marginal_x > 0, marginal_x, 1e-10)
        marginal_y = np.where(marginal_y > 0, marginal_y, 1e-10)
        
        # 计算互信息
        mi = np.sum(
            joint_prob * np.log2(
                joint_prob / np.outer(marginal_x, marginal_y)
            )
        )
        
        return np.array([[mi]])
    
    def _integrate_phi(self, mutual_info: np.ndarray) -> float:
        """执行Φ值积分"""
        # Φ = ∫∫ I(x;t) dx dt
        result, _ = integrate.dblquad(
            lambda t, x: self._interpolated_mi(x, t, mutual_info),
            0, self.T,
            lambda x: 0,
            lambda x: self.T
        )
        return max(0, result)
    
    def _interpolated_mi(
        self,
        x: float,
        t: float,
        mi_matrix: np.ndarray
    ) -> float:
        """插值互信息"""
        # 简化的线性插值
        nx, nt = mi_matrix.shape
        idx = int((x / self.T) * (nx - 1))
        idt = int((t / self.T) * (nt - 1))
        idx = min(idx, nx - 1)
        idt = min(idt, nt - 1)
        return mi_matrix[idx, idt] * self.coupling
    
    def _compute_feature_contribution(
        self,
        features: np.ndarray
    ) -> float:
        """计算内容特征对Φ值的贡献"""
        # 使用内容的整合度作为贡献
        feature_phi = np.sum(features * np.arange(1, len(features) + 1))
        return feature_phi / (len(features) * 10)
    
    def _normalize_phi(
        self,
        phi: float,
        min_phi: float = 0.0,
        max_phi: float = 1000.0
    ) -> float:
        """将Φ值归一化到[0, 100]"""
        normalized = (phi - min_phi) / (max_phi - min_phi)
        return min(100, max(0, normalized * 100))
    
    @staticmethod
    def _get_timestamp() -> str:
        """获取ISO格式时间戳"""
        from datetime import datetime, timezone
        return datetime.now(timezone.utc).isoformat()


class PhiCalculatorFactory:
    """Φ计算器工厂"""
    
    @staticmethod
    def create_calculator(
        mode: str = "standard",
        **kwargs
    ) -> PhiCalculator:
        """
        创建Φ计算器实例
        
        Args:
            mode: 计算模式 ('standard', 'fast', 'precise')
            **kwargs: 传递给计算器的参数
        """
        if mode == "fast":
            return PhiCalculator(
                discretization_steps=50,
                time_horizon=0.5,
                **kwargs
            )
        elif mode == "precise":
            return PhiCalculator(
                discretization_steps=200,
                time_horizon=2.0,
                **kwargs
            )
        else:  # standard
            return PhiCalculator(**kwargs)
```

### 9.3 FastAPI应用入口

`src/main.py`:

```python
"""
AgentWeb Φ Engine - FastAPI Application
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Dict, List, Optional, Any
import logging
from datetime import datetime

from .calculator import PhiCalculator, PhiCalculatorFactory

# 配置日志
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# 创建FastAPI应用
app = FastAPI(
    title="AgentWeb Φ Engine",
    description="Φ值计算引擎 - 基于整合信息理论",
    version="1.0.0"
)

# CORS配置
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 生产环境应限制
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 初始化Φ计算器
phi_calculator = PhiCalculatorFactory.create_calculator("standard")


# Pydantic模型
class InteractionData(BaseModel):
    """交互数据模型"""
    user_id: Optional[str] = None
    content_id: Optional[str] = None
    time_series: Optional[List[float]] = None
    events: Optional[List[Dict[str, Any]]] = None
    metadata: Optional[Dict[str, Any]] = None


class PhiCalculateRequest(BaseModel):
    """Φ值计算请求"""
    interaction_data: InteractionData
    content_features: Optional[List[float]] = None
    mode: str = Field(default="standard", pattern="^(standard|fast|precise)$")


class PhiCalculateResponse(BaseModel):
    """Φ值计算响应"""
    phi_value: float
    normalized_phi: float
    details: Dict[str, Any]
    timestamp: str


class BatchPhiRequest(BaseModel):
    """批量Φ值计算请求"""
    items: List[InteractionData]
    mode: str = "standard"


# API端点
@app.get("/")
async def root():
    """根路径 - 健康检查"""
    return {
        "service": "AgentWeb Φ Engine",
        "status": "running",
        "version": "1.0.0",
        "timestamp": datetime.utcnow().isoformat()
    }


@app.get("/health")
async def health_check():
    """健康检查端点"""
    return {
        "status": "healthy",
        "calculator_mode": "standard",
        "timestamp": datetime.utcnow().isoformat()
    }


@app.post("/phi/calculate", response_model=PhiCalculateResponse)
async def calculate_phi(request: PhiCalculateRequest):
    """
    计算Φ值
    
    基于交互数据计算整合信息值
    """
    try:
        # 根据模式创建计算器
        if request.mode != "standard":
            calculator = PhiCalculatorFactory.create_calculator(request.mode)
        else:
            calculator = phi_calculator
        
        # 转换为字典
        interaction_dict = request.interaction_data.model_dump()
        
        # 转换内容特征
        features = None
        if request.content_features:
            import numpy as np
            features = np.array(request.content_features)
        
        # 执行计算
        result = calculator.calculate_phi(interaction_dict, features)
        
        logger.info(f"Φ calculation completed: {result['phi_value']:.4f}")
        
        return PhiCalculateResponse(**result)
        
    except Exception as e:
        logger.error(f"Φ calculation error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/phi/batch", response_model=List[PhiCalculateResponse])
async def batch_calculate_phi(request: BatchPhiRequest):
    """
    批量计算Φ值
    
    适用于大量内容的高效计算
    """
    try:
        calculator = PhiCalculatorFactory.create_calculator(request.mode)
        results = []
        
        for item in request.items:
            interaction_dict = item.model_dump()
            result = calculator.calculate_phi(interaction_dict)
            results.append(PhiCalculateResponse(**result))
        
        logger.info(f"Batch Φ calculation completed: {len(results)} items")
        
        return results
        
    except Exception as e:
        logger.error(f"Batch Φ calculation error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/phi/history/{user_id}")
async def get_phi_history(user_id: str):
    """
    获取用户Φ值历史记录
    
    从Redis缓存获取历史数据
    """
    # TODO: 从Redis获取历史记录
    return {
        "user_id": user_id,
        "history": [],
        "timestamp": datetime.utcnow().isoformat()
    }


@app.get("/phi/distribution")
async def get_phi_distribution():
    """
    获取全网Φ值分布统计
    """
    # TODO: 从数据库/Redis获取分布统计
    return {
        "total_users": 0,
        "average_phi": 0.0,
        "distribution": {
            "0-10": 0,
            "10-50": 0,
            "50-100": 0
        }
    }


# 启动事件
@app.on_event("startup")
async def startup_event():
    """应用启动时的初始化"""
    logger.info("AgentWeb Φ Engine starting...")
    logger.info(f"Calculator mode: standard")


# 关闭事件
@app.on_event("shutdown")
async def shutdown_event():
    """应用关闭时的清理"""
    logger.info("AgentWeb Φ Engine shutting down...")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "src.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True
    )
```

### 9.4 启动Φ引擎

```bash
cd agentweb/phi-engine

# 创建虚拟环境（推荐）
python3 -m venv venv
source venv/bin/activate  # Linux/macOS
# venv\Scripts\activate  # Windows

# 安装依赖
pip install -r requirements.txt

# 启动服务
uvicorn src.main:app --reload --host 0.0.0.0 --port 8000

# 或使用Python直接运行
python -m src.main
```

### 9.5 验证Φ引擎

```bash
# 健康检查
curl http://localhost:8000/health

# 测试Φ计算
curl -X POST http://localhost:8000/phi/calculate \
  -H "Content-Type: application/json" \
  -d '{
    "interaction_data": {
      "events": [
        {"value": 1.0, "timestamp": 0},
        {"value": 2.0, "timestamp": 1},
        {"value": 1.5, "timestamp": 2}
      ]
    }
  }'
```

---

## 10. 开发环境验证

### 10.1 验证清单

完成安装后，按以下清单验证各组件：

| # | 检查项 | 验证方法 | 预期结果 |
|---|--------|----------|----------|
| 1 | PostgreSQL连接 | `docker-compose logs postgres` 或 `pg_isready` | 健康状态 |
| 2 | Redis连接 | `docker-compose logs redis` 或 `redis-cli ping` | PONG响应 |
| 3 | 后端API | `curl http://localhost:3000/health` | JSON响应 |
| 4 | 前端应用 | 浏览器访问 http://localhost:5173 | Web界面 |
| 5 | Φ引擎 | `curl http://localhost:8000/health` | JSON响应 |
| 6 | 数据库迁移 | `npx prisma migrate status` | 所有迁移已应用 |
| 7 | API文档 | 浏览器访问 http://localhost:3000/api/docs | Swagger UI |

### 10.2 端到端测试

```bash
# 1. 创建测试用户
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "testpassword123"
  }'

# 2. 登录获取Token
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "testpassword123"
  }'

# 3. 创建DID
curl -X POST http://localhost:3000/api/v1/did/create \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "userId": "<user_id>"
  }'

# 4. 计算Φ值
curl -X POST http://localhost:8000/phi/calculate \
  -H "Content-Type: application/json" \
  -d '{
    "interaction_data": {
      "events": [
        {"value": 1.0, "timestamp": 0},
        {"value": 2.0, "timestamp": 1}
      ]
    }
  }'
```

---

## 11. 生产环境部署

### 11.1 生产环境架构

```
                    ┌─────────────────────────────────────────┐
                    │              Nginx Reverse Proxy         │
                    │         (SSL Termination, Load Balancer)  │
                    └─────────────────┬───────────────────────┘
                                      │
           ┌──────────────────────────┼──────────────────────────┐
           │                          │                          │
           ▼                          ▼                          ▼
┌─────────────────────┐  ┌─────────────────────┐  ┌─────────────────────┐
│   Frontend Server    │  │   Backend Server    │  │   Phi Engine       │
│   (Node.js Cluster)  │  │   (Node.js Cluster) │  │   (Python + Gunicorn)│
│   Port: 3001-3003    │  │   Port: 3001-3003   │  │   Port: 8001-8003  │
└─────────────────────┘  └─────────────────────┘  └─────────────────────┘
           │                          │                          │
           └──────────────────────────┼──────────────────────────┘
                                      │
                    ┌─────────────────┴───────────────────────┐
                    │                                         │
                    ▼                                         ▼
        ┌─────────────────────┐                  ┌─────────────────────┐
        │   PostgreSQL        │                  │   Redis Cluster      │
        │   (主从复制)         │                  │   (主从复制)         │
        │   Port: 5432        │                  │   Port: 6379        │
        └─────────────────────┘                  └─────────────────────┘
                    │
                    ▼
        ┌─────────────────────┐
        │   对象存储          │
        │   (S3/OSS)          │
        └─────────────────────┘
```

### 11.2 生产环境检查清单

#### 基础设施

- [ ] 服务器准备（推荐2核4G起步）
- [ ] 域名配置（DNS A记录）
- [ ] SSL证书配置（Let's Encrypt或商业证书）
- [ ] 防火墙规则配置

#### 数据库

- [ ] PostgreSQL主从复制配置
- [ ] Redis集群配置
- [ ] 定期备份策略
- [ ] 监控告警配置

#### 应用

- [ ] 环境变量配置（生产环境）
- [ ] 日志级别调整（error/warn）
- [ ] API限流配置
- [ ] CORS配置（限制来源）

#### 安全

- [ ] 数据库密码强度
- [ ] JWT密钥轮换
- [ ] API密钥管理
- [ ] 区块链私钥安全存储

### 11.3 生产部署脚本

`scripts/deploy-production.sh`:

```bash
#!/bin/bash
set -e

echo "=== AgentWeb Production Deployment ==="

# 1. 拉取最新代码
git pull origin main

# 2. 安装依赖
npm ci

# 3. 构建前端
cd frontend
npm ci
npm run build
cd ..

# 4. 构建后端
cd backend
npm ci
npm run build
cd ..

# 5. 数据库迁移
cd backend
npx prisma migrate deploy
cd ..

# 6. 重启服务
pm2 restart all

# 7. 健康检查
sleep 10
curl -f http://localhost:3000/health || exit 1

echo "=== Deployment Complete ==="
```

### 11.4 Docker生产部署

```bash
# 构建生产镜像
docker build -t agentweb/backend:latest ./backend
docker build -t agentweb/frontend:latest ./frontend
docker build -t agentweb/phi-engine:latest ./phi-engine

# 使用生产compose文件启动
docker-compose -f docker-compose.prod.yml up -d

# 查看日志
docker-compose -f docker-compose.prod.yml logs -f
```

---

## 12. 故障排除

### 12.1 常见问题及解决方案

#### 问题1: npm install 失败

**症状**: 安装依赖时出错

**解决方案**:
```bash
# 清理缓存
npm cache clean --force

# 删除node_modules重新安装
rm -rf node_modules package-lock.json
npm install

# 使用镜像源（如果网络问题）
npm config set registry https://registry.npmmirror.com
npm install
```

#### 问题2: PostgreSQL连接失败

**症状**: 后端无法连接到数据库

**解决方案**:
```bash
# 检查PostgreSQL状态
sudo systemctl status postgresql

# 检查连接配置
cat /etc/postgresql/*/main/pg_hba.conf

# 测试连接
psql -h localhost -U agentweb -d agentweb

# 查看日志
tail -f /var/log/postgresql/postgresql-*-main.log
```

#### 问题3: Redis连接失败

**症状**: 后端无法连接到Redis

**解决方案**:
```bash
# 检查Redis状态
sudo systemctl status redis-server

# 测试连接
redis-cli ping

# 检查配置
cat /etc/redis/redis.conf | grep requirepass

# 重启Redis
sudo systemctl restart redis-server
```

#### 问题4: 前端无法访问后端API

**症状**: 前端显示网络错误

**解决方案**:
1. 检查CORS配置（backend/.env）
2. 检查后端是否运行
3. 检查端口是否正确

```bash
# 检查后端进程
ps aux | grep "node.*backend"

# 检查端口占用
netstat -tlnp | grep 3000

# 查看后端日志
docker-compose logs backend
```

#### 问题5: Φ引擎计算超时

**症状**: Φ值计算请求超时

**解决方案**:
```bash
# 检查Φ引擎状态
curl http://localhost:8000/health

# 增加超时时间
# 编辑 src/calculator.py
# 增加 discretization_steps 或 time_horizon 的合理范围
```

#### 问题6: 区块链交易失败

**症状**: 智能合约调用失败

**解决方案**:
1. 确认私钥余额充足（测试网需测试币）
2. 检查网络配置（测试网/主网）
3. 验证合约地址配置正确

```bash
# 检查钱包余额
npx hardhat balance --address <address> --network sepolia

# 获取测试网ETH
# 访问 https://sepoliafaucet.com/
```

### 12.2 日志位置

| 组件 | 日志位置 | 查看命令 |
|------|----------|----------|
| 后端 | stdout / logs/app.log | `tail -f logs/app.log` |
| 前端 | 浏览器控制台 | F12 → Console |
| Φ引擎 | stdout | `docker-compose logs phi-engine` |
| PostgreSQL | /var/log/postgresql/ | `tail -f /var/log/postgresql/*.log` |
| Redis | stdout | `docker-compose logs redis` |
| Nginx | /var/log/nginx/ | `tail -f /var/log/nginx/*.log` |

### 12.3 性能调优

#### PostgreSQL优化

```sql
-- 启用查询缓存
ALTER SYSTEM SET shared_buffers = '256MB';
ALTER SYSTEM SET effective_cache_size = '1GB';
ALTER SYSTEM SET work_mem = '64MB';

-- 重载配置
SELECT pg_reload_conf();
```

#### Redis优化

```bash
# 修改redis.conf
maxmemory 512mb
maxmemory-policy allkeys-lru

# 重启Redis
sudo systemctl restart redis-server
```

#### Node.js优化

```bash
# 使用PM2集群模式
pm2 start npm --name "backend" -- start -i max

# PM2负载均衡
pm2 scale backend +2
```

---

## 13. 常见问题FAQ

### Q1: 如何重置数据库？

```bash
cd agentweb/backend

# 删除并重建数据库
npx prisma migrate reset

# 或手动重置
npx prisma migrate dev --name reset_db
```

### Q2: 如何查看数据库内容？

```bash
# 使用Prisma Studio
npx prisma studio

# 或使用psql
psql -U agentweb -d agentweb
```

### Q3: 如何更新区块链合约？

```bash
cd agentweb/blockchain

# 修改合约代码后重新部署
npx hardhat run scripts/deploy.ts --network sepolia

# 更新后端配置的合约地址
# 编辑 backend/.env
```

### Q4: 如何备份数据？

```bash
# PostgreSQL备份
pg_dump -U agentweb agentweb > backup_$(date +%Y%m%d).sql

# Redis备份
redis-cli SAVE

# 备份文件位于 /var/lib/redis/dump.rdb
```

### Q5: 如何扩展Φ引擎？

```bash
# 使用负载均衡器
# 或使用Kubernetes

# 水平扩展
kubectl scale deployment agentweb-phi --replicas=3
```

### Q6: 如何启用HTTPS？

```bash
# 使用Nginx配置SSL
sudo apt install nginx
sudo certbot --nginx -d yourdomain.com
```

---

## 附录

### A. 环境变量完整列表

| 变量名 | 描述 | 示例值 |
|--------|------|--------|
| `NODE_ENV` | 运行环境 | development/production |
| `PORT` | 后端端口 | 3000 |
| `DATABASE_URL` | PostgreSQL连接字符串 | postgresql://... |
| `REDIS_URL` | Redis连接字符串 | redis://localhost:6379 |
| `JWT_SECRET` | JWT签名密钥 | (随机字符串) |
| `JWT_EXPIRES_IN` | Token过期时间 | 7d |
| `ETH_RPC_URL` | Ethereum RPC地址 | https://... |
| `ETH_PRIVATE_KEY` | 部署私钥 | 0x... |
| `PHI_ENGINE_URL` | Φ引擎地址 | http://localhost:8000 |
| `VITE_API_URL` | 前端API地址 | http://localhost:3000 |

### B. 端口用途说明

| 端口 | 服务 | 用途 |
|------|------|------|
| 80/443 | Nginx | HTTP/HTTPS入口 |
| 3000 | Backend | REST API |
| 5173 | Frontend | 前端开发服务器 |
| 5432 | PostgreSQL | 数据库连接 |
| 6379 | Redis | 缓存和队列 |
| 8000 | Φ Engine | Φ计算API |
| 5555 | Prisma Studio | 数据库管理 |

### C. 联系与支持

- **技术支持**: tech-support@agentweb.io
- **文档反馈**: docs-feedback@agentweb.io
- **安全报告**: security@agentweb.io

---

**文档结束**

*本文档为AgentWeb v1.0.0安装指南，最后更新于2026年5月18日*
