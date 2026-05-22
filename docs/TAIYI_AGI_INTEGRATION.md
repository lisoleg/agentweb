# 太乙AGI集成方案：M78/M84 API调用方式

## 1. 太乙AGI系统架构

### 运行时环境
- **语言**: Python 3.10+
- **框架**: FastAPI + Uvicorn
- **默认端口**: 9000
- **进程管理**: `python -m uvicorn api.phi_api:app --host 0.0.0.0 --port 9000 --reload`

### 核心文件结构
```
taiyi-agi/
├── api/
│   └── phi_api.py          # FastAPI REST API主入口
├── core/
│   ├── phi_core.py         # Φ场计算核心引擎 (IGCTR)
│   ├── module_registry.py  # M1-M125 模块注册中心
│   └── theorem_registry.py # T1-T85 定理注册中心
├── fediverse_actor.py      # ActivityPub联邦Actor
└── chen_test_fediverse.py  # CHEN_TEST联邦集成测试
```

## 2. API端点清单

| 端点 | 方法 | 用途 | V6.0调用方 |
|------|------|------|-----------|
| `/health` | GET | 健康检查 | blockchainService |
| `/api/v1/phi/compute` | POST | IGCTR三元共振Φ计算 | liuPrincipleSolver |
| `/api/v1/modules/list` | GET | 列出可用模块 | phiAgentService |
| `/api/v1/modules/{id}` | GET | 获取模块详情 | phiAgentService |
| `/api/v1/modules/invoke` | POST | 调用指定模块 | hottReasoningGateway |
| `/api/v1/theorems/list` | GET | 列出定理 | consciousnessVerifier |
| `/api/v1/theorems/verify` | POST | 定理验证(Lean4) | consciousnessVerifier |
| `/api/v1/token/balance` | POST | 查询四令牌余额 | phiMicropayment |
| `/api/v1/progress` | GET | AGI整体进度 | Dashboard |

## 3. M78集成方案

### 调用方式
```typescript
// hottReasoningGateway.ts 中的M78调用
async function callM78Reasoning(typeInfo: TypeInformation, payload: any): Promise<HoTTReasoningResult> {
  const response = await fetch(`${TAIYI_AGI_URL}/api/v1/modules/invoke`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      module_id: 'M78',    // M78 HoTT推理模块
      input_data: {
        type_information: typeInfo,
        request_payload: payload,
        max_proof_depth: 20,
      },
      timeout_ms: 5000,
    }),
  });
  const result = await response.json();
  return mapM78ToGatewayDecision(result);
}
```

### 注意事项
- **M78模块当前尚未实现**：taiyi-agi的module_registry.py中仅定义了M1-M125的元数据，M78的实际推理逻辑需要开发
- **降级方案**：M78不可用时回退至V2.1的规则匹配Φ-Gateway
- **配置**: `TAIYI_AGI_URL` 通过环境变量设置，默认 `http://localhost:9000`

## 4. M84集成方案

### 调用方式
```typescript
// liuPrincipleSolver.ts 中的M84调用
async function callM84PhiCompute(iField: any, cField: any, gField: any): Promise<PhiComputeResult> {
  const response = await fetch(`${TAIYI_AGI_URL}/api/v1/phi/compute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      i_field: iField,
      c_field: cField,
      g_field: gField,
      calc_budget: 1000,
      use_fpga: false,
      return_details: true,
    }),
  });
  const result = await response.json();
  return mapPhiComputeToThreeHorizon(result);
}
```

### 三视界展开映射
```
太乙AGI phi_compute返回 → liuPrincipleSolver三视界展开
  phi_value → Φ_present (实时IGCTR计算)
  历史序列(EWMA) → Φ_past (经验记忆)
  太乙预言机公式 → Φ_future (预测推演)
```

### 注意事项
- `/api/v1/phi/compute` 已实现（phi_core.py），返回IGCTR三元共振Φ值
- 三视界展开中，Φ_present直接使用返回的phi_value
- Φ_past和Φ_future由Σ-Cloud本地计算（不依赖太乙AGI）
- 仅Φ_present需要跨服务调用

## 5. 部署架构

### 推荐方式：独立进程 + HTTP REST
```
┌───────────────────────────────┐
│ Σ-Cloud Backend (Express)     │
│ Port: 3001                     │
│                                │
│ hottReasoningGateway.ts ────┐ │
│ liuPrincipleSolver.ts ──────┤ │
│ phiAgentService.ts ─────────┤ │
│ consciousnessVerifier.ts ───┤ │
└─────────────────────────────┼─┘
                              │ HTTP REST
                              ▼
┌───────────────────────────────┐
│ 太乙AGI FastAPI               │
│ Port: 9000                    │
│                               │
│ phi_core.py (IGCTR引擎)       │
│ module_registry.py (M1-M125)  │
│ theorem_registry.py (T1-T85)  │
└───────────────────────────────┘
```

### 替代方案：SDK嵌入（不推荐）
- 优点：零网络延迟
- 缺点：Python/TypeScript跨语言、进程管理复杂、不利于独立升级
- 结论：HTTP REST是更稳定的集成方式

## 6. 环境变量配置

```env
# 太乙AGI服务地址
TAIYI_AGI_URL=http://localhost:9000

# M78推理超时(ms)
M78_REASONING_TIMEOUT=5000

# M84计算预算
M84_CALC_BUDGET=1000

# 降级开关（太乙AGI不可用时自动降级）
TAIYI_AGI_FALLBACK_ENABLED=true
```

## 7. 待开发项

| 优先级 | 项目 | 说明 |
|--------|------|------|
| P0 | M78 HoTT推理模块实现 | 太乙AGI的module_registry仅注册元数据，需开发prove(G)/wait()推理逻辑 |
| P0 | `/api/v1/modules/invoke` 路由扩展 | 当前invoke仅支持6个模块的简化处理，需扩展M78/M84路由 |
| P1 | 认证/授权机制 | 当前API无认证（`HTTPBearer(auto_error=False)`），生产环境需添加 |
| P1 | WebSocket支持 | 实时Φ流更新更适合WebSocket而非HTTP轮询 |
| P2 | gRPC接口 | 高频调用场景下gRPC比HTTP REST更高效 |
