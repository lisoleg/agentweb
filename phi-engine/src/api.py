"""
Phi Engine API Routes
FastAPI endpoints for Φ value calculation

v2.0：接入太乙AGI后端桥接层（taiyi_bridge）
  - /api/v1/phi/compute：优先AGI后端，fallback本地
  - /api/v1/phi/calculate：保持兼容，内部也走桥接层
"""

from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Dict, Any, Optional, List
from datetime import datetime
from loguru import logger
from calculator import PhiCalculator, calculate_phi

# ── 新增：导入太乙AGI桥接层 ──
from taiyi_bridge import (
    TaiyiBridge,
    PhiComputeRequest,
    PhiComputeResult,
    get_taiyi_bridge,
)

# Initialize FastAPI app
app = FastAPI(
    title="AgentWeb Phi Engine",
    description="Φ (Phi) Value Calculation Engine for AgentWeb",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# =============== Pydantic Models ===============


class InteractionData(BaseModel):
    """User interaction data for Φ calculation"""
    user_id: str = Field(..., description="User ID")
    content_id: Optional[str] = Field(None, description="Content ID (optional)")
    mouse_events: Optional[list[float]] = Field(default=[], description="Mouse event timestamps")
    keyboard_events: Optional[list[float]] = Field(default=[], description="Keyboard event timestamps")
    scroll_events: Optional[list[float]] = Field(default=[], description="Scroll event timestamps")
    timestamps: Optional[list[float]] = Field(default=[], description="Interaction timestamps")
    reference_timestamp: Optional[float] = Field(default=0, description="Reference timestamp for decay")
    current_timestamp: Optional[float] = Field(default=0, description="Current timestamp for decay")
    metadata: Optional[Dict[str, Any]] = Field(default={}, description="Additional metadata")


class PhiCalculationRequest(BaseModel):
    """Request model for Φ calculation"""
    interaction_data: InteractionData
    calculate_options: Optional[Dict[str, Any]] = Field(default={})


class PhiCalculationResponse(BaseModel):
    """Response model for Φ calculation"""
    user_id: str
    phi_value: float
    timestamp: str
    details: Dict[str, Any]
    content_id: Optional[str] = None


class HealthResponse(BaseModel):
    """Health check response"""
    status: str
    timestamp: str
    version: str
    calculator_initialized: bool

# =============== Routes ===============


@app.get("/", response_model=Dict[str, str])
async def root():
    """Root endpoint"""
    return {
        "service": "AgentWeb Phi Engine",
        "version": "1.0.0",
        "docs": "/docs",
        "health": "/health"
    }


@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint"""
    return HealthResponse(
        status="healthy",
        timestamp=datetime.utcnow().isoformat(),
        version="1.0.0",
        calculator_initialized=True
    )


@app.post("/api/v1/phi/calculate", response_model=PhiCalculationResponse)
async def calculate_phi(request: PhiCalculationRequest) -> PhiCalculationResponse:
    """
    Calculate Φ value from interaction data

    The Φ value represents integrated information based on:
    - Information entropy of user interactions
    - Mutual information between interaction features
    - Time decay for temporal relevance
    """
    try:
        data = request.interaction_data.dict()
        user_id = data.get("user_id", "unknown")
        content_id = data.get("content_id")

        # Prepare interaction data dict
        interaction_data = {
            "mouse_events": data.get("mouse_events", []),
            "keyboard_events": data.get("keyboard_events", []),
            "scroll_events": data.get("scroll_events", []),
            "timestamps": data.get("timestamps", []),
            "reference_timestamp": data.get("reference_timestamp", 0),
            "current_timestamp": data.get("current_timestamp", 0),
            "metadata": data.get("metadata", {})
        }

        # Calculate phi
        result = calculate_phi(interaction_data, user_id, content_id)

        logger.info(f"Φ calculated: user_id={user_id}, phi={result['phi_value']}")

        return PhiCalculationResponse(**result)

    except Exception as e:
        logger.error(f"Φ calculation error: {e}")
        raise HTTPException(status_code=500, detail=f"Calculation error: {str(e)}")


@app.get("/api/v1/phi/info")
async def get_phi_info():
    """Get information about Φ calculation"""
    return {
        "method": "Simplified Integrated Information Theory",
        "description": "Calculates Φ value based on information entropy and time decay",
        "inputs": [
            "mouse_events - Mouse movement data",
            "keyboard_events - Keyboard input data",
            "scroll_events - Scroll behavior data",
            "timestamps - Interaction timing data"
        ],
        "output": "phi_value (0.0 - 1.0)",
        "parameters": {
            "decay_rate": 0.95,
            "min_value": 0.0,
            "max_value": 1.0
        }
    }


@app.get("/api/v1/phi/history/{user_id}")
async def get_phi_history(user_id: str, limit: int = 100):
    """
    Get Φ value history for a user
    TODO: Implement with database
    """
    logger.info(f"Φ history requested for user {user_id}")
    return {
        "user_id": user_id,
        "history": [],  # TODO: Fetch from database
        "message": "Not implemented yet"
    }


@app.get("/api/v1/phi/distribution")
async def get_phi_distribution():
    """
    Get Φ value distribution statistics
    TODO: Implement with database
    """
    logger.info("Φ distribution requested")
    return {
        "distribution": {},
        "statistics": {
            "mean": 0.0,
            "median": 0.0,
            "std": 0.0,
            "count": 0
        },
        "message": "Not implemented yet"
    }

# ═════════════════════════════════════
#  太乙AGI 桥接端点（v2.0 新增）
# ═════════════════════════════════════

@app.post("/api/v1/phi/compute")
async def compute_phi_agi(
    i_field: Dict[str, Any],
    c_field: Dict[str, Any],
    g_field: Dict[str, Any],
    calc_budget: int = 1000,
    use_fpga: bool = False,
):
    """
    Φ场计算（对接太乙AGI后端）

    优先调用 AGI 后端，不可用时自动 fallback 到本地计算。
    IGCTR: ΔΦ ≤ α(ΔI) + β(ΔC) + γ(ΔG)
    """
    bridge = get_taiyi_bridge()
    try:
        result = await bridge.compute_phi(
            i_field=i_field,
            c_field=c_field,
            g_field=g_field,
            calc_budget=calc_budget,
            use_fpga=use_fpga,
        )
        return {
            "phi_value": result.phi_value,
            "resonance_score": result.resonance_score,
            "active_modules": result.active_modules,
            "proved_theorems": result.proved_theorems,
            "igctr_terms": result.igctr_terms,
            "execution_time_ms": result.execution_time_ms,
            "source": result.source,
            "agi_backend_reachable": result.agi_backend_reachable,
        }
    except Exception as e:
        logger.error(f"AGI bridge error: {e}")
        raise HTTPException(status_code=500, detail=f"Φ compute error: {str(e)}")


@app.get("/api/v1/agi/health")
async def agi_health():
    """检查太乙AGI后端健康状态"""
    bridge = get_taiyi_bridge()
    healthy = await bridge.health_check()
    return {
        "agi_backend_reachable": healthy,
        "bridge_stats": bridge.get_stats(),
    }


@app.post("/api/v1/agi/modules/invoke")
async def invoke_agi_module(
    module_id: str,
    input_data: Dict[str, Any],
    timeout_ms: int = 30000,
):
    """调用太乙AGI指定模块（M1-M125）"""
    bridge = get_taiyi_bridge()
    result = await bridge.invoke_module(
        module_id=module_id,
        input_data=input_data,
        timeout_ms=timeout_ms,
    )
    return result


# =============== Startup/Shutdown Events ===============


@app.on_event("startup")
async def startup_event():
    """Initialize services on startup"""
    logger.info("Phi Engine starting up...")
    logger.info("PhiCalculator initialized")


@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup on shutdown"""
    logger.info("Phi Engine shutting down...")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
