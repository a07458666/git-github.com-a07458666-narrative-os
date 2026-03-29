"""
Story Director Agent — the core agent loop.

Flow (CLI version):
  1. Author states intent
  2. Director pre-fetches KG context, generates suggestions (single LLM call)
  3. Author confirms direction (or refines)
  4. Director generates scene (streaming)
  5. Director suggests KG updates (single LLM call)
  6. Author confirms each update
  7. KG updated

Design note: We use "context-stuffing" instead of agentic tool-calling.
All relevant KG data is fetched first, then passed to the LLM in one call.
This avoids Gemini thinking-model thought_signature issues and uses fewer API calls.

WebSocket version (Week 4) will reuse this class with a different I/O adapter.
"""
from __future__ import annotations

import json
from dataclasses import dataclass, field
from typing import AsyncIterator

import litellm

from .config import TASK_MODEL_MAP, stream_chat
from .logger import AgentLogger
from kg import crud
from kg.schema import PlotThreadNode


# ─────────────────────────────────────────────
# Data classes
# ─────────────────────────────────────────────

@dataclass
class DirectorResponse:
    suggestions: str
    kg_nodes: list[str]
    token_count: int = 0


@dataclass
class SessionState:
    project_id: str
    intent: str
    confirmed_direction: str = ""
    scene_draft: str = ""
    kg_update_suggestions: str = ""
    history: list[dict] = field(default_factory=list)


# ─────────────────────────────────────────────
# Director Agent
# ─────────────────────────────────────────────

DIRECTOR_SYSTEM = """You are Story Director, an AI assistant helping an author write a novel.

You are given the current Knowledge Graph state and the author's intent.
Your job:
1. Present 2-3 concrete scene direction options grounded in the KG data
2. For each direction, mention which foreshadowing threads could appear naturally
3. Note the recommended emotional tone and character dynamic to highlight
4. Ask one clarifying question if the intent is too vague

Rules:
- Suggestions must respect each character's psychology (core desire / fear / belief)
- Weave in foreshadowing — never force it
- Be concise and inspiring, not verbose
- Reply in the SAME language as the author's intent
- Do NOT write the scene — that comes after the author confirms"""


class StoryDirectorAgent:
    def __init__(self, project_id: str, logger: AgentLogger | None = None):
        self.project_id = project_id
        self.logger = logger or AgentLogger()
        self._model = TASK_MODEL_MAP["director"]

    # ── KG context fetcher ────────────────────────────────────

    async def _fetch_kg_context(self) -> tuple[dict, list[str]]:
        """Fetch all relevant KG data. Returns (context_dict, kg_node_labels)."""
        characters = await crud.list_characters(self.project_id)
        threads    = await crud.list_active_plot_threads(self.project_id)
        locations  = await crud.list_locations(self.project_id)
        factions   = await crud.list_factions(self.project_id)

        context = {
            "characters": [
                {
                    "name":          c["name"],
                    "role":          c.get("role", ""),
                    "current_state": c.get("current_state", ""),
                    "core_desire":   c.get("core_desire", ""),
                    "core_fear":     c.get("core_fear", ""),
                    "belief":        c.get("belief", ""),
                    "speech_style":  c.get("speech_style", ""),
                }
                for c in characters
            ],
            "active_foreshadowing": [
                {"name": t["name"], "description": t["description"], "id": t["id"]}
                for t in threads
            ],
            "locations": [
                {"name": loc["name"], "atmosphere": loc.get("atmosphere", "")}
                for loc in locations
            ],
            "factions": [
                {"name": f["name"], "ideology": f.get("ideology", "")}
                for f in factions
            ],
        }

        nodes = (
            [f"Character:{c['name']}" for c in characters]
            + ["PlotThreads:active"]
            + [f"Location:{loc['name']}" for loc in locations]
        )
        return context, nodes

    # ── Phase 1: Suggest scene directions ────────────────────

    async def query_and_suggest(self, intent: str, history: list[dict]) -> DirectorResponse:
        """
        Fetch KG context, pass it to Director LLM in one call, return suggestions.
        No tool-calling loop — avoids Gemini thought_signature issues.
        """
        self.logger.start_timer("query")
        context, kg_nodes = await self._fetch_kg_context()

        messages = [
            {"role": "system", "content": DIRECTOR_SYSTEM},
            *history,
            {
                "role": "user",
                "content": (
                    f"## Author's intent\n{intent}\n\n"
                    f"## Current Knowledge Graph\n"
                    f"{json.dumps(context, ensure_ascii=False, indent=2)}\n\n"
                    "Please suggest 2-3 scene directions."
                ),
            },
        ]

        response = await litellm.acompletion(
            model=self._model,
            messages=messages,
            temperature=0.8,
            max_tokens=1024,
        )

        suggestions = response.choices[0].message.content or ""
        tokens = response.usage.total_tokens if response.usage else 0
        latency = self.logger.elapsed_ms("query")
        self.logger.log_query(["kg_context_fetch"], kg_nodes, self._model, latency)

        return DirectorResponse(suggestions=suggestions, kg_nodes=kg_nodes, token_count=tokens)

    # ── Phase 2: Stream scene generation ─────────────────────

    async def stream_scene(
        self,
        intent: str,
        confirmed_direction: str,
        pov_character: str = "",
        location: str = "",
        target_words: int = 800,
    ) -> AsyncIterator[str]:
        """Stream a scene draft after the author confirms direction."""
        characters = await crud.list_characters(self.project_id)
        threads    = await crud.list_active_plot_threads(self.project_id)
        locations  = await crud.list_locations(self.project_id)

        pov_detail = ""
        if pov_character:
            pov = next((c for c in characters if c["name"] == pov_character), None)
            if pov:
                pov_detail = (
                    f"POV: {pov['name']} | state: {pov.get('current_state','')} | "
                    f"fear: {pov.get('core_fear','')} | speech: {pov.get('speech_style','')}\n"
                )

        loc_detail = ""
        if location:
            loc = next((loc for loc in locations if loc["name"] == location), None)
            if loc:
                loc_detail = f"Location: {loc['name']} — {loc.get('atmosphere','')}\n"

        char_summary = "\n".join(
            f"- {c['name']} ({c.get('role','')}): {c.get('current_state','')} | speech: {c.get('speech_style','')}"
            for c in characters
        )
        thread_summary = "\n".join(
            f"- {t['name']}: {t['description']}" for t in threads
        )

        messages = [
            {
                "role": "system",
                "content": (
                    "You are a skilled novelist. Write vivid, emotionally resonant prose. "
                    "Show don't tell. Ground dialogue in each character's established voice. "
                    "Weave in foreshadowing naturally — never force it. "
                    "Write in the same language as the author's intent."
                ),
            },
            {
                "role": "user",
                "content": (
                    f"Write a scene (~{target_words} words).\n\n"
                    f"Intent: {intent}\n"
                    f"Direction: {confirmed_direction}\n\n"
                    f"{pov_detail}{loc_detail}"
                    f"Characters:\n{char_summary}\n\n"
                    f"Active foreshadowing (weave in if natural):\n{thread_summary}"
                ),
            },
        ]

        self.logger.start_timer("generate")
        chunk_count = 0

        async for chunk in stream_chat("write_scene", messages, temperature=0.85, max_tokens=3000):
            chunk_count += 1
            yield chunk

        latency = self.logger.elapsed_ms("generate")
        self.logger.log_generation("write_scene", TASK_MODEL_MAP["write_scene"], 0, chunk_count, latency)

    # ── Phase 3: Suggest KG updates ──────────────────────────

    async def suggest_kg_updates(self, scene_content: str) -> str:
        """Analyse the scene and suggest what KG nodes need updating."""
        characters = await crud.list_characters(self.project_id)
        threads    = await crud.list_active_plot_threads(self.project_id)

        kg_state = {
            "characters": [
                {"id": c["id"], "name": c["name"], "current_state": c.get("current_state", "")}
                for c in characters
            ],
            "active_threads": [
                {"id": t["id"], "name": t["name"]}
                for t in threads
            ],
        }

        messages = [
            {
                "role": "system",
                "content": (
                    "You are a story knowledge graph manager. "
                    "Analyse the scene and suggest KG updates. "
                    "Return ONLY a JSON object with these keys:\n"
                    "  character_state_changes: [{character_id, character_name, old_state, new_state}]\n"
                    "  relationship_changes: [{char_a, char_b, trust_delta, reason}]\n"
                    "  new_plot_threads: [{name, description, planted_at}]\n"
                    "  resolved_plot_threads: [{thread_id, thread_name, resolution_summary}]\n"
                    "Only include changes clearly evidenced in the scene. Return valid JSON only, no markdown."
                ),
            },
            {
                "role": "user",
                "content": (
                    f"KG state:\n{json.dumps(kg_state, ensure_ascii=False)}\n\n"
                    f"Scene:\n{scene_content}\n\nReturn JSON:"
                ),
            },
        ]

        self.logger.start_timer("kg_suggest")
        response = await litellm.acompletion(
            model=self._model,
            messages=messages,
            temperature=0.2,
            max_tokens=1024,
        )
        latency = self.logger.elapsed_ms("kg_suggest")
        self.logger.log("kg_suggest", model_used=self._model, latency_ms=latency)

        return response.choices[0].message.content or "{}"

    # ── Phase 4: Apply confirmed KG updates ──────────────────

    async def apply_kg_updates(self, confirmed_json: str) -> list[str]:
        """Apply confirmed KG updates. Returns list of applied change descriptions."""
        # Strip markdown code fences if LLM added them
        text = confirmed_json.strip()
        if text.startswith("```"):
            text = text.split("\n", 1)[-1]
            text = text.rsplit("```", 1)[0]

        try:
            updates = json.loads(text)
        except json.JSONDecodeError:
            return ["Error: invalid JSON — no updates applied."]

        results: list[str] = []
        self.logger.start_timer("kg_apply")

        for change in updates.get("character_state_changes", []):
            char_id  = change.get("character_id", "")
            new_state = change.get("new_state", "")
            if char_id and new_state:
                updated = await crud.update_character_state(char_id, new_state)
                if updated:
                    results.append(f"✓ {change.get('character_name', char_id)}: state updated")

        for rel in updates.get("relationship_changes", []):
            a     = await crud.get_character_by_name(rel.get("char_a", ""), self.project_id)
            b     = await crud.get_character_by_name(rel.get("char_b", ""), self.project_id)
            delta = int(rel.get("trust_delta", 0))
            if a and b and delta:
                existing = await crud.get_character_relationship(a["id"], b["id"])
                current  = existing.get("trust_level", 0) if existing else 0
                from kg.schema import CharacterRelationshipEdge
                await crud.upsert_character_relationship(CharacterRelationshipEdge(
                    source_id=a["id"],
                    target_id=b["id"],
                    trust_level=current + delta,
                ))
                results.append(
                    f"✓ {rel['char_a']}↔{rel['char_b']} trust: {current} → {current+delta}"
                    + (f" ({rel.get('reason','')})" if rel.get("reason") else "")
                )

        for resolved in updates.get("resolved_plot_threads", []):
            tid = resolved.get("thread_id", "")
            if tid:
                await crud.resolve_plot_thread(tid, resolved.get("resolution_summary", ""))
                results.append(f"✓ Resolved: {resolved.get('thread_name', tid)}")

        for new_pt in updates.get("new_plot_threads", []):
            pt = PlotThreadNode(
                project_id=self.project_id,
                name=new_pt.get("name", ""),
                description=new_pt.get("description", ""),
                planted_at=new_pt.get("planted_at", ""),
                status="active",
            )
            await crud.create_plot_thread(pt)
            results.append(f"✓ New foreshadowing: {pt.name}")

        latency = self.logger.elapsed_ms("kg_apply")
        self.logger.log_kg_update(results, latency)

        return results if results else ["No changes applied."]
