"""
KG Node & Edge schema definitions (Pydantic models).
These map 1-to-1 to Neo4j node labels.
"""
from __future__ import annotations

import uuid
from datetime import datetime
from typing import List

from pydantic import BaseModel, Field


def _uuid() -> str:
    return str(uuid.uuid4())


def _now() -> datetime:
    return datetime.utcnow()


# ─────────────────────────────────────────────
# Layer 0: Project
# ─────────────────────────────────────────────

class ProjectNode(BaseModel):
    id: str = Field(default_factory=_uuid)
    name: str
    description: str = ""
    genre: str = ""
    language: str = "zh"
    created_at: datetime = Field(default_factory=_now)
    schema_version: str = "1.0"


# ─────────────────────────────────────────────
# Layer 1: Story Structure
# ─────────────────────────────────────────────

class StoryArcNode(BaseModel):
    id: str = Field(default_factory=_uuid)
    project_id: str
    name: str
    theme: str = ""
    emotional_goal: str = ""


class ActNode(BaseModel):
    id: str = Field(default_factory=_uuid)
    story_arc_id: str
    order: int  # 1=起 2=承 3=轉 4=合
    name: str


class ChapterNode(BaseModel):
    id: str = Field(default_factory=_uuid)
    act_id: str = ""          # optional until StoryArc UI is built
    project_id: str
    order: int
    title: str
    outline: str = ""             # 章節大綱 (author's planning notes)
    tags: List[str] = []          # 章節標籤 e.g. ["開場", "艾拉", "廢墟"]
    pov_character: str = ""
    emotional_goal: str = ""
    narrative_function: str = ""  # 鋪墊/高潮/轉折/解決
    word_count: int = 0
    status: str = "draft"         # draft/revised/final
    branch_id: str = "main"
    parent_branch: str = ""
    created_at: datetime = Field(default_factory=_now)
    updated_at: datetime = Field(default_factory=_now)


class SceneNode(BaseModel):
    id: str = Field(default_factory=_uuid)
    chapter_id: str
    order: int
    pov_character: str = ""
    location_id: str = ""
    emotional_tone: str = ""
    tension_level: int = 5        # 1-10
    time_in_story: str = ""
    summary: str = ""
    content: str = ""             # HTML from TipTap editor


# ─────────────────────────────────────────────
# Layer 2: Character Psychology (GOLEM)
# ─────────────────────────────────────────────

class CharacterNode(BaseModel):
    id: str = Field(default_factory=_uuid)
    project_id: str
    name: str
    aliases: List[str] = []
    role: str = "supporting"      # protagonist/antagonist/supporting
    gender: str = ""
    age: str = ""
    appearance: str = ""

    # GOLEM psychology core
    core_desire: str = ""
    core_fear: str = ""
    wound: str = ""
    belief: str = ""
    moral_code: str = ""

    # Behavior
    behavior_pattern: str = ""
    speech_style: str = ""
    speech_samples: List[str] = []

    # Growth arc
    arc_start: str = ""
    arc_end: str = ""
    current_state: str = ""

    first_appearance: str = ""
    faction_id: str = ""


# ─────────────────────────────────────────────
# Layer 3: Relationship Edges
# ─────────────────────────────────────────────

class CharacterRelationshipEdge(BaseModel):
    source_id: str
    target_id: str
    type: str = "neutral"         # ally/enemy/lover/family/rival/neutral
    trust_level: int = 0          # -100 to 100
    public_face: str = ""
    true_face: str = ""
    known_secrets: List[str] = []
    valid_from: str = ""
    valid_until: str = ""


class FactionRelationshipEdge(BaseModel):
    source_id: str
    target_id: str
    type: str = "neutral"         # alliance/conflict/neutral/trade
    public_stance: str = ""
    secret_stance: str = ""
    tension_level: int = 5        # 1-10


# ─────────────────────────────────────────────
# Layer 4: World
# ─────────────────────────────────────────────

class FactionNode(BaseModel):
    id: str = Field(default_factory=_uuid)
    project_id: str
    name: str
    ideology: str = ""
    goals: str = ""
    resources: str = ""
    members: List[str] = []
    power_level: int = 5


class LocationNode(BaseModel):
    id: str = Field(default_factory=_uuid)
    project_id: str
    name: str
    description: str = ""
    atmosphere: str = ""
    parent_location: str = ""
    significance: str = ""


class WorldEventNode(BaseModel):
    id: str = Field(default_factory=_uuid)
    project_id: str
    name: str
    description: str = ""
    time_in_world: str = ""
    impact: str = ""
    ai_generated: bool = False


class PlotThreadNode(BaseModel):
    id: str = Field(default_factory=_uuid)
    project_id: str
    name: str
    planted_in: str = ""          # scene_id
    planted_at: str = ""          # story time point
    status: str = "active"        # active/resolved/abandoned
    resolution_scene: str = ""
    description: str = ""


class ArtifactNode(BaseModel):
    id: str = Field(default_factory=_uuid)
    project_id: str
    name: str
    description: str = ""
    power: str = ""
    history: str = ""
    current_owner: str = ""


# ─────────────────────────────────────────────
# Layer 5: Analysis
# ─────────────────────────────────────────────

class NoteNode(BaseModel):
    id: str = Field(default_factory=_uuid)
    project_id: str
    content: str
    type: str = "inspiration"     # inspiration/journal/todo
    related_chapter: str = ""
    created_at: datetime = Field(default_factory=_now)
