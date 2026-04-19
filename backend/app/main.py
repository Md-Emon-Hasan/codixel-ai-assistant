from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.chat import router as chat_router
from app.core.config import Settings
from app.db import Base, SessionLocal, engine
from app.services.factory import create_assistant

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("codixel")


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting Codixel AI Assistant...")
    settings = Settings.from_env()
    Base.metadata.create_all(bind=engine)
    logger.info("Initializing AI assistant (loading/building vectorstore)...")
    app.state.assistant = create_assistant(settings)
    logger.info("Ready.")
    yield
    logger.info("Shutting down.")


def create_app() -> FastAPI:
    settings = Settings.from_env()

    app = FastAPI(
        title="Codixel AI Assistant API (No Auth)",
        version="2.0.0",
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.allowed_origins,
        allow_credentials=settings.allowed_origins != ["*"],
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(chat_router)

    return app


app = create_app()
