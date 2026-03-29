"""
REST endpoints for chapter management.
GET    /api/projects/{id}/chapters        — list chapters
POST   /api/projects/{id}/chapters        — create chapter
GET    /api/projects/{id}/chapters/{cid}  — get chapter
PATCH  /api/projects/{id}/chapters/{cid}  — update chapter
DELETE /api/projects/{id}/chapters/{cid}  — delete chapter
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional

from kg import crud

router = APIRouter(prefix="/api/projects", tags=["chapters"])


class ChapterCreate(BaseModel):
    title: str
    order: int = 1
    outline: str = ""
    tags: list[str] = []
    pov_character: str = ""
    emotional_goal: str = ""
    narrative_function: str = ""


class ChapterUpdate(BaseModel):
    title: Optional[str] = None
    order: Optional[int] = None
    outline: Optional[str] = None
    tags: Optional[list[str]] = None
    pov_character: Optional[str] = None
    emotional_goal: Optional[str] = None
    narrative_function: Optional[str] = None
    status: Optional[str] = None
    word_count: Optional[int] = None


async def _require_project(project_id: str) -> dict:
    project = await crud.get_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


async def _require_chapter(chapter_id: str) -> dict:
    chapter = await crud.get_chapter(chapter_id)
    if not chapter:
        raise HTTPException(status_code=404, detail="Chapter not found")
    return chapter


@router.get("/{project_id}/chapters")
async def list_chapters(project_id: str) -> list[dict]:
    await _require_project(project_id)
    return await crud.list_chapters(project_id)


@router.post("/{project_id}/chapters", status_code=201)
async def create_chapter(project_id: str, body: ChapterCreate) -> dict:
    await _require_project(project_id)
    from kg.schema import ChapterNode
    node = ChapterNode(
        project_id=project_id,
        title=body.title,
        order=body.order,
        outline=body.outline,
        tags=body.tags,
        pov_character=body.pov_character,
        emotional_goal=body.emotional_goal,
        narrative_function=body.narrative_function,
    )
    return await crud.create_chapter(node)


@router.get("/{project_id}/chapters/{chapter_id}")
async def get_chapter(project_id: str, chapter_id: str) -> dict:
    await _require_project(project_id)
    return await _require_chapter(chapter_id)


@router.patch("/{project_id}/chapters/{chapter_id}")
async def update_chapter(project_id: str, chapter_id: str, body: ChapterUpdate) -> dict:
    await _require_project(project_id)
    await _require_chapter(chapter_id)
    props = body.model_dump(exclude_none=True)
    if not props:
        raise HTTPException(status_code=400, detail="No fields to update")
    updated = await crud.update_node("Chapter", chapter_id, props)
    if not updated:
        raise HTTPException(status_code=404, detail="Chapter not found")
    return updated


@router.delete("/{project_id}/chapters/{chapter_id}")
async def delete_chapter(project_id: str, chapter_id: str) -> dict:
    await _require_project(project_id)
    await _require_chapter(chapter_id)
    await crud.delete_chapter(chapter_id)
    return {"deleted": True}
