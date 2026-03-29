"""
REST endpoints for project management.
GET  /api/projects          — list all projects
GET  /api/projects/{id}     — get project details + characters/threads summary
POST /api/projects          — create a new project
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from kg import crud
from kg.schema import ProjectNode

router = APIRouter(prefix="/api/projects", tags=["projects"])


class ProjectCreate(BaseModel):
    name: str
    description: str = ""
    genre: str = "fantasy"
    language: str = "zh"


@router.get("/")
async def list_projects() -> list[dict]:
    return await crud.list_projects()


@router.get("/{project_id}")
async def get_project(project_id: str) -> dict:
    project = await crud.get_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Attach quick summary so the frontend can show KG stats
    characters = await crud.list_characters(project_id)
    threads = await crud.list_active_plot_threads(project_id)
    locations = await crud.list_locations(project_id)
    factions = await crud.list_factions(project_id)

    return {
        **project,
        "summary": {
            "character_count": len(characters),
            "active_thread_count": len(threads),
            "location_count": len(locations),
            "faction_count": len(factions),
        },
    }


@router.post("/", status_code=201)
async def create_project(body: ProjectCreate) -> dict:
    node = ProjectNode(
        name=body.name,
        description=body.description,
        genre=body.genre,
        language=body.language,
    )
    created = await crud.create_project(node)
    return created
