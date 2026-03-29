"""
Analysis endpoints.

POST /api/projects/{project_id}/consistency
  Body: { "scene_content": "<text or HTML>" }
  Returns: { "issues": [...] }
"""
from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from kg import crud
from agent.consistency import check_consistency
from agent.logger import AgentLogger

router = APIRouter()


# ─────────────────────────────────────────────
# Helper
# ─────────────────────────────────────────────

async def _require_project(project_id: str) -> dict:
    project = await crud.get_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


# ─────────────────────────────────────────────
# Models
# ─────────────────────────────────────────────

class ConsistencyRequest(BaseModel):
    scene_content: str


# ─────────────────────────────────────────────
# Routes
# ─────────────────────────────────────────────

@router.post("/projects/{project_id}/consistency")
async def run_consistency_check(
    project_id: str,
    body: ConsistencyRequest,
) -> dict:
    await _require_project(project_id)
    logger = AgentLogger()
    issues = await check_consistency(
        scene_content=body.scene_content,
        project_id=project_id,
        logger=logger,
    )
    return {"issues": issues, "count": len(issues)}
