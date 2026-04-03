"""
Database client layer.

- `driver`  : Neo4j async driver for structured CRUD
- `graphiti`: Graphiti client for temporal KG features (search, episode ingestion)
"""
from __future__ import annotations

import os
from functools import lru_cache

from dotenv import load_dotenv
from graphiti_core import Graphiti
from neo4j import AsyncGraphDatabase, AsyncDriver

load_dotenv()

NEO4J_URI = os.getenv("NEO4J_URI", "bolt://localhost:7687")
NEO4J_USER = os.getenv("NEO4J_USER", "neo4j")
NEO4J_PASSWORD = os.getenv("NEO4J_PASSWORD", "narrativeos")


@lru_cache(maxsize=1)
def get_driver() -> AsyncDriver:
    """Singleton Neo4j async driver (used for structured CRUD)."""
    return AsyncGraphDatabase.driver(
        NEO4J_URI,
        auth=(NEO4J_USER, NEO4J_PASSWORD),
    )


@lru_cache(maxsize=1)
def get_graphiti() -> Graphiti:
    """Singleton Graphiti client (used for temporal KG & search)."""
    return Graphiti(NEO4J_URI, NEO4J_USER, NEO4J_PASSWORD)


async def init_schema() -> None:
    """
    Create Neo4j constraints & indexes, and initialise Graphiti indices.
    Call once on startup.
    """
    driver = get_driver()

    constraints = [
        "CREATE CONSTRAINT project_id IF NOT EXISTS FOR (n:Project) REQUIRE n.id IS UNIQUE",
        "CREATE CONSTRAINT character_id IF NOT EXISTS FOR (n:Character) REQUIRE n.id IS UNIQUE",
        "CREATE CONSTRAINT location_id IF NOT EXISTS FOR (n:Location) REQUIRE n.id IS UNIQUE",
        "CREATE CONSTRAINT faction_id IF NOT EXISTS FOR (n:Faction) REQUIRE n.id IS UNIQUE",
        "CREATE CONSTRAINT plot_thread_id IF NOT EXISTS FOR (n:PlotThread) REQUIRE n.id IS UNIQUE",
        "CREATE CONSTRAINT artifact_id IF NOT EXISTS FOR (n:Artifact) REQUIRE n.id IS UNIQUE",
        "CREATE CONSTRAINT scene_id IF NOT EXISTS FOR (n:Scene) REQUIRE n.id IS UNIQUE",
        "CREATE CONSTRAINT chapter_id IF NOT EXISTS FOR (n:Chapter) REQUIRE n.id IS UNIQUE",
        "CREATE CONSTRAINT story_arc_id IF NOT EXISTS FOR (n:StoryArc) REQUIRE n.id IS UNIQUE",
        "CREATE CONSTRAINT act_id IF NOT EXISTS FOR (n:Act) REQUIRE n.id IS UNIQUE",
        "CREATE CONSTRAINT world_event_id IF NOT EXISTS FOR (n:WorldEvent) REQUIRE n.id IS UNIQUE",
        "CREATE CONSTRAINT note_id IF NOT EXISTS FOR (n:Note) REQUIRE n.id IS UNIQUE",
    ]

    async with driver.session() as session:
        for cypher in constraints:
            await session.run(cypher)

    # Graphiti builds its own indices in Neo4j
    g = get_graphiti()
    await g.build_indices_and_constraints()


async def close() -> None:
    """Close all connections. Call on app shutdown."""
    await get_driver().close()
    await get_graphiti().close()
