"""
NarrativeOS — FastAPI application entry point.

Endpoints:
  GET  /health
  GET  /api/projects/
  GET  /api/projects/{id}
  POST /api/projects/
  GET  /api/projects/{id}/chapters
  POST /api/projects/{id}/chapters
  WS   /ws/project/{project_id}
"""
import logging
import os

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Suppress litellm logging noise
logging.getLogger("litellm").setLevel(logging.CRITICAL)
logging.getLogger("litellm.litellm_core_utils").setLevel(logging.CRITICAL)
os.environ.setdefault("LITELLM_LOG", "CRITICAL")

from kg.client import init_schema, close  # noqa: E402
from backend.routes.projects import router as projects_router  # noqa: E402
from backend.routes.chapters import router as chapters_router  # noqa: E402
from backend.routes.scenes import router as scenes_router  # noqa: E402
from backend.routes.kg import router as kg_router  # noqa: E402
from backend.routes.analysis import router as analysis_router  # noqa: E402
from backend.routes.logs import router as logs_router  # noqa: E402
from backend.routes.export import router as export_router  # noqa: E402
from backend.websocket.handler import router as ws_router  # noqa: E402


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_schema()
    yield
    await close()


app = FastAPI(
    title="NarrativeOS",
    version="0.8.0",
    description="AI-assisted novel writing system",
    lifespan=lifespan,
)

# Allow the Vite dev server (port 5173) during development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(projects_router)
app.include_router(chapters_router)
app.include_router(scenes_router)
app.include_router(kg_router)
app.include_router(analysis_router, prefix="/api")
app.include_router(logs_router)
app.include_router(export_router)
app.include_router(ws_router)


@app.get("/health", tags=["system"])
async def health() -> dict:
    return {"status": "ok", "version": "0.8.0"}
