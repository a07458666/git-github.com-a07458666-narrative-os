"""
KG management REST endpoints.
All routes are nested under /api/projects/{project_id}/kg/.

Characters:   GET/POST /kg/characters,  GET/PATCH/DELETE /kg/characters/{id}
Factions:     GET/POST /kg/factions,    GET/PATCH/DELETE /kg/factions/{id}
Locations:    GET/POST /kg/locations,   GET/PATCH/DELETE /kg/locations/{id}
PlotThreads:  GET/POST /kg/threads,     GET/DELETE /kg/threads/{id}
              GET /kg/threads/active,   POST /kg/threads/{id}/resolve
Artifacts:    GET/POST /kg/artifacts,   GET/PATCH/DELETE /kg/artifacts/{id}
"""
from __future__ import annotations

from typing import List, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from kg import crud
from kg.schema import (
    ArtifactNode,
    CharacterNode,
    FactionNode,
    LocationNode,
    PlotThreadNode,
)

router = APIRouter(prefix="/api/projects/{project_id}/kg", tags=["kg"])


# ── Shared helper ─────────────────────────────────────────────

async def _require_project(project_id: str) -> dict:
    project = await crud.get_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


# ── Request/Update models ─────────────────────────────────────

class CharacterCreate(BaseModel):
    name: str
    role: str = "supporting"
    gender: str = ""
    age: str = ""
    appearance: str = ""
    core_desire: str = ""
    core_fear: str = ""
    wound: str = ""
    belief: str = ""
    moral_code: str = ""
    behavior_pattern: str = ""
    speech_style: str = ""
    speech_samples: List[str] = []
    arc_start: str = ""
    arc_end: str = ""
    current_state: str = ""
    faction_id: str = ""
    aliases: List[str] = []


class CharacterUpdate(BaseModel):
    name: Optional[str] = None
    role: Optional[str] = None
    gender: Optional[str] = None
    age: Optional[str] = None
    appearance: Optional[str] = None
    core_desire: Optional[str] = None
    core_fear: Optional[str] = None
    wound: Optional[str] = None
    belief: Optional[str] = None
    moral_code: Optional[str] = None
    behavior_pattern: Optional[str] = None
    speech_style: Optional[str] = None
    speech_samples: Optional[List[str]] = None
    arc_start: Optional[str] = None
    arc_end: Optional[str] = None
    current_state: Optional[str] = None
    faction_id: Optional[str] = None
    aliases: Optional[List[str]] = None


class FactionCreate(BaseModel):
    name: str
    ideology: str = ""
    goals: str = ""
    resources: str = ""
    members: List[str] = []
    power_level: int = 5


class FactionUpdate(BaseModel):
    name: Optional[str] = None
    ideology: Optional[str] = None
    goals: Optional[str] = None
    resources: Optional[str] = None
    members: Optional[List[str]] = None
    power_level: Optional[int] = None


class LocationCreate(BaseModel):
    name: str
    description: str = ""
    atmosphere: str = ""
    parent_location: str = ""
    significance: str = ""


class LocationUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    atmosphere: Optional[str] = None
    parent_location: Optional[str] = None
    significance: Optional[str] = None


class PlotThreadCreate(BaseModel):
    name: str
    description: str = ""
    planted_in: str = ""
    planted_at: str = ""


class PlotThreadResolve(BaseModel):
    resolution_scene: str = ""


class ArtifactCreate(BaseModel):
    name: str
    description: str = ""
    power: str = ""
    history: str = ""
    current_owner: str = ""


class ArtifactUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    power: Optional[str] = None
    history: Optional[str] = None
    current_owner: Optional[str] = None


# ── Characters ────────────────────────────────────────────────

@router.get("/characters")
async def list_characters(project_id: str) -> list[dict]:
    await _require_project(project_id)
    return await crud.list_characters(project_id)


@router.get("/characters/{character_id}")
async def get_character(project_id: str, character_id: str) -> dict:
    await _require_project(project_id)
    char = await crud.get_character(character_id)
    if not char:
        raise HTTPException(status_code=404, detail="Character not found")
    return char


@router.post("/characters", status_code=201)
async def create_character(project_id: str, body: CharacterCreate) -> dict:
    await _require_project(project_id)
    node = CharacterNode(project_id=project_id, **body.model_dump())
    return await crud.create_character(node)


@router.patch("/characters/{character_id}")
async def update_character(project_id: str, character_id: str, body: CharacterUpdate) -> dict:
    await _require_project(project_id)
    changes = body.model_dump(exclude_none=True)
    updated = await crud.update_node("Character", character_id, changes)
    if not updated:
        raise HTTPException(status_code=404, detail="Character not found")
    return updated


@router.delete("/characters/{character_id}")
async def delete_character(project_id: str, character_id: str) -> dict:
    await _require_project(project_id)
    deleted = await crud.delete_character(character_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Character not found")
    return {"deleted": True}


# ── Factions ──────────────────────────────────────────────────

@router.get("/factions")
async def list_factions(project_id: str) -> list[dict]:
    await _require_project(project_id)
    return await crud.list_factions(project_id)


@router.get("/factions/{faction_id}")
async def get_faction(project_id: str, faction_id: str) -> dict:
    await _require_project(project_id)
    faction = await crud.get_faction(faction_id)
    if not faction:
        raise HTTPException(status_code=404, detail="Faction not found")
    return faction


@router.post("/factions", status_code=201)
async def create_faction(project_id: str, body: FactionCreate) -> dict:
    await _require_project(project_id)
    node = FactionNode(project_id=project_id, **body.model_dump())
    return await crud.create_faction(node)


@router.patch("/factions/{faction_id}")
async def update_faction(project_id: str, faction_id: str, body: FactionUpdate) -> dict:
    await _require_project(project_id)
    changes = body.model_dump(exclude_none=True)
    updated = await crud.update_node("Faction", faction_id, changes)
    if not updated:
        raise HTTPException(status_code=404, detail="Faction not found")
    return updated


@router.delete("/factions/{faction_id}")
async def delete_faction(project_id: str, faction_id: str) -> dict:
    await _require_project(project_id)
    deleted = await crud.delete_faction(faction_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Faction not found")
    return {"deleted": True}


# ── Locations ─────────────────────────────────────────────────

@router.get("/locations")
async def list_locations(project_id: str) -> list[dict]:
    await _require_project(project_id)
    return await crud.list_locations(project_id)


@router.get("/locations/{location_id}")
async def get_location(project_id: str, location_id: str) -> dict:
    await _require_project(project_id)
    loc = await crud.get_location(location_id)
    if not loc:
        raise HTTPException(status_code=404, detail="Location not found")
    return loc


@router.post("/locations", status_code=201)
async def create_location(project_id: str, body: LocationCreate) -> dict:
    await _require_project(project_id)
    node = LocationNode(project_id=project_id, **body.model_dump())
    return await crud.create_location(node)


@router.patch("/locations/{location_id}")
async def update_location(project_id: str, location_id: str, body: LocationUpdate) -> dict:
    await _require_project(project_id)
    changes = body.model_dump(exclude_none=True)
    updated = await crud.update_node("Location", location_id, changes)
    if not updated:
        raise HTTPException(status_code=404, detail="Location not found")
    return updated


@router.delete("/locations/{location_id}")
async def delete_location(project_id: str, location_id: str) -> dict:
    await _require_project(project_id)
    deleted = await crud.delete_location(location_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Location not found")
    return {"deleted": True}


# ── Plot Threads ──────────────────────────────────────────────

@router.get("/threads")
async def list_threads(project_id: str) -> list[dict]:
    await _require_project(project_id)
    return await crud.list_all_plot_threads(project_id)


@router.get("/threads/active")
async def list_active_threads(project_id: str) -> list[dict]:
    await _require_project(project_id)
    return await crud.list_active_plot_threads(project_id)


@router.get("/threads/{thread_id}")
async def get_thread(project_id: str, thread_id: str) -> dict:
    await _require_project(project_id)
    thread = await crud.get_plot_thread(thread_id)
    if not thread:
        raise HTTPException(status_code=404, detail="Plot thread not found")
    return thread


@router.post("/threads", status_code=201)
async def create_thread(project_id: str, body: PlotThreadCreate) -> dict:
    await _require_project(project_id)
    node = PlotThreadNode(
        project_id=project_id,
        status="active",
        **body.model_dump(),
    )
    return await crud.create_plot_thread(node)


@router.post("/threads/{thread_id}/resolve")
async def resolve_thread(project_id: str, thread_id: str, body: PlotThreadResolve) -> dict:
    await _require_project(project_id)
    resolved = await crud.resolve_plot_thread(thread_id, body.resolution_scene)
    if not resolved:
        raise HTTPException(status_code=404, detail="Plot thread not found")
    return resolved


@router.delete("/threads/{thread_id}")
async def delete_thread(project_id: str, thread_id: str) -> dict:
    await _require_project(project_id)
    deleted = await crud.delete_plot_thread(thread_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Plot thread not found")
    return {"deleted": True}


# ── Artifacts ─────────────────────────────────────────────────

@router.get("/artifacts")
async def list_artifacts(project_id: str) -> list[dict]:
    await _require_project(project_id)
    return await crud.list_artifacts(project_id)


@router.get("/artifacts/{artifact_id}")
async def get_artifact(project_id: str, artifact_id: str) -> dict:
    await _require_project(project_id)
    artifact = await crud.get_artifact(artifact_id)
    if not artifact:
        raise HTTPException(status_code=404, detail="Artifact not found")
    return artifact


@router.post("/artifacts", status_code=201)
async def create_artifact(project_id: str, body: ArtifactCreate) -> dict:
    await _require_project(project_id)
    node = ArtifactNode(project_id=project_id, **body.model_dump())
    return await crud.create_artifact(node)


@router.patch("/artifacts/{artifact_id}")
async def update_artifact(project_id: str, artifact_id: str, body: ArtifactUpdate) -> dict:
    await _require_project(project_id)
    changes = body.model_dump(exclude_none=True)
    updated = await crud.update_node("Artifact", artifact_id, changes)
    if not updated:
        raise HTTPException(status_code=404, detail="Artifact not found")
    return updated


@router.delete("/artifacts/{artifact_id}")
async def delete_artifact(project_id: str, artifact_id: str) -> dict:
    await _require_project(project_id)
    deleted = await crud.delete_artifact(artifact_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Artifact not found")
    return {"deleted": True}


# ── Graph ──────────────────────────────────────────────────────

@router.get("/graph")
async def get_kg_graph(project_id: str) -> dict:
    """Return all KG nodes and edges for graph visualisation."""
    await _require_project(project_id)
    return await crud.get_kg_graph(project_id)
