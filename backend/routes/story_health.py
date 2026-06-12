"""
Story Health endpoint — pacing, character arcs, plot-thread lifecycle.

GET /api/projects/{id}/story-health
"""
from __future__ import annotations

from fastapi import APIRouter, HTTPException

from kg import crud

router = APIRouter(prefix="/api/projects", tags=["story-health"])


@router.get("/{project_id}/story-health")
async def get_story_health(project_id: str) -> dict:
    project = await crud.get_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return await crud.get_story_health(project_id)
