# AgentWeb Sigma Cloud V2.0 — 安装与部署指南

> 完整安装步骤，涵盖 Docker 部署与本地开发环境搭建。

---

## 目录

1. [系统要求](#系统要求)
2. [方式一：Docker 部署（推荐）](#方式一docker-部署推荐)
3. [方式二：本地开发环境](#方式二本地开发环境)
4. [环境变量说明](#环境变量说明)
5. [数据库初始化](#数据库初始化)
6. [验证安装](#验证安装)
7. [常见问题](#常见问题)

---

## 系统要求

### 最低配置

| 组件 | 最低要求 | 推荐配置 |
|------|----------|----------|
| CPU | 4 核 | 8 核+ |
| 内存 | 8 GB | 16 GB+ |
| 磁盘 | 20 GB 可用 | 50 GB+ SSD |
| 网络 | 宽带连接 | 稳定宽带 |

### 软件依赖

#### Docker 方式
- Docker Desktop 4.20+
- Docker Compose v2.20+

#### 本地开发方式
| 软件 | 版本要求 | 用途 |
|------|----------|------|
| Node.js | ≥18.0 | 前端/后端/FPGA模拟器 |
| npm | ≥8.0 | 包管理 |
| Python | ≥3.10 | φ 引擎 |
| pip | ≥23.0 | Python 包管理 |
| PostgreSQL | ≥14.0 | 主数据库 |
| Redis | ≥6.0 | 缓存/会话 |
| Git | ≥2.30 | 版本控制 |
| Hardhat | ^2.22 | 区块链开发（可选） |

---

## 方式一：Docker 部署（推荐）

### 1. 克隆仓库

```bash
git clone https://github.com/lisoleg/AgentWeb.git
cd AgentWeb/agentweb
```

### 2. 配置环境变量

```bash
cp .env.example .env
```

编辑 `.env` 文件，关键配置项：

```env
# 数据库（Docker 内部网络）
DATABASE_URL="postgresql://postgres:postgres@postgres:5432/agentweb"

# Redis（Docker 内部网络）
REDIS_URL="redis://redis:6379"

# JWT 密钥（务必修改为随机字符串！）
JWT_SECRET="your-super-secret-jwt-key-change-this"

# 前端地址
CLIENT_URL="http://localhost:3000"

# φ 引擎地址
PHI_ENGINE_URL="http://phi-engine:8000"

# 区块链 RPC（本地 Hardhat）
BLOCKCHAIN_RPC_URL="http://blockchain:8545"
```

### 3. 启动服务

```bash
docker-compose up -d
```

### 4. 查看日志

```bash
docker-compose logs -f
```

### 5. 停止服务

```bash
docker-compose down
```

### 6. 重置数据库

```bash
docker-compose down -v   # 删除数据卷
docker-compose up -d
```

---

## 方式二：本地开发环境

### 1. 克隆仓库

```bash
git clone https://github.com/lisoleg/AgentWeb.git
cd AgentWeb/agentweb
```

### 2. 安装 Node.js 依赖

```bash
# 根目录 monorepo 依赖
npm install

# 各子包依赖（等同 npm run install:all）
npm run install:all
```

### 3. 配置环境变量

```bash
cp .env.example .env
```

编辑 `.env`，本地开发配置示例：

```env
# 本地 PostgreSQL
DATABASE_URL="postgresql://postgres:password@localhost:5432/agentweb"

# 本地 Redis
REDIS_URL="redis://localhost:6379"

# JWT 密钥
JWT_SECRET="dev-secret-key-only-for-local"

# 本地前端地址
CLIENT_URL="http://localhost:3000"

# 本地 φ 引擎
PHI_ENGINE_URL="http://localhost:8000"

# 本地区块链
BLOCKCHAIN_RPC_URL="http://localhost:8545"
```

### 4. 安装 Python 依赖（φ 引擎）

```bash
cd phi-engine
python -m venv venv
# Windows:
venv\Scripts\activate
# macOS/Linux:
# source venv/bin/activate

pip install -r requirements.txt
cd ..
```

### 5. 初始化数据库

```bash
cd backend

# 创建数据库（首次）
npx prisma migrate dev --name init

# 生成 Prisma Client
npx prisma generate

# （可选）填充种子数据
npx prisma db seed

cd ..
```

### 6. 编译区块链合约（可选）

```bash
cd blockchain
npm install
npx hardhat compile
cd ..
```

### 7. 启动各服务

打开 **5 个终端窗口**，分别运行：

```bash
# 终端 1：后端 API（端口 3001）
cd backend && npm run dev

# 终端 2：前端（端口 3000）
cd frontend && npm run dev

# 终端 3：φ 引擎（端口 8000）
cd phi-engine && uvicorn main:app --reload --host 0.0.0.0 --port 8000

# 终端 4：FPGA 模拟器（端口 4000）
cd fpga-emulator && npm run dev

# 终端 5：区块链本地节点（端口 8545）
cd blockchain && npx hardhat node
```

### 8. 访问服务

| 服务 | 地址 | 说明 |
|------|------|------|
| 前端 | http://localhost:3000 | 主界面 |
| 后端 API | http://localhost:3001/api | REST API |
| φ 引擎 | http://localhost:8000/docs | FastAPI 文档 |
| FPGA 模拟器 | http://localhost:4000 | 硬件模拟 |
| 区块链 | http://localhost:8545 | Hardhat 节点 |

---

## 环境变量说明

`.env` 完整配置项说明：

| 变量名 | 必填 | 说明 | 示例 |
|--------|------|------|------|
| `DATABASE_URL` | ✅ | PostgreSQL 连接串 | `postgresql://user:pass@localhost:5432/db` |
| `REDIS_URL` | ✅ | Redis 连接串 | `redis://localhost:6379` |
| `JWT_SECRET` | ✅ | JWT 签名密钥（随机字符串） | `x8fK...`（64字符） |
| `CLIENT_URL` | ✅ | 前端地址 | `http://localhost:3000` |
| `PHI_ENGINE_URL` | ✅ | φ 引擎地址 | `http://localhost:8000` |
| `BLOCKCHAIN_RPC_URL` | ⬜ | 区块链 RPC 地址 | `http://localhost:8545` |
| `PORT` | ⬜ | 后端端口（默认 3001） | `3001` |
| `NODE_ENV` | ⬜ | 环境模式 | `development` / `production` |
| `LOG_LEVEL` | ⬜ | 日志级别 | `info` / `debug` / `warn` |

> ⚠️ **生产环境务必修改 `JWT_SECRET`**，使用强随机密钥（建议 64 字符以上）。

---

## 数据库初始化

### Prisma Migrate 工作流

```bash
cd backend

# 首次创建迁移
npx prisma migrate dev --name init

# 后续修改 schema 后
npx prisma migrate dev --name add_user_bio

# 生产环境部署
npx prisma migrate deploy

# 重置数据库（⚠️ 会删除所有数据）
npx prisma migrate reset
```

### 查看数据库

```bash
# 打开 Prisma Studio（可视化数据库管理）
cd backend
npx prisma studio
# 自动打开 http://localhost:5555
```

### 种子数据

在 `backend/prisma/seed.ts` 中定义初始数据，然后运行：

```bash
cd backend
npx prisma db seed
```

---

## 验证安装

### 健康检查端点

```bash
# 后端健康检查
curl http://localhost:3001/api/health

# φ 引擎健康检查
curl http://localhost:8000/health
```

预期响应：
```json
{ "status": "ok", "timestamp": "2026-05-21T00:00:00.000Z" }
```

### 前端验证

1. 打开 http://localhost:3000
2. 应看到登录/注册页面
3. 注册新用户，验证邮件发送（如已配置）

### φ 引擎验证

打开 http://localhost:8000/docs，尝试调用 `/api/v1/phi/compute` 端点。

---

## 常见问题

### Q1：PostgreSQL 连接失败

**错误**：`Error: P1001: Can't reach database server`

**解决**：
```bash
# 检查 PostgreSQL 是否运行
pg_isready -h localhost -p 5432

# macOS (Homebrew)
brew services start postgresql

# Ubuntu/Debian
sudo systemctl start postgresql

# Windows
# 在"服务"中启动 postgresql-x64-14
```

### Q2：Redis 连接失败

**错误**：`Error: Redis connection refused`

**解决**：
```bash
# macOS
brew services start redis

# Ubuntu/Debian
sudo systemctl start redis

# 验证
redis-cli ping   # 应返回 PONG
```

### Q3：Prisma Migrate 失败

**错误**：`Error: P3006: Migration failed`

**解决**：
```bash
# 方案1：重置数据库（开发环境）
npx prisma migrate reset

# 方案2：手动修复迁移历史
npx prisma migrate resolve --rolled-back "20250521000000_init"
```

### Q4：φ 引擎启动失败（Python 依赖错误）

**解决**：
```bash
cd phi-engine
pip install --upgrade pip
pip install -r requirements.txt
# 如仍有错误，逐个安装：
pip install fastapi uvicorn numpy redis
```

### Q5：前端 npm run dev 报错（端口被占用）

**解决**：
```bash
# 查看占用 3000 端口的进程
# macOS/Linux:
lsof -i :3000
# Windows:
netstat -ano | findstr :3000

# 杀死进程后重启
```

### Q6：Docker 部署时 `node-gyp` 构建失败

**解决**：在 `docker-compose.yml` 中确保使用预构建镜像，或安装构建工具：
```bash
# Ubuntu/Debian 基础镜像中
apt-get update && apt-get install -y build-essential python3
```

### Q7：ActivityPub 联邦不工作

**检查**：
1. 确保服务器有公网可访问的域名/IP
2. 检查 `.env` 中 `CLIENT_URL` 配置正确
3. 验证防火墙开放了对应端口

---

## 生产环境部署注意事项

1. **HTTPS**：生产环境必须使用 HTTPS（推荐 Let's Encrypt + Nginx 反向代理）
2. **数据库**：使用托管 PostgreSQL（如 AWS RDS / 阿里云 RDS），定期备份
3. **Redis**：使用托管 Redis（如 ElastiCache），配置密码和 VPC
4. **JWT_SECRET**：使用强随机密钥，不要提交到代码仓库
5. **日志**：配置结构化日志收集（推荐 Winston + ELK）
6. **监控**：接入 Prometheus + Grafana 监控
7. **速率限制**：在 Nginx 或后端配置 API 速率限制

---

## 更新到最新版本

```bash
cd AgentWeb
git pull origin main
cd agentweb

# Docker 方式
docker-compose pull
docker-compose up -d

# 本地方式
npm install && npm run install:all
cd backend && npx prisma migrate deploy
cd ../phi-engine && pip install -r requirements.txt
# 重启所有服务
```

---

## 卸载

### Docker 方式
```bash
docker-compose down -v   # 停止并删除数据卷
docker system prune -f    # 清理未使用镜像
```

### 本地方式
```bash
# 删除 node_modules
cd agentweb && rm -rf node_modules */node_modules

# 删除数据库
dropdb agentweb   # PostgreSQL

# 删除 Redis 数据
redis-cli flushall
```

---

## 获取帮助

- GitHub Issues：https://github.com/lisoleg/AgentWeb/issues
- 邮箱：laotie@gmail.com
- 架构文档：参见 `AgentWeb_Architecture.md`
- 产品需求：参见 `AgentWeb_PRD.md`

---
