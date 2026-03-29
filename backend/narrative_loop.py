"""
Core narrative loop — I/O-agnostic.

Used by:
  - backend/websocket/handler.py  (WebSocket adapter)
  - scripts/cli.py                (CLI adapter, Week 1-3, unchanged)

The loop communicates through two async callbacks:
  send(msg: dict)  → push a message to the client
  receive() → dict → wait for the next message from the client

Message types follow backend/websocket/message_protocol.py.
"""
from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Awaitable, Callable

from agent.director import StoryDirectorAgent
from agent.logger import AgentLogger
from backend.websocket.message_protocol import (
    msg_error,
    msg_kg_suggestions,
    msg_scene_chunk,
    msg_status,
    msg_suggestions,
)
from kg import crud

logger = logging.getLogger(__name__)

Send = Callable[[dict], Awaitable[None]]
Receive = Callable[[], Awaitable[dict]]


async def run_narrative_session(
    project_id: str,
    send: Send,
    receive: Receive,
    agent_logger: AgentLogger | None = None,
) -> None:
    """
    Full narrative loop for one writing session.

    States:
      IDLE       → waiting for intent
      CONFIRMING → waiting for direction confirmation
      KG_REVIEW  → waiting for KG update confirmation
    """
    if agent_logger is None:
        agent_logger = AgentLogger()

    agent = StoryDirectorAgent(project_id, agent_logger)
    history: list[dict] = []

    # ── Send session_start ────────────────────────────────────
    project = await crud.get_project(project_id)
    if not project:
        await send(msg_error(f"Project not found: {project_id}"))
        return

    await send({"type": "session_start", "project": project})

    while True:
        # ── IDLE: wait for intent ─────────────────────────────
        msg = await receive()
        msg_type = msg.get("type", "")

        if msg_type == "quit":
            break

        if msg_type == "status_request":
            chars = await crud.list_characters(project_id)
            threads = await crud.list_active_plot_threads(project_id)
            await send({
                "type": "project_status",
                "characters": [{"name": c["name"], "current_state": c.get("current_state", "")} for c in chars],
                "active_threads": [{"name": t["name"]} for t in threads],
            })
            continue

        if msg_type != "intent":
            await send(msg_error(f"Expected 'intent' message, got '{msg_type}'"))
            continue

        intent = msg.get("content", "").strip()
        if not intent:
            continue

        agent_logger.log_user_action("intent", intent)

        # ── Phase 1: Director queries KG and suggests ─────────
        await send(msg_status("Querying Knowledge Graph…"))

        try:
            result = await agent.query_and_suggest(intent, history)
        except Exception as exc:
            err = str(exc)
            if "429" in err or "ratelimit" in err.lower() or "quota" in err.lower():
                await send(msg_error(
                    "Rate limit hit — Google API free quota exhausted. "
                    "Please wait for daily reset or enable billing."
                ))
            else:
                await send(msg_error(f"Director error: {err[:300]}"))
            continue

        await send(msg_suggestions(result.suggestions, result.kg_nodes))
        history.append({"role": "user", "content": f"Intent: {intent}"})
        history.append({"role": "assistant", "content": result.suggestions})

        # ── CONFIRMING: wait for direction confirmation ────────
        while True:
            msg = await receive()
            msg_type = msg.get("type", "")

            if msg_type == "skip":
                history.clear()
                await send(msg_status("Direction skipped."))
                break  # back to IDLE

            if msg_type == "refine_intent":
                new_intent = msg.get("content", "").strip()
                if not new_intent:
                    continue
                await send(msg_status("Refining direction…"))
                try:
                    result = await agent.query_and_suggest(new_intent, history)
                except Exception as exc:
                    await send(msg_error(str(exc)))
                    continue
                await send(msg_suggestions(result.suggestions, result.kg_nodes))
                history.append({"role": "user", "content": f"Refined: {new_intent}"})
                history.append({"role": "assistant", "content": result.suggestions})
                continue  # stay in CONFIRMING

            if msg_type != "confirm_direction":
                await send(msg_error(f"Expected 'confirm_direction', got '{msg_type}'"))
                continue

            confirmed_direction = msg.get("direction", "").strip()
            if not confirmed_direction:
                await send(msg_error("Direction cannot be empty."))
                continue

            pov = msg.get("pov_character", "")
            location = msg.get("location", "")
            target_words = int(msg.get("target_words", 800))
            agent_logger.log_user_action("confirm_direction", confirmed_direction)

            # ── Phase 2: Stream scene generation ──────────────
            await send({"type": "scene_start"})
            scene_chunks: list[str] = []

            try:
                async for chunk in agent.stream_scene(
                    intent, confirmed_direction, pov, location, target_words
                ):
                    await send(msg_scene_chunk(chunk))
                    scene_chunks.append(chunk)
            except Exception as exc:
                await send(msg_error(f"Scene generation failed: {exc}"))
                history.clear()
                break

            scene_draft = "".join(scene_chunks)

            # Persist draft to disk (same as CLI)
            draft_path = Path("drafts") / f"scene_{agent_logger.session_id}.md"
            draft_path.parent.mkdir(exist_ok=True)
            draft_path.write_text(scene_draft, encoding="utf-8")

            await send({
                "type": "scene_end",
                "char_count": len(scene_draft),
                "session_id": agent_logger.session_id,
                "draft_path": str(draft_path),
            })

            # ── Phase 3: Suggest KG updates ───────────────────
            await send(msg_status("Analysing scene for KG updates…"))

            try:
                kg_suggestions_raw = await agent.suggest_kg_updates(scene_draft)
            except Exception as exc:
                await send(msg_error(f"KG analysis failed: {exc}"))
                history.clear()
                break

            # Strip code fences just in case
            raw = kg_suggestions_raw.strip()
            if raw.startswith("```"):
                raw = raw.split("\n", 1)[-1].rsplit("```", 1)[0]

            try:
                kg_changes = json.loads(raw)
            except json.JSONDecodeError:
                kg_changes = {}

            await send(msg_kg_suggestions(kg_changes))

            # ── KG_REVIEW: wait for confirmation ──────────────
            while True:
                msg = await receive()
                msg_type = msg.get("type", "")

                if msg_type != "confirm_kg_updates":
                    await send(msg_error(f"Expected 'confirm_kg_updates', got '{msg_type}'"))
                    continue

                if msg.get("apply", False):
                    try:
                        applied = await agent.apply_kg_updates(kg_suggestions_raw)
                    except Exception as exc:
                        await send(msg_error(f"KG apply failed: {exc}"))
                        applied = []
                    await send({"type": "kg_updates_applied", "results": applied})
                else:
                    await send(msg_status("KG updates skipped."))
                break

            history.clear()
            break  # back to IDLE after full scene cycle

    await send({"type": "session_end", "summary": agent_logger.summary()})
