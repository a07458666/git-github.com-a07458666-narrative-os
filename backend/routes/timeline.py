"""
Timeline endpoint — returns all chapters, scenes, arcs, acts and name maps
for a project so the frontend can render a story timeline view.

GET /api/projects/{id}/timeline
"""
from __future__ import annotations

from fastapi import APIRouter, HTTPException

from kg import crud

router = APIRouter(prefix="/api/projects", tags=["timeline"])


@router.get("/{project_id}/timeline")
async def get_timeline(project_id: str) -> dict:
    project = await crud.get_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return await crud.get_timeline(project_id)
