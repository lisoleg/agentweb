"""
西格玛云 φ引擎 — 太乙AGI 桥接层
将 AGI 的 Φ场计算能力接入西格玛云
Fallback 策略：AGI 不可用时自动切换本地计算
"""

import asyncio
import time
from typing import Dict, List, Optional, Any
from dataclasses import dataclass
import httpx
import numpy as np

# ── 配置 ───────────────────────────────
AGI_BACKEND_URL = "http://localhost:9000"   # 太乙AGI后端地址
AGI_TIMEOUT = 10.0                        # 超时（秒）
AGI_ENABLED = True                         # 是否启用AGI后端
AGI_FALLBACK = True                       # 不可用时是否fallback


@dataclass
class PhiComputeRequest:
    i_field: Dict[str, Any]
    c_field: Dict[str, Any]
    g_field: Dict[str, Any]
    calc_budget: int = 1000
    use_fpga: bool = False
    return_details: bool = True


@dataclass
class PhiComputeResult:
    phi_value: float
    resonance_score: float
    active_modules: List[str]
    proved_theorems: List[str]
    igctr_terms: Optional[Dict[str, float]] = None
    execution_time_ms: float = 0.0
    source: str = "local"   # "agi" or "local"
    agi_backend_reachable: bool = False


class TaiyiBridge:
    """
    太乙AGI 桥接器
    
    功能：
    1. 将西格玛云的 Φ场计算请求转发到太乙AGI后端
    2. AGI不可用时自动 fallback 到本地 NumPy 计算
    3. 支持批量计算、异步并发
    4. 健康检查与自动恢复
    """
    
    def __init__(
        self,
        agi_url: str = AGI_BACKEND_URL,
        timeout: float = AGI_TIMEOUT,
        enable_fallback: bool = AGI_FALLBACK,
    ):
        self.agi_url = agi_url.rstrip("/")
        self.timeout = timeout
        self.enable_fallback = enable_fallback
        self._client: Optional[httpx.AsyncClient] = None
        self._healthy: Optional[bool] = None
        self._last_health_check: float = 0.0
        self._health_check_interval: float = 30.0  # 30秒检查一次
        self._stats = {
            "total_requests": 0,
            "agi_success": 0,
            "agi_fallback": 0,
            "agi_errors": 0,
        }
    
    async def __aenter__(self):
        self._client = httpx.AsyncClient(timeout=self.timeout)
        return self
    
    async def __aexit__(self, *_):
        if self._client:
            await self._client.aclose()
    
    # ── 健康检查 ─────────────────────────
    
    async def health_check(self) -> bool:
        """检查太乙AGI后端健康状态"""
        now = time.time()
        if self._healthy is not None and (now - self._last_health_check) < self._health_check_interval:
            return self._healthy
        
        try:
            if self._client is None:
                self._client = httpx.AsyncClient(timeout=5.0)
            
            resp = await self._client.get(f"{self.agi_url}/health")
            if resp.status_code == 200:
                data = resp.json()
                self._healthy = data.get("status") == "ok"
            else:
                self._healthy = False
        except (httpx.TimeoutException, httpx.ConnectError, Exception):
            self._healthy = False
        
        self._last_health_check = now
        return self._healthy is True
    
    # ── 主计算接口 ─────────────────────
    
    async def compute_phi(
        self,
        i_field: Dict,
        c_field: Dict,
        g_field: Dict,
        calc_budget: int = 1000,
        use_fpga: bool = False,
    ) -> PhiComputeResult:
        """
        Φ场计算（优先AGI后端，fallback本地）
        
        参数：
            i_field: 信息场 {"user_embeddings": [...], "interaction_matrix": [...]}
            c_field: 意识场 {"phi_values": [...], "module_activations": {...}}
            g_field: 几何场 {"adjacency_matrix": [...], "fpga_config": {...}}
        
        返回：
            PhiComputeResult，source字段指示数据来源（"agi" or "local"）
        """
        self._stats["total_requests"] += 1
        
        # 尝试 AGI 后端
        if AGI_ENABLED:
            result = await self._try_agi_backend(
                i_field, c_field, g_field, calc_budget, use_fpga
            )
            if result is not None:
                self._stats["agi_success"] += 1
                return result
        
        # Fallback
        if self.enable_fallback:
            self._stats["agi_fallback"] += 1
            return await self._local_compute(
                i_field, c_field, g_field, calc_budget
            )
        
        raise RuntimeError("AGI后端不可用且fallback已禁用")
    
    async def _try_agi_backend(
        self,
        i_field: Dict,
        c_field: Dict,
        g_field: Dict,
        calc_budget: int,
        use_fpga: bool,
    ) -> Optional[PhiComputeResult]:
        """尝试调用太乙AGI后端"""
        if not await self.health_check():
            return None
        
        try:
            if self._client is None:
                self._client = httpx.AsyncClient(timeout=self.timeout)
            
            payload = {
                "i_field": i_field,
                "c_field": c_field,
                "g_field": g_field,
                "calc_budget": calc_budget,
                "use_fpga": use_fpga,
                "return_details": True,
            }
            
            t0 = time.time()
            resp = await self._client.post(
                f"{self.agi_url}/api/v1/phi/compute",
                json=payload
            )
            elapsed = (time.time() - t0) * 1000
            
            if resp.status_code == 200:
                data = resp.json()
                return PhiComputeResult(
                    phi_value=data["phi_value"],
                    resonance_score=data["resonance_score"],
                    active_modules=data["active_modules"],
                    proved_theorems=data["proved_theorems"],
                    igctr_terms=data.get("igctr_terms"),
                    execution_time_ms=data.get("execution_time_ms", elapsed),
                    source="agi",
                    agi_backend_reachable=True,
                )
            else:
                self._stats["agi_errors"] += 1
                return None
                
        except (httpx.TimeoutException, httpx.ConnectError, Exception) as e:
            self._healthy = False
            self._stats["agi_errors"] += 1
            return None
    
    async def _local_compute(
        self,
        i_field: Dict,
        c_field: Dict,
        g_field: Dict,
        calc_budget: int,
    ) -> PhiComputeResult:
        """
        本地 Φ场计算（NumPy 实现）
        作为 AGI 后端不可用时的 fallback
        """
        t0 = time.time()
        
        # ── I场贡献 ──
        i_entropy = self._calc_entropy(i_field)
        delta_i = i_entropy * 0.1
        
        # ── C场贡献 ──
        phi_values = np.array(c_field.get("phi_values", [0.5]))
        c_module_act = c_field.get("module_activations", {})
        n_active = len([v for v in c_module_act.values() if v > 0.5])
        delta_c = float(phi_values.mean()) * 0.01 + n_active * 0.5 if len(phi_values) > 0 else 0.0
        
        # ── G场贡献 ──
        adj = np.array(g_field.get("adjacency_matrix", [[0]]))
        g_curvature = float(np.trace(adj)) * 0.01 if adj.ndim == 2 else 0.0
        delta_g = g_curvature * 0.1
        
        # ── IGCTR ──
        alpha, beta, gamma = 0.35, 0.40, 0.25
        phi = float(phi_values.mean()) if len(phi_values) > 0 else 0.5
        phi += alpha * delta_i + beta * delta_c + gamma * delta_g
        phi = max(0.0, min(100.0, phi))
        
        # ── 共振 ──
        resonance = min(1.0, (delta_i + delta_c + delta_g) / 3.0)
        
        elapsed = (time.time() - t0) * 1000
        
        return PhiComputeResult(
            phi_value=round(phi, 4),
            resonance_score=round(resonance, 4),
            active_modules=list(c_module_act.keys())[:5],
            proved_theorems=[],
            igctr_terms={
                "alpha_delta_I": round(alpha * delta_i, 6),
                "beta_delta_C": round(beta * delta_c, 6),
                "gamma_delta_G": round(gamma * delta_g, 6),
            },
            execution_time_ms=round(elapsed, 2),
            source="local",
            agi_backend_reachable=False,
        )
    
    def _calc_entropy(self, i_field: Dict) -> float:
        """信息熵计算"""
        interaction = np.array(i_field.get("interaction_matrix", [[]]))
        if interaction.size == 0 or interaction.max() == 0:
            return 0.0
        p = interaction.flatten() / (interaction.sum() + 1e-10)
        p = p[p > 0]
        return float(-(p * np.log(p)).sum())
    
    # ── 模块调用接口 ─────────────────────
    
    async def invoke_module(
        self,
        module_id: str,
        input_data: Dict,
        timeout_ms: int = 30000,
    ) -> Dict:
        """
        调用太乙AGI指定模块（M1-M125）
        Fallback：返回通用响应
        """
        if not await self.health_check():
            return self._local_module_fallback(module_id, input_data)
        
        try:
            if self._client is None:
                self._client = httpx.AsyncClient(timeout=self.timeout)
            
            resp = await self._client.post(
                f"{self.agi_url}/api/v1/modules/invoke",
                json={
                    "module_id": module_id,
                    "input_data": input_data,
                    "timeout_ms": timeout_ms,
                }
            )
            if resp.status_code == 200:
                return resp.json()
        except Exception:
            pass
        
        return self._local_module_fallback(module_id, input_data)
    
    def _local_module_fallback(self, module_id: str, input_data: Dict) -> Dict:
        """模块调用本地fallback"""
        return {
            "module_id": module_id,
            "output": {"response": f"模块 {module_id} 本地fallback响应", "note": "AGI后端不可用"},
            "phi_contribution": 0.1,
            "execution_time_ms": 10.0,
            "source": "local_fallback",
        }
    
    # ── 定理查询接口 ─────────────────────
    
    async def list_theorems(self, status: Optional[str] = None) -> List[Dict]:
        """查询 AGI 定理列表"""
        if not await self.health_check():
            return []
        
        try:
            if self._client is None:
                self._client = httpx.AsyncClient(timeout=self.timeout)
            
            params = {}
            if status:
                params["status"] = status
            
            resp = await self._client.get(
                f"{self.agi_url}/api/v1/theorems/list",
                params=params
            )
            if resp.status_code == 200:
                return resp.json().get("theorems", [])
        except Exception:
            pass
        
        return []
    
    # ── 统计信息 ─────────────────────────
    
    def get_stats(self) -> Dict:
        """获取桥接器统计信息"""
        total = self._stats["total_requests"]
        agi_rate = self._stats["agi_success"] / max(1, total)
        return {
            "agi_backend_url": self.agi_url,
            "agi_healthy": self._healthy,
            "total_requests": total,
            "agi_success_count": self._stats["agi_success"],
            "agi_fallback_count": self._stats["agi_fallback"],
            "agi_error_count": self._stats["agi_errors"],
            "agi_success_rate": round(agi_rate, 4),
            "fallback_enabled": self.enable_fallback,
        }


# ── 全局单例 ─────────────────────────────

_bridge_instance: Optional[TaiyiBridge] = None

def get_taiyi_bridge() -> TaiyiBridge:
    global _bridge_instance
    if _bridge_instance is None:
        _bridge_instance = TaiyiBridge()
    return _bridge_instance


async def compute_phi_with_agi(
    i_field: Dict,
    c_field: Dict,
    g_field: Dict,
    calc_budget: int = 1000,
) -> PhiComputeResult:
    """
    便捷函数：通过 AGI 桥接器计算 Φ场
    
    用法：
        result = await compute_phi_with_agi(i, c, g)
        print(result.phi_value, result.source)  # 查看结果和来源
    """
    bridge = get_taiyi_bridge()
    async with bridge:
        return await bridge.compute_phi(i_field, c_field, g_field, calc_budget)
