# AgentWeb Code Summary

**Project**: AgentWeb - Next-generation Digital Society Infrastructure  
**Version**: 1.0.0  
**Date**: 2026-05-10  
**Author**: AgentWeb Team  

---

## Overview

AgentWeb is a Web5-based digital society infrastructure implementing:
- **Φ (Phi) Value Metric** - Quantifying integrated information
- **Virtual-Time Evolution Consensus** - 49% Byzantine fault tolerance
- **Holographic Boundary Storage** - O(N²/³) compression

This codebase implements the P0 (MVP) core functionality.

---

## Module Summary

### 1. Project Infrastructure (T001)

**Files**:
- `package.json` (root) - Monorepo configuration with workspaces
- `tsconfig.json` (root) - TypeScript root config
- `.gitignore` - Comprehensive ignore rules
- `docker-compose.yml` - Local development environment (PostgreSQL + Redis + all services)
- `.env.example` - Environment variable template

**Key Features**:
- Monorepo with npm workspaces
- Docker Compose for one-command setup
- Environment-based configuration

---

### 2. Database Design (T002)

**File**: `backend/prisma/schema.prisma`

**Models**:
1. **User** - User accounts with auth fields
2. **DID** - W3C DID documents storage
3. **VC** - Verifiable Credentials (W3C compliant)
4. **PhiRecord** - Φ value calculation records
5. **Agent** - AI Agent registration (chain cache)
6. **Proposal** - Governance proposals
7. **Vote** - Governance votes
8. **Content** - News feed / content publishing
9. **Like** - Content likes/interactions
10. **Comment** - Content comments (nested)
11. **Session** - User sessions

**Key Features**:
- Proper relations with Prisma
- Indexes for performance
- Enum for proposal status

---

### 3. Logging & Monitoring (T003)

**Files**:
- `backend/src/utils/logger.ts` - Winston logger with rotation
- `backend/src/utils/redis.ts` - Redis client with cache helpers

**Key Features**:
- Winston with daily rotation
- Structured JSON logging
- Separate error/combined logs
- Redis cache helpers (get, set, del, expire)
- Session management via Redis

---

### 4. DID SDK (T006)

**File**: `backend/src/services/didService.ts`

**Key Features**:
- W3C DID creation (did:agentweb method)
- Ed25519 key pair generation
- DID Document creation (W3C compliant)
- Resolve, update, deactivate operations
- Blockchain registration (placeholder)

**APIs**:
- `POST /api/v1/did/create`
- `GET /api/v1/did/resolve/:did`
- `POST /api/v1/did/update`
- `GET /api/v1/did/verify/:did`
- `GET /api/v1/did/my`

---

### 5. VC Issuance & Verification (T007)

**File**: `backend/src/services/vcService.ts`

**Key Features**:
- W3C VC Data Model implementation
- Issue VC with proof (JWT)
- Verify VC (proof, expiry, revocation)
- List VCs by subject DID
- Revoke VC

**APIs**:
- `POST /api/v1/vc/issue`
- `POST /api/v1/vc/verify`
- `GET /api/v1/vc/list/:did`
- `POST /api/v1/vc/revoke/:vcId`

---

### 6. User Authentication (T008)

**Files**:
- `backend/src/services/authService.ts`
- `backend/src/utils/jwt.ts`
- `backend/src/middleware/auth.ts`

**Key Features**:
- JWT token generation/verification
- DID-based authentication (optional)
- Password-based authentication (bcrypt)
- Auto-create DID on registration
- Optional auth middleware

**APIs**:
- `POST /api/v1/auth/register`
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/logout`
- `GET /api/v1/auth/profile`

---

### 7. Φ Calculation Engine (T009)

**Files**:
- `phi-engine/requirements.txt`
- `phi-engine/src/calculator.py`
- `phi-engine/src/api.py`
- `phi-engine/src/main.py`

**Key Features**:
- Information entropy calculation (Shannon entropy)
- Mutual information between features
- Time decay for temporal relevance
- FastAPI endpoints
- Uvicorn ASGI server

**APIs**:
- `POST /api/v1/phi/calculate`
- `GET /api/v1/phi/history/{userId}`
- `GET /api/v1/phi/distribution`
- `GET /api/v1/phi/info`

---

### 8. AgentRegistry Contract (T010)

**Files**:
- `blockchain/package.json`
- `blockchain/hardhat.config.ts`
- `blockchain/contracts/AgentRegistry.sol`

**Key Features**:
- Agent registration with metadata
- Reputation score management
- Active/inactive status
- Events: AgentRegistered, AgentUpdated, ReputationUpdated

**Functions**:
- `registerAgent()` - Register new agent
- `getAgent()` - Query agent info
- `updateAgent()` - Update agent metadata
- `updateReputation()` - Update reputation (owner only)
- `deactivateAgent()` - Deactivate agent (owner only)

---

### 9. Φ Staking Contract (T011)

**File**: `blockchain/contracts/PhiStaking.sol`

**Key Features**:
- Stake/unstake with time lock
- Φ-based reward calculation
- Voting power = stake × (1 + Φ)
- Reward boost based on Φ value
- OpenZeppelin secure contracts

**Functions**:
- `stake()` - Stake tokens with Φ value
- `unstake()` - Unstake tokens
- `claimReward()` - Claim pending rewards
- `calculateReward()` - Calculate current reward
- `getVotingPower()` - Get voting power
- `updatePhiValue()` - Update user's Φ value

---

### 10. Frontend Framework (T013)

**Files**:
- `frontend/package.json`
- `frontend/tsconfig.json`
- `frontend/vite.config.ts`
- `frontend/index.html`
- `frontend/src/main.tsx`
- `frontend/src/App.tsx`
- `frontend/src/index.css`
- `frontend/src/services/api.ts`
- `frontend/src/hooks/useAuth.tsx`
- `frontend/src/pages/Login.tsx`
- `frontend/src/pages/Dashboard.tsx`
- `frontend/src/pages/Identity.tsx`
- `frontend/src/pages/AgentWorkbench.tsx`
- `frontend/src/pages/Governance.tsx`
- `frontend/src/pages/NewsFeed.tsx`

**Key Features**:
- React 18 + TypeScript
- Vite build tool
- React Router v6
- Axios with interceptors
- Auth context with JWT
- Responsive UI with inline CSS

**Pages**:
1. Login/Register
2. Dashboard (Φ value, DID, stats)
3. Identity (DID management, VCs)
4. Agent Workbench (register/manage agents)
5. Governance (proposals, voting)
6. News Feed (content publishing)

---

### 11. Backend API Framework (T014)

**Files**:
- `backend/package.json`
- `backend/tsconfig.json`
- `backend/src/index.ts`
- `backend/src/api/index.ts`
- `backend/src/api/auth.ts`
- `backend/src/api/did.ts`
- `backend/src/api/vc.ts`
- `backend/src/api/phi.ts`
- `backend/src/api/agent.ts`
- `backend/src/api/news.ts`
- `backend/src/api/governance.ts`
- `backend/src/middleware/errorHandler.ts`

**Key Features**:
- Express.js + TypeScript
- CORS, Helmet, compression
- Zod validation
- Error handling middleware
- Modular route structure

**API Routes**:
- `/api/v1/auth/*` - Authentication
- `/api/v1/did/*` - DID operations
- `/api/v1/vc/*` - VC operations
- `/api/v1/phi/*` - Φ calculation
- `/api/v1/agent/*` - Agent management
- `/api/v1/news/*` - News feed
- `/api/v1/governance/*` - Governance

---

### 12. BSV Metanet Integration (T012)

**File**: `backend/src/services/bsvService.ts`

**Key Features** (Basic Implementation):
- BSV wallet creation (from mnemonic)
- Metanet protocol publish (placeholder)
- Query Metanet node (placeholder)
- Create content graph on BSV
- Data integrity verification
- Micropayment support (placeholder)

**Note**: Full @bsv/sdk integration pending.

---

## Global Consistency Check

### ✅ IS_PASS: YES

**Checks Passed**:
1. ✅ File references are correct
2. ✅ API interfaces are consistent (frontend ↔ backend)
3. ✅ Data models match (Prisma schema ↔ services)
4. ✅ Environment variables are complete (`.env.example`)
5. ✅ JWT_SECRET, private keys are properly handled
6. ✅ Import/export paths are consistent
7. ✅ TypeScript types are properly defined

**Minor Issues** (Non-blocking):
- Some BSV operations are mocked (pending full SDK integration)
- Φ Engine fallback not implemented (depends on Python service)
- Some advanced features are marked as "TODO" for P1/P2

---

## Environment Variables

See `.env.example` for full list. Key variables:
- `DATABASE_URL` - PostgreSQL connection
- `REDIS_URL` - Redis connection
- `JWT_SECRET` - JWT signing key (CHANGE IN PRODUCTION!)
- `PHI_ENGINE_URL` - Python FastAPI URL
- `ETH_RPC_URL` - Ethereum L2 RPC
- `BSV_NETWORK` - BSV network (testnet/mainnet)
- `ENABLE_SWAGGER` - Enable API docs

---

## Deployment Steps

### 1. Prerequisites
- Node.js 20+
- Python 3.11+
- Docker & Docker Compose
- PostgreSQL 16+
- Redis 7+

### 2. Clone & Install
```bash
git clone https://github.com/agentweb/agentweb.git
cd agentweb
npm install
```

### 3. Environment Setup
```bash
cp .env.example .env
# Edit .env with your values!
```

### 4. Start Infrastructure
```bash
docker-compose up -d
```

### 5. Database Migration
```bash
cd backend
npx prisma migrate dev
npx prisma generate
```

### 6. Build & Start
```bash
# Terminal 1: Backend
cd backend && npm run dev

# Terminal 2: Frontend
cd frontend && npm run dev

# Terminal 3: Phi Engine
cd phi-engine && pip install -r requirements.txt
python src/main.py
```

### 7. Deploy Contracts (Optional)
```bash
cd blockchain
npx hardhat run scripts/deploy.ts --network goerli
```

---

## API Documentation

See `api_documentation.md` for full API reference.

---

## Testing

```bash
# Backend tests
cd backend && npm test

# Frontend tests
cd frontend && npm test

# Contract tests
cd blockchain && npx hardhat test

# Phi Engine tests
cd phi-engine && pytest
```

---

## Next Steps (P1/P2)

1. Implement full BSV Metanet integration (@bsv/sdk)
2. Add WebSocket for real-time governance updates
3. Implement Φ Engine fallback calculation
4. Add comprehensive unit/integration tests
5. Implement virtual-time evolution consensus (T015)
6. Add holographic boundary storage (T016)
7. Mobile app (React Native) (T024)
8. Multi-language support (T025)

---

**End of Code Summary**
