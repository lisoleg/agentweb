# AgentWeb - 西格玛云

基于Web5的下一代数字社会基础设施，构建人机和谐共存的数字共产主义新范式。

## 📋 项目简介

AgentWeb是一个创新的去中心化应用平台，整合了以下核心技术：

- **整合信息理论（Φ价值度量）**：统一的价值和智能度量标准
- **虚时演化共识**：突破拜占庭容错极限（49%容错）
- **全息边界存储**：O(N²/³)存储复杂度优化
- **W3C DID/VC标准**：去中心化身份和可验证凭证

## 🏗️ 技术架构

### 三层架构

```
┌─────────────────────────────────────────────────────┐
│                  人侧 (Yandex浏览器)                  │
│  ┌─────────────┐ ┌──────────────┐ ┌──────────────┐ │
│  │ 本地Φ引擎   │ │ 无感DID      │ │ 隐私保护     │ │
│  └─────────────┘ └──────────────┘ └──────────────┘ │
├─────────────────────────────────────────────────────┤
│                  机侧 (Ethereum L2)                 │
│  ┌─────────────┐ ┌──────────────┐ ┌──────────────┐ │
│  │ Agent注册   │ │ Φ Staking    │ │ ZKP验证     │ │
│  └─────────────┘ └──────────────┘ └──────────────┘ │
├─────────────────────────────────────────────────────┤
│                  天侧 (BSV区块链)                    │
│  ┌─────────────┐ ┌──────────────┐ ┌──────────────┐ │
│  │ Metanet协议 │ │ 微支付通道   │ │ SPV轻节点   │ │
│  └─────────────┘ └──────────────┘ └──────────────┘ │
└─────────────────────────────────────────────────────┘
```

### 技术栈

- **前端**: React 18 + TypeScript + Vite + Material-UI v5
- **后端**: Node.js + Express + TypeScript + Prisma ORM
- **区块链**: Solidity + Hardhat + ethers.js v6
- **Φ引擎**: Python + FastAPI + NumPy + SciPy
- **共识模块**: Rust (可选)
- **数据库**: PostgreSQL + Redis
- **存储**: IPFS (可选) + BSV Metanet

## 📁 项目结构

```
agentweb/
├── frontend/                 # 前端应用
│   ├── src/
│   │   ├── components/      # 可复用组件
│   │   │   ├── DIDDisplay.tsx
│   │   │   ├── VCList.tsx
│   │   │   ├── PhiDashboard.tsx
│   │   │   └── AgentCard.tsx
│   │   ├── pages/          # 页面组件
│   │   │   ├── Login.tsx
│   │   │   ├── Dashboard.tsx
│   │   │   ├── Identity.tsx
│   │   │   ├── AgentWorkbench.tsx
│   │   │   ├── Governance.tsx
│   │   │   └── NewsFeed.tsx
│   │   ├── services/       # API服务
│   │   ├── hooks/          # 自定义Hooks
│   │   ├── contexts/       # React Context
│   │   └── utils/          # 工具函数
│   └── package.json
├── backend/                 # 后端API服务
│   ├── src/
│   │   ├── api/           # API路由
│   │   ├── services/      # 业务逻辑
│   │   ├── middleware/    # 中间件
│   │   ├── utils/         # 工具函数
│   │   └── models/        # 数据模型
│   ├── prisma/
│   │   └── schema.prisma  # 数据库Schema
│   └── package.json
├── blockchain/              # 智能合约
│   ├── contracts/
│   │   ├── AgentRegistry.sol
│   │   └── PhiStaking.sol
│   ├── scripts/            # 部署脚本
│   ├── test/              # 测试
│   └── hardhat.config.ts
├── phi-engine/            # Φ计算引擎
│   ├── src/
│   │   ├── calculator.py
│   │   ├── api.py
│   │   └── main.py
│   └── requirements.txt
├── scripts/               # 工具脚本
├── docker-compose.yml      # Docker编排
├── package.json           # 根目录Monorepo配置
└── tsconfig.json          # TypeScript配置
```

## 🚀 快速开始

### 环境要求

- Node.js >= 18.0.0
- Python >= 3.11
- PostgreSQL >= 14
- Redis >= 6
- Docker & Docker Compose (可选)

### 安装步骤

#### 1. 克隆项目

```bash
git clone <repository-url>
cd agentweb
```

#### 2. 安装依赖

```bash
# 安装所有模块依赖
npm install

# 或分别安装
cd frontend && npm install
cd ../backend && npm install
cd ../phi-engine && pip install -r requirements.txt
```

#### 3. 配置环境变量

```bash
cp .env.example .env
```

编辑 `.env` 文件，配置以下环境变量：

```env
# 数据库配置
DATABASE_URL="postgresql://user:password@localhost:5432/agentweb"

# Redis配置
REDIS_URL="redis://localhost:6379"

# JWT配置
JWT_SECRET="your-secret-key"
JWT_EXPIRES_IN="7d"

# Ethereum配置
ETH_RPC_URL="https://mainnet.optimism.io"
ETH_PRIVATE_KEY="your-private-key"
CONTRACT_ADDRESS="your-contract-address"

# BSV配置
BSV_NODE_URL="https://api.bsvblockchain.com"
BSV_PRIVATE_KEY="your-bsv-private-key"

# Φ引擎配置
PHI_ENGINE_URL="http://localhost:8001"
```

#### 4. 启动服务

##### 使用Docker（推荐）

```bash
docker-compose up -d
```

##### 手动启动

```bash
# 启动PostgreSQL和Redis
docker-compose up -d postgres redis

# 初始化数据库
cd backend
npx prisma migrate deploy
npx prisma db seed

# 启动后端服务
npm run dev

# 新开终端 - 启动Φ引擎
cd phi-engine
uvicorn src.main:app --reload --port 8001

# 新开终端 - 启动前端
cd frontend
npm run dev
```

### 访问应用

- 前端应用: http://localhost:5173
- 后端API: http://localhost:3000
- Φ引擎API: http://localhost:8001
- API文档: http://localhost:3000/api/docs

## 📚 API文档

详细的API文档请参考 [api_documentation.md](api_documentation.md)。

### 主要API端点

#### 认证
- `POST /api/v1/auth/register` - 用户注册
- `POST /api/v1/auth/login` - 用户登录
- `POST /api/v1/auth/logout` - 用户登出

#### DID
- `POST /api/v1/did/create` - 创建DID
- `GET /api/v1/did/resolve/:did` - 解析DID
- `PUT /api/v1/did/update` - 更新DID

#### VC
- `POST /api/v1/vc/issue` - 签发VC
- `POST /api/v1/vc/verify` - 验证VC
- `GET /api/v1/vc/list` - 列出VC
- `POST /api/v1/vc/revoke` - 撤销VC

#### Φ计算
- `POST /api/v1/phi/calculate` - 计算Φ值

#### Agent
- `POST /api/v1/agent/register` - 注册Agent
- `GET /api/v1/agent/list` - 列出Agent
- `GET /api/v1/agent/:id` - 获取Agent详情

#### 治理
- `GET /api/v1/governance/proposals` - 列出提案
- `POST /api/v1/governance/proposals` - 创建提案
- `POST /api/v1/governance/vote` - 投票

## 🧪 测试

### 运行测试

```bash
# 所有测试
npm test

# 后端测试
cd backend && npm test

# 智能合约测试
cd blockchain && npx hardhat test

# Φ引擎测试
cd phi-engine && pytest
```

### 测试覆盖

- 单元测试：核心业务逻辑
- 集成测试：API端到端测试
- 智能合约测试：合约安全审计

## 📖 开发文档

- [PRD文档](../AgentWeb_PRD.md) - 产品需求文档
- [架构设计](../AgentWeb_Architecture.md) - 系统架构设计
- [代码摘要](code_summary.md) - 代码模块说明
- [API文档](api_documentation.md) - API详细文档

## 🤝 贡献指南

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 创建 Pull Request

## 📄 许可证

本项目采用 MIT 许可证 - 详见 [LICENSE](LICENSE) 文件

## 🙏 致谢

- 复合体理学研究院 - 理论基础
- W3C DID Working Group - DID/VC标准
- Ethereum Foundation - L2解决方案
- Bitcoin SV Association - Metanet协议

## 📞 联系我们

- 项目负责人: 高见远
- 团队: AgentWeb Development Team
- 邮箱: contact@agentweb.io

---

**AgentWeb** - 构建人机和谐的数字社会基础设施
