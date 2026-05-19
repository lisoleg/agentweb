"""
Phi Engine Main Entry Point
FastAPI application for Φ value calculation
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from loguru import logger
import uvicorn
from api import app as api_app

# Re-export the app
app = api_app

if __name__ == "__main__":
    logger.add("logs/phi_engine.log", rotation="10 MB", retention="14 days")

    logger.info("Starting AgentWeb Phi Engine...")
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=8000,
        log_config=None  # Use loguru
    )
