"""
NarrativeOS MCP Server (Week 2).

Tool groups:
  Query   — read-only KG lookups
  Generate — LLM-powered content generation
  Check   — consistency & voice validation
  KG Update — suggest & apply KG mutations (author confirms first)
"""
from __future__ import annotations

import json

from fastmcp import FastMCP

from kg import crud
from kg.client import init_schema
from agent.config import chat

mcp = FastMCP("NarrativeOS")


# ─────────────────────────────────────────────
# Query Tools (read-only)
# ─────────────────────────────────────────────

@mcp.tool()
async def query_character(name: str, project_id: str) -> str:
    """
    Look up a character's full profile from the KG:
    psychology (GOLEM core), current state, speech style, arc position.
    """
    char = await crud.get_character_by_name(name, project_id)
    if not char:
        return f"Character '{name}' not found in project {project_id}."
    return json.dumps(char, ensure_ascii=False, indent=2)


@mcp.tool()
async def get_active_foreshadowing(project_id: str) -> str:
    """
    Return all active (unresolved) plot threads / foreshadowing for the project.
    """
    threads = await crud.list_active_plot_threads(project_id)
    if not threads:
        return "No active plot threads found."
    return json.dumps(threads, ensure_ascii=False, indent=2)


@mcp.tool()
async def get_character_relationship(char_a_name: str, char_b_name: str, project_id: str) -> str:
    """
    Return the current relationship state between two characters,
    including trust level, public vs. true face, and known secrets.
    """
    a = await crud.get_character_by_name(char_a_name, project_id)
    b = await crud.get_character_by_name(char_b_name, project_id)
    if not a:
        return f"Character '{char_a_name}' not found."
    if not b:
        return f"Character '{char_b_name}' not found."

    rel = await crud.get_character_relationship(a["id"], b["id"])
    if not rel:
        # Try reverse direction
        rel = await crud.get_character_relationship(b["id"], a["id"])
    if not rel:
        return f"No relationship found between {char_a_name} and {char_b_name}."
    return json.dumps(rel, ensure_ascii=False, indent=2)


@mcp.tool()
async def get_chapter_context(project_id: str, chapter_title: str = "") -> str:
    """
    Return a distilled context pack for writing the next scene:
    - active foreshadowing list
    - all characters (name + current_state + speech_style)
    - locations
    - active factions summary

    This is a curated subset, NOT the full KG dump.
    """
    threads = await crud.list_active_plot_threads(project_id)
    characters = await crud.list_characters(project_id)
    locations = await crud.list_locations(project_id)
    factions = await crud.list_factions(project_id)

    # Distil characters to relevant fields only
    char_summary = [
        {
            "name": c["name"],
            "role": c.get("role", ""),
            "current_state": c.get("current_state", ""),
            "core_desire": c.get("core_desire", ""),
            "core_fear": c.get("core_fear", ""),
            "speech_style": c.get("speech_style", ""),
        }
        for c in characters
    ]

    context = {
        "chapter_title": chapter_title,
        "active_foreshadowing": [
            {"name": t["name"], "description": t["description"]}
            for t in threads
        ],
        "characters": char_summary,
        "locations": [{"name": loc["name"], "atmosphere": loc.get("atmosphere", "")} for loc in locations],
        "factions": [{"name": f["name"], "ideology": f.get("ideology", "")} for f in factions],
    }
    return json.dumps(context, ensure_ascii=False, indent=2)


@mcp.tool()
async def list_locations(project_id: str) -> str:
    """Return all locations for a project."""
    locs = await crud.list_locations(project_id)
    return json.dumps(locs, ensure_ascii=False, indent=2)


@mcp.tool()
async def list_characters(project_id: str) -> str:
    """Return all characters for a project."""
    chars = await crud.list_characters(project_id)
    return json.dumps(chars, ensure_ascii=False, indent=2)


# ─────────────────────────────────────────────
# Generate Tools
# ─────────────────────────────────────────────

@mcp.tool()
async def suggest_scene_direction(intent: str, project_id: str) -> str:
    """
    Given the author's intent, query the KG and return:
    - 2-3 scene direction suggestions
    - relevant foreshadowing to consider
    - character relationship opportunities
    - suggested emotional tone

    Returns suggestions only. Author confirms before generation starts.
    """
    # Pull context from KG
    threads = await crud.list_active_plot_threads(project_id)
    characters = await crud.list_characters(project_id)

    context_str = f"Active foreshadowing: {json.dumps([t['name'] + ': ' + t['description'] for t in threads], ensure_ascii=False)}\n"
    context_str += f"Characters: {json.dumps([c['name'] + ' — ' + c.get('current_state', '') for c in characters], ensure_ascii=False)}"

    messages = [
        {
            "role": "system",
            "content": (
                "You are Story Director, an assistant helping an author write a novel. "
                "Your job is to suggest scene directions — NOT to write the scene itself. "
                "Speak directly to the author. Be concise and inspiring. "
                "Always propose 2-3 distinct directions. "
                "Flag which active foreshadowing threads could be woven in. "
                "Output in the same language as the author's intent."
            ),
        },
        {
            "role": "user",
            "content": (
                f"Author's intent: {intent}\n\n"
                f"Current KG context:\n{context_str}\n\n"
                "Please suggest 2-3 scene directions. For each, include:\n"
                "1. Direction summary (1-2 sentences)\n"
                "2. Emotional tone suggestion\n"
                "3. Which foreshadowing threads could appear\n"
                "4. Character dynamic to highlight"
            ),
        },
    ]

    response = await chat("director", messages, temperature=0.8, max_tokens=1024)
    return response


@mcp.tool()
async def write_scene(
    intent: str,
    confirmed_direction: str,
    project_id: str,
    pov_character: str = "",
    location: str = "",
    target_words: int = 800,
) -> str:
    """
    Generate a scene draft. Only call this after the author has confirmed
    a direction from suggest_scene_direction.

    Args:
        intent: Author's original intent
        confirmed_direction: The direction the author chose/described
        project_id: Project ID for KG context
        pov_character: POV character name (optional)
        location: Scene location name (optional)
        target_words: Approximate target word count
    """
    # Pull full KG context
    characters = await crud.list_characters(project_id)
    threads = await crud.list_active_plot_threads(project_id)
    locations = await crud.list_locations(project_id)

    # Find POV character details
    pov_detail = ""
    if pov_character:
        pov_char = next((c for c in characters if c["name"] == pov_character), None)
        if pov_char:
            pov_detail = (
                f"POV Character: {pov_char['name']}\n"
                f"  Current state: {pov_char.get('current_state', '')}\n"
                f"  Speech style: {pov_char.get('speech_style', '')}\n"
                f"  Core fear: {pov_char.get('core_fear', '')}\n"
            )

    # Find location details
    loc_detail = ""
    if location:
        loc = next((loc for loc in locations if loc["name"] == location), None)
        if loc:
            loc_detail = f"Location: {loc['name']}\n  Atmosphere: {loc.get('atmosphere', '')}\n"

    char_profiles = "\n".join(
        f"- {c['name']} ({c.get('role', '')}): {c.get('current_state', '')} | speech: {c.get('speech_style', '')}"
        for c in characters
    )
    active_threads = "\n".join(f"- {t['name']}: {t['description']}" for t in threads)

    messages = [
        {
            "role": "system",
            "content": (
                "You are a skilled novelist. Write vivid, emotionally resonant prose in the author's chosen language. "
                "Show don't tell. Use the character psychology provided to make dialogue and actions feel authentic. "
                "Weave in foreshadowing naturally — don't force it. "
                "Write in the same language as the author's intent and confirmed direction."
            ),
        },
        {
            "role": "user",
            "content": (
                f"Write a scene with approximately {target_words} words.\n\n"
                f"Author's intent: {intent}\n"
                f"Confirmed direction: {confirmed_direction}\n\n"
                f"{pov_detail}"
                f"{loc_detail}"
                f"Character profiles:\n{char_profiles}\n\n"
                f"Active foreshadowing to consider (weave in naturally if appropriate):\n{active_threads}\n\n"
                "Write the scene now:"
            ),
        },
    ]

    response = await chat("write_scene", messages, temperature=0.85, max_tokens=2048)
    return response


@mcp.tool()
async def generate_dialogue(
    character_names: list[str],
    scene_context: str,
    project_id: str,
) -> str:
    """
    Generate dialogue for a scene based on each character's speech style from the KG.
    """
    char_profiles = []
    for name in character_names:
        char = await crud.get_character_by_name(name, project_id)
        if char:
            char_profiles.append({
                "name": char["name"],
                "speech_style": char.get("speech_style", ""),
                "speech_samples": char.get("speech_samples", []),
                "current_state": char.get("current_state", ""),
            })

    if not char_profiles:
        return "No matching characters found."

    messages = [
        {
            "role": "system",
            "content": (
                "You are a dialogue specialist. Write natural, character-authentic dialogue. "
                "Each character must sound distinctly different based on their speech style. "
                "Use the speech samples as reference for tone, not copy them directly. "
                "Write in the same language as the scene context."
            ),
        },
        {
            "role": "user",
            "content": (
                f"Scene context: {scene_context}\n\n"
                f"Character profiles:\n{json.dumps(char_profiles, ensure_ascii=False, indent=2)}\n\n"
                "Write the dialogue exchange:"
            ),
        },
    ]

    return await chat("dialogue", messages, temperature=0.9, max_tokens=1024)


# ─────────────────────────────────────────────
# Check Tools
# ─────────────────────────────────────────────

@mcp.tool()
async def check_consistency(scene_content: str, project_id: str) -> str:
    """
    Compare scene content against the KG and return a list of potential issues:
    - Character attribute contradictions
    - Relationship logic violations
    - Unresolved foreshadowing warnings
    """
    characters = await crud.list_characters(project_id)
    threads = await crud.list_active_plot_threads(project_id)
    locations = await crud.list_locations(project_id)

    kg_summary = {
        "characters": [
            {
                "name": c["name"],
                "current_state": c.get("current_state", ""),
                "belief": c.get("belief", ""),
                "moral_code": c.get("moral_code", ""),
            }
            for c in characters
        ],
        "active_foreshadowing": [t["name"] for t in threads],
        "locations": [loc["name"] for loc in locations],
    }

    messages = [
        {
            "role": "system",
            "content": (
                "You are a story continuity editor. Analyse the scene for consistency issues. "
                "Be specific — cite the problematic text and explain why it conflicts with the KG. "
                "Return a JSON list of issues, each with: type, description, severity (low/medium/high). "
                "If no issues found, return an empty list []."
            ),
        },
        {
            "role": "user",
            "content": (
                f"KG snapshot:\n{json.dumps(kg_summary, ensure_ascii=False, indent=2)}\n\n"
                f"Scene to check:\n{scene_content}\n\n"
                "Return JSON array of consistency issues."
            ),
        },
    ]

    return await chat("consistency", messages, temperature=0.2, max_tokens=1024)


@mcp.tool()
async def check_voice_consistency(dialogue: str, character_name: str, project_id: str) -> str:
    """
    Check whether dialogue matches the character's established speech style.
    Returns a dict with: matches (bool), score (0-10), issues (list), suggestions (list).
    """
    char = await crud.get_character_by_name(character_name, project_id)
    if not char:
        return json.dumps({"error": f"Character '{character_name}' not found."})

    messages = [
        {
            "role": "system",
            "content": (
                "You are a dialogue authenticity checker. "
                "Evaluate whether the given dialogue matches the character's voice profile. "
                "Return a JSON object with: matches (bool), score (0-10), issues (list of strings), suggestions (list of strings)."
            ),
        },
        {
            "role": "user",
            "content": (
                f"Character: {char['name']}\n"
                f"Speech style: {char.get('speech_style', '')}\n"
                f"Speech samples: {json.dumps(char.get('speech_samples', []), ensure_ascii=False)}\n"
                f"Current emotional state: {char.get('current_state', '')}\n\n"
                f"Dialogue to check:\n{dialogue}\n\n"
                "Return JSON."
            ),
        },
    ]

    return await chat("director", messages, temperature=0.2, max_tokens=512)


# ─────────────────────────────────────────────
# KG Update Tools (author confirms before write)
# ─────────────────────────────────────────────

@mcp.tool()
async def suggest_kg_updates(scene_content: str, project_id: str) -> str:
    """
    Analyse the scene and suggest KG updates:
    - Character state changes
    - Relationship trust_level deltas
    - New foreshadowing to add
    - Foreshadowing to mark as resolved

    Returns a diff dict for the author to review — does NOT write to KG yet.
    """
    characters = await crud.list_characters(project_id)
    threads = await crud.list_active_plot_threads(project_id)

    kg_state = {
        "characters": [
            {"id": c["id"], "name": c["name"], "current_state": c.get("current_state", "")}
            for c in characters
        ],
        "active_threads": [
            {"id": t["id"], "name": t["name"], "status": t.get("status", "")}
            for t in threads
        ],
    }

    messages = [
        {
            "role": "system",
            "content": (
                "You are a story knowledge graph manager. "
                "Analyse the scene and suggest what KG nodes need updating. "
                "Return a JSON object with these keys:\n"
                "  character_state_changes: [{character_id, character_name, old_state, new_state}]\n"
                "  relationship_changes: [{char_a, char_b, trust_delta, reason}]\n"
                "  new_plot_threads: [{name, description, planted_at}]\n"
                "  resolved_plot_threads: [{thread_id, thread_name, resolution_summary}]\n"
                "Only include items that clearly changed in the scene."
            ),
        },
        {
            "role": "user",
            "content": (
                f"Current KG state:\n{json.dumps(kg_state, ensure_ascii=False, indent=2)}\n\n"
                f"Scene content:\n{scene_content}\n\n"
                "Suggest KG updates (JSON):"
            ),
        },
    ]

    return await chat("director", messages, temperature=0.3, max_tokens=1024)


@mcp.tool()
async def apply_kg_updates(confirmed_updates: str, project_id: str) -> str:
    """
    Apply confirmed KG updates. Only call this after the author has reviewed
    the output of suggest_kg_updates and confirmed the changes.

    confirmed_updates: JSON string from suggest_kg_updates (may be partially edited by author).
    """
    try:
        updates = json.loads(confirmed_updates)
    except json.JSONDecodeError as e:
        return f"Invalid JSON in confirmed_updates: {e}"

    results = []

    # Apply character state changes
    for change in updates.get("character_state_changes", []):
        char_id = change.get("character_id")
        new_state = change.get("new_state", "")
        if char_id and new_state:
            updated = await crud.update_character_state(char_id, new_state)
            if updated:
                results.append(f"✓ Updated {change.get('character_name', char_id)} state → {new_state}")

    # Apply relationship changes (trust level)
    for rel_change in updates.get("relationship_changes", []):
        char_a_name = rel_change.get("char_a")
        char_b_name = rel_change.get("char_b")
        delta = rel_change.get("trust_delta", 0)
        if char_a_name and char_b_name and delta:
            a = await crud.get_character_by_name(char_a_name, project_id)
            b = await crud.get_character_by_name(char_b_name, project_id)
            if a and b:
                rel = await crud.get_character_relationship(a["id"], b["id"])
                current_trust = rel.get("trust_level", 0) if rel else 0
                from kg.schema import CharacterRelationshipEdge
                await crud.upsert_character_relationship(CharacterRelationshipEdge(
                    source_id=a["id"],
                    target_id=b["id"],
                    trust_level=current_trust + delta,
                ))
                results.append(f"✓ {char_a_name}↔{char_b_name} trust: {current_trust} → {current_trust + delta}")

    # Resolve plot threads
    for resolved in updates.get("resolved_plot_threads", []):
        thread_id = resolved.get("thread_id")
        summary = resolved.get("resolution_summary", "")
        if thread_id:
            await crud.resolve_plot_thread(thread_id, summary)
            results.append(f"✓ Resolved plot thread: {resolved.get('thread_name', thread_id)}")

    # Add new plot threads
    from kg.schema import PlotThreadNode
    for new_thread in updates.get("new_plot_threads", []):
        pt = PlotThreadNode(
            project_id=project_id,
            name=new_thread.get("name", ""),
            description=new_thread.get("description", ""),
            planted_at=new_thread.get("planted_at", ""),
            status="active",
        )
        await crud.create_plot_thread(pt)
        results.append(f"✓ Added plot thread: {pt.name}")

    if not results:
        return "No updates applied (empty or unrecognised confirmed_updates)."
    return "\n".join(results)


# ─────────────────────────────────────────────
# Entry point (run as standalone MCP server)
# ─────────────────────────────────────────────

async def startup() -> None:
    await init_schema()


if __name__ == "__main__":
    import asyncio
    asyncio.run(startup())
    mcp.run()
