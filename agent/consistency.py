"""
Consistency Check Agent.

Fetches full KG context for a project, then asks the LLM to analyse
a scene for continuity/consistency issues:
  - Character behaviour vs. psychology (GOLEM)
  - Relationship contradictions
  - Location / timeline errors
  - Unresolved plot threads referenced but not planted
  - Faction alignment conflicts

Returns a list of structured issue dicts:
  {
    "type":        str,   # character | relationship | location | plot | faction
    "severity":    str,   # warning | error
    "entity":      str,   # name of the entity involved
    "description": str,   # what went wrong
    "suggestion":  str,   # how to fix it
  }
"""
from __future__ import annotations

import json
import re
from typing import Any

from .config import chat, get_model
from .logger import AgentLogger
from kg import crud


# ─────────────────────────────────────────────
# KG context builder
# ─────────────────────────────────────────────

async def _build_kg_context(project_id: str) -> dict[str, Any]:
    """Fetch all KG entities relevant to consistency checking."""
    chars     = await crud.list_characters(project_id)
    factions  = await crud.list_factions(project_id)
    locations = await crud.list_locations(project_id)
    threads   = await crud.list_all_plot_threads(project_id)
    artifacts = await crud.list_artifacts(project_id)

    return {
        "characters": chars,
        "factions":   factions,
        "locations":  locations,
        "plot_threads": threads,
        "artifacts":  artifacts,
    }


def _format_kg_for_prompt(ctx: dict[str, Any]) -> str:
    """Render KG context as a structured text block for the prompt."""
    lines: list[str] = []

    if ctx["characters"]:
        lines.append("## Characters")
        for c in ctx["characters"]:
            lines.append(
                f"- {c.get('name', c['id'])} (role={c.get('role','')}, "
                f"faction={c.get('faction_id','')}, "
                f"core_desire={c.get('core_desire','')}, "
                f"core_fear={c.get('core_fear','')}, "
                f"moral_code={c.get('moral_code','')}, "
                f"current_state={c.get('current_state','')})"
            )

    if ctx["factions"]:
        lines.append("\n## Factions")
        for f in ctx["factions"]:
            lines.append(
                f"- {f.get('name', f['id'])} (ideology={f.get('ideology','')}, "
                f"power={f.get('power_level','')})"
            )

    if ctx["locations"]:
        lines.append("\n## Locations")
        for loc in ctx["locations"]:
            lines.append(
                f"- {loc.get('name', loc['id'])} (atmosphere={loc.get('atmosphere','')})"
            )

    if ctx["plot_threads"]:
        lines.append("\n## Plot Threads")
        for t in ctx["plot_threads"]:
            lines.append(
                f"- [{t.get('status','?')}] {t.get('name', t['id'])}: "
                f"{t.get('description','')}"
            )

    if ctx["artifacts"]:
        lines.append("\n## Artifacts")
        for a in ctx["artifacts"]:
            lines.append(
                f"- {a.get('name', a['id'])} (owner={a.get('current_owner','')}, "
                f"power={a.get('power','')})"
            )

    return "\n".join(lines) if lines else "(no KG data)"


# ─────────────────────────────────────────────
# Prompt
# ─────────────────────────────────────────────

_SYSTEM = """\
You are a narrative consistency checker for a fiction-writing assistant.
You will be given:
1. The story world's Knowledge Graph (KG) — characters, factions, locations, plot threads, artifacts.
2. A draft scene written by the author.

Your job is to identify consistency issues: contradictions between the scene and the KG data,
character behaviour that conflicts with their psychology, impossible locations, unresolved or
wrongly-referenced plot threads, faction alignment violations, etc.

Return your findings as a JSON array. Each issue must be an object with exactly these keys:
  "type"        — one of: "character", "relationship", "location", "plot", "faction", "artifact"
  "severity"    — one of: "warning", "error"
  "entity"      — the name of the character / location / etc. involved
  "description" — concise description of the inconsistency
  "suggestion"  — a concrete fix suggestion

If the scene is fully consistent with the KG, return an empty array: []

Return ONLY the JSON array, no prose, no markdown fences.
"""


def _build_messages(kg_text: str, scene_content: str) -> list[dict]:
    user_content = (
        f"# Knowledge Graph\n{kg_text}\n\n"
        f"# Draft Scene\n{scene_content}"
    )
    return [
        {"role": "system", "content": _SYSTEM},
        {"role": "user",   "content": user_content},
    ]


# ─────────────────────────────────────────────
# Parser
# ─────────────────────────────────────────────

def _parse_issues(raw: str) -> list[dict]:
    """Extract JSON array from LLM response; return [] on failure."""
    text = raw.strip()

    # Strip optional markdown fences
    text = re.sub(r"^```[a-z]*\n?", "", text)
    text = re.sub(r"\n?```$", "", text)
    text = text.strip()

    try:
        data = json.loads(text)
        if isinstance(data, list):
            return data
    except json.JSONDecodeError:
        pass

    # Try to locate a JSON array anywhere in the response
    m = re.search(r"\[.*\]", text, re.DOTALL)
    if m:
        try:
            data = json.loads(m.group(0))
            if isinstance(data, list):
                return data
        except json.JSONDecodeError:
            pass

    return []


# ─────────────────────────────────────────────
# Public API
# ─────────────────────────────────────────────

async def check_consistency(
    scene_content: str,
    project_id: str,
    logger: AgentLogger | None = None,
) -> list[dict]:
    """
    Run the consistency check and return a (possibly empty) list of issues.

    Parameters
    ----------
    scene_content:
        Plain text or HTML of the scene to check.
    project_id:
        The project whose KG to use as reference.
    logger:
        Optional AgentLogger. A temporary one is created if None.
    """
    if logger is None:
        logger = AgentLogger()

    logger.start_timer("consistency")

    # 1. Fetch KG
    kg_ctx  = await _build_kg_context(project_id)
    kg_text = _format_kg_for_prompt(kg_ctx)

    # 2. Build messages
    messages = _build_messages(kg_text, scene_content)

    # 3. LLM call
    model = get_model("consistency")
    raw   = await chat("consistency", messages, temperature=0.2, max_tokens=2048)

    latency = logger.elapsed_ms("consistency")

    # 4. Parse
    issues = _parse_issues(raw)

    # 5. Log
    kg_nodes = (
        [c.get("name", c["id"]) for c in kg_ctx["characters"]]
        + [f.get("name", f["id"]) for f in kg_ctx["factions"]]
    )
    logger.log(
        "consistency_check",
        tools_called=["check_consistency"],
        kg_nodes_accessed=kg_nodes,
        model_used=model,
        latency_ms=latency,
        extra={"issues_found": len(issues)},
    )

    return issues
