"""
REST endpoints for scene management.
GET    /api/chapters/{chapter_id}/scenes        — list scenes in a chapter
POST   /api/chapters/{chapter_id}/scenes        — create scene in a chapter
GET    /api/scenes/{scene_id}                   — get scene
PATCH  /api/scenes/{scene_id}                   — update scene (content, summary, etc.)
DELETE /api/scenes/{scene_id}                   — delete scene
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional

from kg import crud

router = APIRouter(tags=["scenes"])


class SceneCreate(BaseModel):
    order: int = 1
    pov_character: str = ""
    location_id: str = ""
    emotional_tone: str = ""
    tension_level: int = 5
    time_in_story: str = ""
    summary: str = ""
    content: str = ""


class SceneUpdate(BaseModel):
    order: Optional[int] = None
    pov_character: Optional[str] = None
    location_id: Optional[str] = None
    emotional_tone: Optional[str] = None
    tension_level: Optional[int] = None
    time_in_story: Optional[str] = None
    summary: Optional[str] = None
    content: Optional[str] = None


async def _require_chapter(chapter_id: str) -> dict:
    chapter = await crud.get_chapter(chapter_id)
    if not chapter:
        raise HTTPException(status_code=404, detail="Chapter not found")
    return chapter


async def _require_scene(scene_id: str) -> dict:
    scene = await crud.get_scene(scene_id)
    if not scene:
        raise HTTPException(status_code=404, detail="Scene not found")
    return scene


@router.get("/api/chapters/{chapter_id}/scenes")
async def list_scenes(chapter_id: str) -> list[dict]:
    await _require_chapter(chapter_id)
    return await crud.list_scenes_by_chapter(chapter_id)


@router.post("/api/chapters/{chapter_id}/scenes", status_code=201)
async def create_scene(chapter_id: str, body: SceneCreate) -> dict:
    await _require_chapter(chapter_id)
    from kg.schema import SceneNode
    node = SceneNode(
        chapter_id=chapter_id,
        order=body.order,
        pov_character=body.pov_character,
        location_id=body.location_id,
        emotional_tone=body.emotional_tone,
        tension_level=body.tension_level,
        time_in_story=body.time_in_story,
        summary=body.summary,
        content=body.content,
    )
    return await crud.create_scene(node)


@router.get("/api/scenes/{scene_id}")
async def get_scene(scene_id: str) -> dict:
    return await _require_scene(scene_id)


@router.patch("/api/scenes/{scene_id}")
async def update_scene(scene_id: str, body: SceneUpdate) -> dict:
    await _require_scene(scene_id)
    props = body.model_dump(exclude_none=True)
    if not props:
        raise HTTPException(status_code=400, detail="No fields to update")
    updated = await crud.update_scene(scene_id, props)
    if not updated:
        raise HTTPException(status_code=404, detail="Scene not found")
    return updated


@router.delete("/api/scenes/{scene_id}")
async def delete_scene(scene_id: str) -> dict:
    await _require_scene(scene_id)
    await crud.delete_scene(scene_id)
    return {"deleted": True}
