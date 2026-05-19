# AgentWeb API Documentation

**Version**: 1.0.0  
**Base URL**: `http://api.agentweb.io/api/v1` (Production) | `http://localhost:3000/api/v1` (Development)  

---

## Authentication

Most API endpoints require authentication. Include the JWT token in the `Authorization` header:

```
Authorization: Bearer <your_jwt_token>
```

### Getting a Token

**POST** `/api/v1/auth/login`

```json
{
  "username": "your_username",
  "password": "your_password"
}
```

Response:
```json
{
  "code": 0,
  "data": {
    "user": { "id": "...", "username": "..." },
    "token": "eyJhb...",
    "refreshToken": "..."
  }
}
```

---

## API Endpoints

### 1. Authentication (`/api/v1/auth`)

| Method | Endpoint | Description | Auth Required |
|-------|----------|-------------|---------------|
| POST | `/register` | Register new user | No |
| POST | `/login` | Login user | No |
| POST | `/logout` | Logout user | Yes |
| GET | `/profile` | Get current user profile | Yes |

#### POST /register
```json
// Request
{
  "username": "string (3-50 chars)",
  "email": "string (optional, valid email)",
  "password": "string (min 8 chars, optional)"
}

// Response
{
  "code": 0,
  "message": "Registration successful",
  "data": {
    "user": { "id": "...", "username": "...", "did": "..." },
    "token": "...",
    "refreshToken": "..."
  }
}
```

#### POST /login
```json
// Request
{
  "username": "string",
  "password": "string (optional for DID auth)",
  "did": "string (optional, for DID auth)"
}

// Response
{
  "code": 0,
  "message": "Login successful",
  "data": {
    "user": { "id": "...", "username": "...", "did": "..." },
    "token": "...",
    "refreshToken": "..."
  }
}
```

---

### 2. DID (`/api/v1/did`)

| Method | Endpoint | Description | Auth Required |
|-------|----------|-------------|---------------|
| POST | `/create` | Create new DID | Yes |
| GET | `/resolve/:did` | Resolve DID to document | No |
| POST | `/update` | Update DID document | Yes |
| GET | `/verify/:did` | Verify DID ownership | Yes |
| GET | `/my` | Get current user's DID | Yes |

#### POST /create
```json
// Request
{
  "userId": "string",
  "metadata": { "optional": "object" }
}

// Response
{
  "code": 0,
  "data": {
    "did": "did:agentweb:z...",
    "document": { "@context": [...], "id": "...", ... },
    "created": "2026-05-10T...",
    "updated": "2026-05-10T..."
  }
}
```

#### GET /resolve/:did
```json
// Response
{
  "code": 0,
  "data": {
    "did": "did:agentweb:z...",
    "document": {
      "@context": ["https://www.w3.org/ns/did/v1", ...],
      "id": "did:agentweb:z...",
      "verificationMethod": [...],
      "authentication": [...],
      "service": [...]
    },
    "created": "2026-05-10T...",
    "updated": "2026-05-10T..."
  }
}
```

---

### 3. Verifiable Credential (`/api/v1/vc`)

| Method | Endpoint | Description | Auth Required |
|-------|----------|-------------|---------------|
| POST | `/issue` | Issue new VC | Yes |
| POST | `/verify` | Verify VC | No |
| GET | `/list/:did` | List VCs for a DID | Yes |
| POST | `/revoke/:vcId` | Revoke a VC | Yes |

#### POST /issue
```json
// Request
{
  "issuer": "did:agentweb:z...",
  "subject": {
    "id": "did:agentweb:z...",
    "claims": { "name": "..." }
  },
  "type": ["VerifiableCredential"],
  "expirationDate": "2027-05-10T..."
}

// Response
{
  "code": 0,
  "data": {
    "vc": {
      "@context": [...],
      "id": "urn:uuid:...",
      "type": [...],
      "issuer": "...",
      "credentialSubject": {...},
      "proof": {...}
    }
  }
}
```

#### POST /verify
```json
// Request
{
  "vc": {
    "@context": [...],
    "id": "...",
    "type": [...],
    "issuer": "...",
    "credentialSubject": {...},
    "proof": {...}
  }
}

// Response
{
  "code": 0,
  "data": {
    "valid": true,
    "checks": ["structure-valid", "issuer-did-exists", "proof-valid", "not-expired", "not-revoked"],
    "claims": { "name": "..." }
  }
}
```

---

### 4. Phi (Φ) (`/api/v1/phi`)

| Method | Endpoint | Description | Auth Required |
|-------|----------|-------------|---------------|
| POST | `/calculate` | Calculate Φ value | No (calls Phi Engine) |
| GET | `/history/:userId` | Get Φ history | Yes |
| GET | `/distribution` | Get Φ distribution stats | No |

#### POST /calculate
```json
// Request
{
  "interactionData": {
    "user_id": "user_123",
    "mouse_events": [1, 2, 3],
    "keyboard_events": [0, 1, 0],
    "timestamps": [0, 1, 2, 3]
  },
  "contentId": "content_456 (optional)"
}

// Response
{
  "code": 0,
  "data": {
    "user_id": "user_123",
    "phi_value": 0.754321,
    "timestamp": "2026-05-10T...",
    "details": {
      "features": { "mouse_entropy": 0.9, "keyboard_entropy": 0.8 },
      "raw_phi": 0.85,
      "normalized_phi": 0.754321,
      "time_delta_seconds": 0,
      "decay_applied": false
    }
  }
}
```

---

### 5. Agent (`/api/v1/agent`)

| Method | Endpoint | Description | Auth Required |
|-------|----------|-------------|---------------|
| POST | `/register` | Register new agent | Yes |
| GET | `/list` | List all active agents | No |
| GET | `/:agentId` | Get agent details | No |
| POST | `/update` | Update agent info | Yes (owner only) |

#### POST /register
```json
// Request
{
  "name": "My AI Agent",
  "description": "An AI agent for...",
  "endpoint": "https://api.example.com/agent",
  "capabilities": ["text-generation", "sentiment-analysis"],
  "contractAgentId": "agent_... (optional)"
}

// Response
{
  "code": 0,
  "data": {
    "agentId": "agent_...",
    "name": "My AI Agent",
    "description": "...",
    "endpoint": "...",
    "capabilities": [...],
    "reputation": 0,
    "active": true,
    "registeredAt": "2026-05-10T..."
  }
}
```

#### GET /list
```json
// Response
{
  "code": 0,
  "data": {
    "agents": [
      {
        "agentId": "agent_...",
        "name": "Agent Name",
        "description": "...",
        "endpoint": "...",
        "capabilities": [...],
        "reputation": 85.5,
        "owner": "username",
        "registeredAt": "2026-05-10T..."
      }
    ]
  }
}
```

---

### 6. News Feed (`/api/v1/news`)

| Method | Endpoint | Description | Auth Required |
|-------|----------|-------------|---------------|
| GET | `/feed` | Get news feed | No (optional auth) |
| POST | `/publish` | Publish content | Yes |
| POST | `/interact` | Like/comment/interact | Yes |
| GET | `/:contentId` | Get single content | No |

#### POST /publish
```json
// Request
{
  "title": "Article Title",
  "body": "Article content...",
  "contentHash": "sha256... (optional)",
  "bsvTxId": "bsv_tx_id (optional)",
  "phiValue": 0.85,
  "metadata": { "tags": ["ai", "web3"] }
}

// Response
{
  "code": 0,
  "data": {
    "contentId": "content_...",
    "id": "uuid...",
    "publishedAt": "2026-05-10T..."
  }
}
```

#### POST /interact
```json
// Request
{
  "contentId": "content_...",
  "type": "like | unlike | comment",
  "data": { "body": "Comment text (for comment type)" }
}

// Response
{
  "code": 0,
  "message": "Interaction successful"
}
```

---

### 7. Governance (`/api/v1/governance`)

| Method | Endpoint | Description | Auth Required |
|-------|----------|-------------|---------------|
| POST | `/propose` | Create proposal | Yes |
| POST | `/vote` | Vote on proposal | Yes |
| GET | `/list` | List proposals | No |
| GET | `/:proposalId` | Get proposal details | No |

#### POST /propose
```json
// Request
{
  "description": "Proposal description...",
  "calldata": "0x... (optional)",
  "deadlineDays": 7
}

// Response
{
  "code": 0,
  "data": {
    "proposalId": "proposal_...",
    "id": "uuid...",
    "status": "Active",
    "deadline": "2026-05-17T..."
  }
}
```

#### POST /vote
```json
// Request
{
  "proposalId": "proposal_...",
  "support": true
}

// Response
{
  "code": 0,
  "message": "Vote cast successfully"
}
```

#### GET /list
```json
// Response
{
  "code": 0,
  "data": {
    "proposals": [
      {
        "proposalId": "proposal_...",
        "description": "...",
        "creator": "username",
        "status": "Active",
        "forVotes": 150.5,
        "againstVotes": 49.5,
        "totalVotes": 200,
        "createdAt": "2026-05-10T...",
        "deadline": "2026-05-17T..."
      }
    ]
  }
}
```

---

## Error Codes

| Code | Description | HTTP Status |
|------|-------------|--------------|
| 0 | Success | 200 |
| 1001 | Invalid parameter | 400 |
| 1002 | Unauthorized | 401 |
| 1003 | Forbidden | 403 |
| 1004 | Resource not found | 404 |
| 2001 | DID already exists | 409 |
| 2002 | VC verification failed | 400 |
| 2003 | Φ calculation error | 500 |
| 2004 | Contract call failed | 500 |
| 2005 | BSV on-chain failed | 500 |
| 3001 | Rate limit exceeded | 429 |

### Error Response Format

```json
{
  "code": 1001,
  "message": "Invalid parameter: username is required",
  "details": {
    "field": "username",
    "reason": "missing"
  }
}
```

---

## Rate Limiting

- **Window**: 15 minutes (900,000 ms)
- **Max Requests**: 100 per IP
- **Headers**: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`

When rate limit exceeded:
```json
{
  "code": 3001,
  "message": "请求过于频繁，请稍后再试"
}
```

---

## Pagination

For list endpoints that support pagination:

**Query Parameters**:
- `limit` (default: 20, max: 100)
- `offset` (default: 0)

**Response**:
```json
{
  "code": 0,
  "data": {
    "items": [...],
    "limit": 20,
    "offset": 0,
    "total": 150
  }
}
```

---

## Health Check

**GET** `/health`

```json
{
  "status": "ok",
  "timestamp": "2026-05-10T...",
  "uptime": 12345.67,
  "version": "1.0.0",
  "environment": "development"
}
```

---

## Phi Engine Endpoints (Python FastAPI)

Base URL: `http://localhost:8000`

| Method | Endpoint | Description |
|-------|----------|-------------|
| GET | `/` | Root info |
| GET | `/health` | Health check |
| POST | `/api/v1/phi/calculate` | Calculate Φ value |
| GET | `/api/v1/phi/info` | Get Φ calculation info |
| GET | `/api/v1/phi/history/{user_id}` | Get Φ history |
| GET | `/api/v1/phi/distribution` | Get Φ distribution |

Full documentation available at: `http://localhost:8000/docs` (Swagger UI)

---

## Smart Contracts (Ethereum L2)

### AgentRegistry

**Network**: Optimism Goerli (test) / Optimism Mainnet

**Functions**:
- `registerAgent(agentId, name, description, endpoint, capabilities)`
- `getAgent(agentId)` → returns agent info
- `updateAgent(agentId, name, description, endpoint, capabilities)`
- `updateReputation(agentId, delta)` (owner only)
- `deactivateAgent(agentId)` (owner only)

### PhiStaking

**Functions**:
- `stake(amount, phiValue)` - Stake tokens with Φ value
- `unstake(amount)` - Unstake tokens
- `claimReward()` - Claim pending rewards
- `calculateReward(user)` → returns pending reward
- `getVotingPower(user)` → returns voting power
- `updatePhiValue(newPhiValue)` - Update Φ value

---

## SDKs & Tools

### JavaScript/TypeScript
```bash
npm install ethers @bsv/sdk
```

### Python
```bash
pip install fastapi uvicorn
```

---

## Interactive API Documentation

When `ENABLE_SWAGGER=true` in `.env`:

- **Swagger UI**: `http://localhost:3000/api-docs`
- **ReDoc**: `http://localhost:3000/redoc`
- **OpenAPI JSON**: `http://localhost:3000/openapi.json`

---

**End of API Documentation**
