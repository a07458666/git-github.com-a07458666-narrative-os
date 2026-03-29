"""
CRUD operations against Neo4j for all KG node types.
Uses the Neo4j async driver directly for structured reads/writes.
"""
from __future__ import annotations

from typing import Optional

from .client import get_driver
from .schema import (
    ArtifactNode,
    CharacterNode,
    CharacterRelationshipEdge,
    ChapterNode,
    FactionNode,
    FactionRelationshipEdge,
    LocationNode,
    NoteNode,
    PlotThreadNode,
    ProjectNode,
    SceneNode,
    StoryArcNode,
    WorldEventNode,
)


# ─────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────

def _to_props(model) -> dict:
    """Convert a Pydantic model to a Neo4j-safe property dict."""
    data = model.model_dump()
    for k, v in data.items():
        if isinstance(v, list):
            # Neo4j stores lists of primitives natively; keep as-is
            data[k] = [str(i) for i in v]
        elif hasattr(v, "isoformat"):
            data[k] = v.isoformat()
    return data


async def _merge_node(label: str, props: dict) -> dict:
    driver = get_driver()
    cypher = (
        f"MERGE (n:{label} {{id: $id}}) "
        "SET n += $props "
        "RETURN properties(n) AS node"
    )
    async with driver.session() as session:
        result = await session.run(cypher, id=props["id"], props=props)
        record = await result.single()
        return record["node"]


async def _get_node(label: str, node_id: str) -> Optional[dict]:
    driver = get_driver()
    async with driver.session() as session:
        result = await session.run(
            f"MATCH (n:{label} {{id: $id}}) RETURN properties(n) AS node",
            id=node_id,
        )
        record = await result.single()
        return record["node"] if record else None


async def _list_nodes(label: str, project_id: str) -> list[dict]:
    driver = get_driver()
    async with driver.session() as session:
        result = await session.run(
            f"MATCH (n:{label} {{project_id: $pid}}) RETURN properties(n) AS node",
            pid=project_id,
        )
        return [r["node"] async for r in result]


async def _delete_node(label: str, node_id: str) -> bool:
    driver = get_driver()
    async with driver.session() as session:
        result = await session.run(
            f"MATCH (n:{label} {{id: $id}}) DETACH DELETE n RETURN count(n) AS deleted",
            id=node_id,
        )
        record = await result.single()
        return record["deleted"] > 0


async def update_node(label: str, node_id: str, props: dict) -> Optional[dict]:
    """Partial update — only the supplied props are changed."""
    driver = get_driver()
    async with driver.session() as session:
        result = await session.run(
            f"MATCH (n:{label} {{id: $id}}) SET n += $props RETURN properties(n) AS node",
            id=node_id, props=props,
        )
        record = await result.single()
        return record["node"] if record else None


# ─────────────────────────────────────────────
# Project
# ─────────────────────────────────────────────

async def create_project(p: ProjectNode) -> dict:
    return await _merge_node("Project", _to_props(p))


async def get_project(project_id: str) -> Optional[dict]:
    return await _get_node("Project", project_id)


async def list_projects() -> list[dict]:
    driver = get_driver()
    async with driver.session() as session:
        result = await session.run(
            "MATCH (n:Project) RETURN properties(n) AS node ORDER BY n.created_at"
        )
        return [r["node"] async for r in result]


# ─────────────────────────────────────────────
# Character
# ─────────────────────────────────────────────

async def create_character(c: CharacterNode) -> dict:
    return await _merge_node("Character", _to_props(c))


async def get_character(character_id: str) -> Optional[dict]:
    return await _get_node("Character", character_id)


async def get_character_by_name(name: str, project_id: str) -> Optional[dict]:
    driver = get_driver()
    async with driver.session() as session:
        result = await session.run(
            "MATCH (n:Character {name: $name, project_id: $pid}) RETURN properties(n) AS node",
            name=name, pid=project_id,
        )
        record = await result.single()
        return record["node"] if record else None


async def list_characters(project_id: str) -> list[dict]:
    return await _list_nodes("Character", project_id)


async def delete_character(character_id: str) -> bool:
    return await _delete_node("Character", character_id)


async def update_character_state(character_id: str, current_state: str) -> Optional[dict]:
    driver = get_driver()
    async with driver.session() as session:
        result = await session.run(
            "MATCH (n:Character {id: $id}) SET n.current_state = $state RETURN properties(n) AS node",
            id=character_id, state=current_state,
        )
        record = await result.single()
        return record["node"] if record else None


# ─────────────────────────────────────────────
# Character Relationship
# ─────────────────────────────────────────────

async def upsert_character_relationship(edge: CharacterRelationshipEdge) -> dict:
    driver = get_driver()
    props = _to_props(edge)
    rel_type = edge.type.upper()
    async with driver.session() as session:
        result = await session.run(
            """
            MATCH (a:Character {id: $src}), (b:Character {id: $tgt})
            MERGE (a)-[r:RELATES_TO {source_id: $src, target_id: $tgt}]->(b)
            SET r += $props, r.rel_type = $rel_type
            RETURN properties(r) AS rel
            """,
            src=edge.source_id, tgt=edge.target_id,
            props=props, rel_type=rel_type,
        )
        record = await result.single()
        return record["rel"] if record else {}


async def get_character_relationship(char_a: str, char_b: str) -> Optional[dict]:
    driver = get_driver()
    async with driver.session() as session:
        result = await session.run(
            """
            MATCH (a:Character {id: $a})-[r:RELATES_TO]->(b:Character {id: $b})
            RETURN properties(r) AS rel
            """,
            a=char_a, b=char_b,
        )
        record = await result.single()
        return record["rel"] if record else None


# ─────────────────────────────────────────────
# Location
# ─────────────────────────────────────────────

async def create_location(loc: LocationNode) -> dict:
    return await _merge_node("Location", _to_props(loc))


async def list_locations(project_id: str) -> list[dict]:
    return await _list_nodes("Location", project_id)


async def get_location(location_id: str) -> Optional[dict]:
    return await _get_node("Location", location_id)


async def delete_location(location_id: str) -> bool:
    return await _delete_node("Location", location_id)


# ─────────────────────────────────────────────
# Faction
# ─────────────────────────────────────────────

async def create_faction(f: FactionNode) -> dict:
    return await _merge_node("Faction", _to_props(f))


async def list_factions(project_id: str) -> list[dict]:
    return await _list_nodes("Faction", project_id)


async def get_faction(faction_id: str) -> Optional[dict]:
    return await _get_node("Faction", faction_id)


async def delete_faction(faction_id: str) -> bool:
    return await _delete_node("Faction", faction_id)


async def upsert_faction_relationship(edge: FactionRelationshipEdge) -> dict:
    driver = get_driver()
    props = _to_props(edge)
    async with driver.session() as session:
        result = await session.run(
            """
            MATCH (a:Faction {id: $src}), (b:Faction {id: $tgt})
            MERGE (a)-[r:FACTION_RELATES_TO {source_id: $src, target_id: $tgt}]->(b)
            SET r += $props
            RETURN properties(r) AS rel
            """,
            src=edge.source_id, tgt=edge.target_id, props=props,
        )
        record = await result.single()
        return record["rel"] if record else {}


# ─────────────────────────────────────────────
# PlotThread (Foreshadowing)
# ─────────────────────────────────────────────

async def create_plot_thread(pt: PlotThreadNode) -> dict:
    return await _merge_node("PlotThread", _to_props(pt))


async def list_active_plot_threads(project_id: str) -> list[dict]:
    driver = get_driver()
    async with driver.session() as session:
        result = await session.run(
            "MATCH (n:PlotThread {project_id: $pid, status: 'active'}) RETURN properties(n) AS node",
            pid=project_id,
        )
        return [r["node"] async for r in result]


async def list_all_plot_threads(project_id: str) -> list[dict]:
    return await _list_nodes("PlotThread", project_id)


async def get_plot_thread(thread_id: str) -> Optional[dict]:
    return await _get_node("PlotThread", thread_id)


async def delete_plot_thread(thread_id: str) -> bool:
    return await _delete_node("PlotThread", thread_id)


async def resolve_plot_thread(thread_id: str, resolution_scene: str) -> Optional[dict]:
    driver = get_driver()
    async with driver.session() as session:
        result = await session.run(
            """
            MATCH (n:PlotThread {id: $id})
            SET n.status = 'resolved', n.resolution_scene = $scene
            RETURN properties(n) AS node
            """,
            id=thread_id, scene=resolution_scene,
        )
        record = await result.single()
        return record["node"] if record else None


# ─────────────────────────────────────────────
# Artifact
# ─────────────────────────────────────────────

async def create_artifact(a: ArtifactNode) -> dict:
    return await _merge_node("Artifact", _to_props(a))


async def list_artifacts(project_id: str) -> list[dict]:
    return await _list_nodes("Artifact", project_id)


async def get_artifact(artifact_id: str) -> Optional[dict]:
    return await _get_node("Artifact", artifact_id)


async def delete_artifact(artifact_id: str) -> bool:
    return await _delete_node("Artifact", artifact_id)


# ─────────────────────────────────────────────
# WorldEvent
# ─────────────────────────────────────────────

async def create_world_event(e: WorldEventNode) -> dict:
    return await _merge_node("WorldEvent", _to_props(e))


async def list_world_events(project_id: str) -> list[dict]:
    return await _list_nodes("WorldEvent", project_id)


# ─────────────────────────────────────────────
# StoryArc / Chapter / Scene
# ─────────────────────────────────────────────

async def create_story_arc(arc: StoryArcNode) -> dict:
    return await _merge_node("StoryArc", _to_props(arc))


async def create_chapter(ch: ChapterNode) -> dict:
    return await _merge_node("Chapter", _to_props(ch))


async def get_chapter(chapter_id: str) -> Optional[dict]:
    return await _get_node("Chapter", chapter_id)


async def delete_chapter(chapter_id: str) -> bool:
    return await _delete_node("Chapter", chapter_id)


async def list_chapters(project_id: str) -> list[dict]:
    return await _list_nodes("Chapter", project_id)


async def create_scene(sc: SceneNode) -> dict:
    return await _merge_node("Scene", _to_props(sc))


async def get_scene(scene_id: str) -> Optional[dict]:
    return await _get_node("Scene", scene_id)


async def update_scene(scene_id: str, props: dict) -> Optional[dict]:
    return await update_node("Scene", scene_id, props)


async def delete_scene(scene_id: str) -> bool:
    return await _delete_node("Scene", scene_id)


async def list_scenes_by_chapter(chapter_id: str) -> list[dict]:
    """List all scenes belonging to a chapter (SceneNode has no project_id)."""
    driver = get_driver()
    async with driver.session() as session:
        result = await session.run(
            "MATCH (n:Scene {chapter_id: $cid}) RETURN properties(n) AS node ORDER BY n.order",
            cid=chapter_id,
        )
        return [r["node"] async for r in result]


# ─────────────────────────────────────────────
# Graph (nodes + edges for visualisation)
# ─────────────────────────────────────────────

async def get_kg_graph(project_id: str) -> dict:
    """
    Return all nodes and edges for a project as a graph-ready dict:
      { "nodes": [...], "links": [...] }

    Nodes: Character, Faction, Location, PlotThread, Artifact
    Edges:
      - RELATES_TO between Characters
      - FACTION_RELATES_TO between Factions
      - MEMBER_OF synthetic edge: Character → Faction (via faction_id)
      - ARTIFACT_OWNED synthetic edge: Artifact → Character (via current_owner)
    """
    driver = get_driver()
    async with driver.session() as session:
        nodes: list[dict] = []
        links: list[dict] = []

        # ── Collect nodes ──────────────────────────────────────
        for label in ("Character", "Faction", "Location", "PlotThread", "Artifact"):
            result = await session.run(
                f"MATCH (n:{label} {{project_id: $pid}}) RETURN properties(n) AS p",
                pid=project_id,
            )
            async for record in result:
                p = dict(record["p"])
                nodes.append({"id": p["id"], "label": p.get("name", p["id"]),
                               "type": label, **p})

        # ── Character RELATES_TO edges ─────────────────────────
        result = await session.run(
            """
            MATCH (a:Character {project_id: $pid})-[r:RELATES_TO]->(b:Character {project_id: $pid})
            RETURN a.id AS src, b.id AS tgt, r.rel_type AS rel_type, r.trust_level AS trust
            """,
            pid=project_id,
        )
        async for record in result:
            links.append({
                "source": record["src"], "target": record["tgt"],
                "type": "RELATES_TO", "label": record["rel_type"] or "",
                "trust": record["trust"] or 0,
            })

        # ── Faction FACTION_RELATES_TO edges ──────────────────
        result = await session.run(
            """
            MATCH (a:Faction {project_id: $pid})-[r:FACTION_RELATES_TO]->(b:Faction {project_id: $pid})
            RETURN a.id AS src, b.id AS tgt, r.type AS rel_type
            """,
            pid=project_id,
        )
        async for record in result:
            links.append({
                "source": record["src"], "target": record["tgt"],
                "type": "FACTION_RELATES_TO", "label": record["rel_type"] or "",
            })

        # ── Synthetic: Character → Faction (MEMBER_OF) ────────
        result = await session.run(
            """
            MATCH (c:Character {project_id: $pid})
            WHERE c.faction_id IS NOT NULL AND c.faction_id <> ''
            MATCH (f:Faction {id: c.faction_id})
            RETURN c.id AS cid, f.id AS fid
            """,
            pid=project_id,
        )
        async for record in result:
            links.append({
                "source": record["cid"], "target": record["fid"],
                "type": "MEMBER_OF", "label": "member of",
            })

        # ── Synthetic: Artifact → Character (OWNED_BY) ────────
        result = await session.run(
            """
            MATCH (a:Artifact {project_id: $pid})
            WHERE a.current_owner IS NOT NULL AND a.current_owner <> ''
            MATCH (c:Character {id: a.current_owner})
            RETURN a.id AS aid, c.id AS cid
            """,
            pid=project_id,
        )
        async for record in result:
            links.append({
                "source": record["aid"], "target": record["cid"],
                "type": "OWNED_BY", "label": "owned by",
            })

    return {"nodes": nodes, "links": links}


# ─────────────────────────────────────────────
# Note
# ─────────────────────────────────────────────

async def create_note(n: NoteNode) -> dict:
    return await _merge_node("Note", _to_props(n))


async def list_notes(project_id: str) -> list[dict]:
    return await _list_nodes("Note", project_id)
