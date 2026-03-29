"""
Tool definitions for the Director LLM (function-calling schema + handlers).

Split into two groups:
  QUERY_TOOLS   — KG read-only tools the Director uses to gather context
  GENERATE_TOOLS — generation/update tools called after author confirms
"""
from __future__ import annotations

import json
from typing import Any

from kg import crud


# ─────────────────────────────────────────────
# LiteLLM-compatible tool schemas
# ─────────────────────────────────────────────

QUERY_TOOL_SCHEMAS = [
    {
        "type": "function",
        "function": {
            "name": "query_character",
            "description": "Look up a character's full profile: psychology, current state, speech style, arc.",
            "parameters": {
                "type": "object",
                "properties": {
                    "name": {"type": "string", "description": "Character name"},
                    "project_id": {"type": "string", "description": "Project ID"},
                },
                "required": ["name", "project_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_active_foreshadowing",
            "description": "Return all unresolved plot threads / foreshadowing for the project.",
            "parameters": {
                "type": "object",
                "properties": {
                    "project_id": {"type": "string"},
                },
                "required": ["project_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_character_relationship",
            "description": "Return the current relationship between two characters: trust level, public vs true face.",
            "parameters": {
                "type": "object",
                "properties": {
                    "char_a_name": {"type": "string"},
                    "char_b_name": {"type": "string"},
                    "project_id": {"type": "string"},
                },
                "required": ["char_a_name", "char_b_name", "project_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_chapter_context",
            "description": "Return a distilled context pack: characters, foreshadowing, locations, factions.",
            "parameters": {
                "type": "object",
                "properties": {
                    "project_id": {"type": "string"},
                    "chapter_title": {"type": "string", "description": "Optional current chapter title"},
                },
                "required": ["project_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "list_locations",
            "description": "Return all locations and their atmosphere descriptions.",
            "parameters": {
                "type": "object",
                "properties": {
                    "project_id": {"type": "string"},
                },
                "required": ["project_id"],
            },
        },
    },
]


# ─────────────────────────────────────────────
# Tool handlers (call actual KG CRUD functions)
# ─────────────────────────────────────────────

async def execute_tool(name: str, args: dict[str, Any]) -> str:
    """Dispatch a tool call to the appropriate KG function."""

    if name == "query_character":
        char = await crud.get_character_by_name(args["name"], args["project_id"])
        if not char:
            return f"Character '{args['name']}' not found."
        # Return only relevant fields to save tokens
        return json.dumps({
            "name": char["name"],
            "role": char.get("role", ""),
            "current_state": char.get("current_state", ""),
            "core_desire": char.get("core_desire", ""),
            "core_fear": char.get("core_fear", ""),
            "wound": char.get("wound", ""),
            "belief": char.get("belief", ""),
            "speech_style": char.get("speech_style", ""),
            "speech_samples": char.get("speech_samples", [])[:2],
            "arc_start": char.get("arc_start", ""),
            "arc_end": char.get("arc_end", ""),
        }, ensure_ascii=False, indent=2)

    elif name == "get_active_foreshadowing":
        threads = await crud.list_active_plot_threads(args["project_id"])
        return json.dumps(
            [{"name": t["name"], "description": t["description"], "id": t["id"]} for t in threads],
            ensure_ascii=False, indent=2
        )

    elif name == "get_character_relationship":
        a = await crud.get_character_by_name(args["char_a_name"], args["project_id"])
        b = await crud.get_character_by_name(args["char_b_name"], args["project_id"])
        if not a or not b:
            return "One or both characters not found."
        rel = await crud.get_character_relationship(a["id"], b["id"])
        if not rel:
            rel = await crud.get_character_relationship(b["id"], a["id"])
        return json.dumps(rel, ensure_ascii=False, indent=2) if rel else "No relationship found."

    elif name == "get_chapter_context":
        threads = await crud.list_active_plot_threads(args["project_id"])
        characters = await crud.list_characters(args["project_id"])
        locations = await crud.list_locations(args["project_id"])
        factions = await crud.list_factions(args["project_id"])
        return json.dumps({
            "active_foreshadowing": [{"name": t["name"], "description": t["description"]} for t in threads],
            "characters": [{"name": c["name"], "current_state": c.get("current_state", "")} for c in characters],
            "locations": [{"name": loc["name"], "atmosphere": loc.get("atmosphere", "")} for loc in locations],
            "factions": [{"name": f["name"]} for f in factions],
        }, ensure_ascii=False, indent=2)

    elif name == "list_locations":
        locs = await crud.list_locations(args["project_id"])
        return json.dumps(
            [{"name": loc["name"], "atmosphere": loc.get("atmosphere", ""), "significance": loc.get("significance", "")} for loc in locs],
            ensure_ascii=False, indent=2
        )

    return f"Unknown tool: {name}"
