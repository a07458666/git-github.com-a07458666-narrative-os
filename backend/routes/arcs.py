"""
Story Arc and Act REST endpoints.

Story Arcs:
  GET    /api/projects/{pid}/arcs              — list arcs
  POST   /api/projects/{pid}/arcs              — create arc
  GET    /api/projects/{pid}/arcs/{arc_id}     — get arc
  PATCH  /api/projects/{pid}/arcs/{arc_id}     — update arc
  DELETE /api/projects/{pid}/arcs/{arc_id}     — delete arc

Acts (nested under arcs):
  GET    /api/projects/{pid}/arcs/{arc_id}/acts              — list acts
  POST   /api/projects/{pid}/arcs/{arc_id}/acts              — create act
  DELETE /api/projects/{pid}/arcs/{arc_id}/acts/{act_id}     — delete act
"""
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from kg import crud
from kg.schema import ActNode, StoryArcNode

router = APIRouter(prefix="/api/projects/{project_id}", tags=["arcs"])


# ── Request models ────────────────────────────────────────────

class ArcCreate(BaseModel):
    name: str
    theme: str = ""
    emotional_goal: str = ""


class ArcUpdate(BaseModel):
    name: Optional[str] = None
    theme: Optional[str] = None
    emotional_goal: Optional[str] = None


class ActCreate(BaseModel):
    name: str
    order: int = 1


# ── Helpers ───────────────────────────────────────────────────

async def _require_project(project_id: str) -> dict:
    project = await crud.get_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


async def _require_arc(arc_id: str) -> dict:
    arc = await crud.get_story_arc(arc_id)
    if not arc:
        raise HTTPException(status_code=404, detail="Story arc not found")
    return arc


# ── Story Arc endpoints ───────────────────────────────────────

@router.get("/arcs")
async def list_arcs(project_id: str) -> list[dict]:
    await _require_project(project_id)
    return await crud.list_story_arcs(project_id)


@router.post("/arcs", status_code=201)
async def create_arc(project_id: str, body: ArcCreate) -> dict:
    await _require_project(project_id)
    arc = StoryArcNode(
        project_id=project_id,
        name=body.name,
        theme=body.theme,
        emotional_goal=body.emotional_goal,
    )
    return await crud.create_story_arc(arc)


@router.get("/arcs/{arc_id}")
async def get_arc(project_id: str, arc_id: str) -> dict:
    await _require_project(project_id)
    return await _require_arc(arc_id)


@router.patch("/arcs/{arc_id}")
async def update_arc(project_id: str, arc_id: str, body: ArcUpdate) -> dict:
    await _require_project(project_id)
    await _require_arc(arc_id)
    props = body.model_dump(exclude_none=True)
    if not props:
        raise HTTPException(status_code=400, detail="No fields to update")
    updated = await crud.update_node("StoryArc", arc_id, props)
    if not updated:
        raise HTTPException(status_code=404, detail="Story arc not found")
    return updated


@router.delete("/arcs/{arc_id}")
async def delete_arc(project_id: str, arc_id: str) -> dict:
    await _require_project(project_id)
    await _require_arc(arc_id)
    await crud.delete_story_arc(arc_id)
    return {"deleted": True}


# ── Act endpoints ─────────────────────────────────────────────

@router.get("/arcs/{arc_id}/acts")
async def list_acts(project_id: str, arc_id: str) -> list[dict]:
    await _require_project(project_id)
    await _require_arc(arc_id)
    return await crud.list_acts_by_arc(arc_id)


@router.post("/arcs/{arc_id}/acts", status_code=201)
async def create_act(project_id: str, arc_id: str, body: ActCreate) -> dict:
    await _require_project(project_id)
    await _require_arc(arc_id)
    act = ActNode(
        story_arc_id=arc_id,
        name=body.name,
        order=body.order,
    )
    return await crud.create_act(act)


@router.delete("/arcs/{arc_id}/acts/{act_id}")
async def delete_act(project_id: str, arc_id: str, act_id: str) -> dict:
    await _require_project(project_id)
    await _require_arc(arc_id)
    act = await crud.get_act(act_id)
    if not act:
        raise HTTPException(status_code=404, detail="Act not found")
    await crud.delete_act(act_id)
    return {"deleted": True}
