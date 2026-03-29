"""
NarrativeOS CLI — interactive Director Agent session.

Usage:
    python -m scripts.cli
    python -m scripts.cli --project <project_id>
"""
from __future__ import annotations

import argparse
import asyncio
import sys
import logging
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

# Suppress litellm logging errors to stderr
logging.getLogger("litellm").setLevel(logging.CRITICAL)
logging.getLogger("litellm.litellm_core_utils").setLevel(logging.CRITICAL)

from dotenv import load_dotenv  # noqa: E402
load_dotenv()

from kg.client import init_schema, close  # noqa: E402
from kg import crud  # noqa: E402
from agent.director import StoryDirectorAgent  # noqa: E402
from agent.logger import AgentLogger  # noqa: E402


# ─────────────────────────────────────────────
# Terminal helpers
# ─────────────────────────────────────────────

DIVIDER   = "─" * 60
SEPARATOR = "═" * 60

def print_header(text: str) -> None:
    print(f"\n{SEPARATOR}")
    print(f"  {text}")
    print(SEPARATOR)

def print_section(title: str) -> None:
    print(f"\n{DIVIDER}")
    print(f"  {title}")
    print(DIVIDER)

def print_agent(text: str) -> None:
    print(f"\n[Director]\n{text}")

def input_user(prompt: str = "") -> str:
    print()
    return input(f"  You> {prompt}").strip()

def print_info(text: str) -> None:
    print(f"  ℹ  {text}")

def print_success(text: str) -> None:
    print(f"  ✓  {text}")


# ─────────────────────────────────────────────
# Project selection
# ─────────────────────────────────────────────

async def pick_project() -> str:
    projects = await crud.list_projects()
    if not projects:
        print("No projects found. Run 'python -m scripts.seed_test_data' first.")
        sys.exit(1)

    if len(projects) == 1:
        p = projects[0]
        print_info(f"Project: {p['name']} ({p['id'][:8]}...)")
        return p["id"]

    print_section("Select Project")
    for i, p in enumerate(projects, 1):
        print(f"  [{i}] {p['name']}  ({p['id'][:8]}...)")

    while True:
        choice = input_user("Enter number: ")
        if choice.isdigit() and 1 <= int(choice) <= len(projects):
            return projects[int(choice) - 1]["id"]
        print("  Invalid choice, try again.")


# ─────────────────────────────────────────────
# Main session loop
# ─────────────────────────────────────────────

async def run_session(project_id: str) -> None:
    logger = AgentLogger()
    agent = StoryDirectorAgent(project_id, logger)
    history: list[dict] = []

    project = await crud.get_project(project_id)
    project_name = project["name"] if project else project_id

    print_header(f"NarrativeOS  ·  {project_name}")
    print("  Type your writing intent, or 'quit' to exit.")
    print("  Commands: [quit] [log] [status]")

    while True:
        # ── Get intent ───────────────────────────────────────
        print_section("What do you want to write?")
        intent = input_user()

        if not intent:
            continue
        if intent.lower() == "quit":
            print_info(f"Session summary: {logger.summary()}")
            break
        if intent.lower() == "log":
            print_info(logger.summary())
            continue
        if intent.lower() == "status":
            chars = await crud.list_characters(project_id)
            threads = await crud.list_active_plot_threads(project_id)
            print_info(f"Characters: {', '.join(c['name'] for c in chars)}")
            print_info(f"Active threads: {', '.join(t['name'] for t in threads)}")
            continue

        logger.log_user_action("intent", intent)

        # ── Phase 1: Director queries KG and suggests ─────────
        print_section("Director is querying the Knowledge Graph...")

        try:
            result = await agent.query_and_suggest(intent, history)
        except Exception as e:
            err = str(e)
            if "429" in err or "RateLimit" in err or "quota" in err.lower():
                print_info("Rate limit hit — Google API free quota exhausted.")
                print_info("Options: enable billing, wait for daily reset, or use a new API key.")
            else:
                print_info(f"LLM error: {err[:200]}")
            continue

        print_info(f"KG context: {', '.join(result.kg_nodes) or 'none'}")
        print_agent(result.suggestions)

        # Keep conversation history for multi-turn
        history.append({"role": "user", "content": f"Intent: {intent}"})
        history.append({"role": "assistant", "content": result.suggestions})

        # ── Author confirms or refines ─────────────────────────
        print_section("Confirm direction")
        print("  Options:")
        print("  • Type your confirmed direction (e.g. '方向1' or describe it)")
        print("  • Type 'refine: <new intent>' to change direction")
        print("  • Type 'skip' to start over")

        while True:
            choice = input_user()

            if not choice or choice.lower() == "skip":
                print_info("Skipping generation.")
                history.clear()
                break

            if choice.lower().startswith("refine:"):
                new_intent = choice[7:].strip()
                print_section("Refining direction...")
                result = await agent.query_and_suggest(new_intent, history)
                print_agent(result.suggestions)
                history.append({"role": "user", "content": f"Refined intent: {new_intent}"})
                history.append({"role": "assistant", "content": result.suggestions})
                continue

            # Author confirmed a direction — ask for optional params
            confirmed_direction = choice
            logger.log_user_action("confirm_direction", confirmed_direction)

            print_section("Scene parameters (press Enter to skip)")
            pov = input_user("POV character name (e.g. 凱爾): ")
            location = input_user("Location name (e.g. 裂痕觀測站): ")
            words_str = input_user("Target word count [800]: ")
            target_words = int(words_str) if words_str.isdigit() else 800

            # ── Phase 2: Stream scene generation ──────────────
            print_section("Writing scene...")
            print()

            scene_chunks: list[str] = []
            async for chunk in agent.stream_scene(
                intent, confirmed_direction, pov, location, target_words
            ):
                print(chunk, end="", flush=True)
                scene_chunks.append(chunk)

            scene_draft = "".join(scene_chunks)
            print(f"\n\n{DIVIDER}")
            print_info(f"Scene complete. (~{len(scene_draft)} chars)")

            # Save draft to file
            draft_path = Path("drafts") / f"scene_{logger.session_id}.md"
            draft_path.parent.mkdir(exist_ok=True)
            draft_path.write_text(scene_draft, encoding="utf-8")
            print_info(f"Draft saved → {draft_path}")

            # ── Phase 3: Suggest KG updates ───────────────────
            print_section("Analysing scene for KG updates...")
            kg_suggestions_raw = await agent.suggest_kg_updates(scene_draft)

            # Pretty print the suggestions
            try:
                import json
                suggestions = json.loads(kg_suggestions_raw)
                _print_kg_diff(suggestions)
            except Exception:
                print_agent(kg_suggestions_raw)

            # ── Author confirms KG updates ────────────────────
            print_section("Apply KG updates?")
            print("  [y] Apply all  [n] Skip  [edit] Paste custom JSON")

            kg_choice = input_user("[y/n/edit]: ").lower()
            logger.log_user_action("kg_update_choice", kg_choice)

            if kg_choice == "y":
                applied = await agent.apply_kg_updates(kg_suggestions_raw)
                for line in applied:
                    print_success(line)

            elif kg_choice == "edit":
                print_info("Paste your JSON (end with a blank line):")
                lines = []
                while True:
                    line = input()
                    if line == "":
                        break
                    lines.append(line)
                custom_json = "\n".join(lines)
                applied = await agent.apply_kg_updates(custom_json)
                for line in applied:
                    print_success(line)
            else:
                print_info("KG updates skipped.")

            # Reset history after a completed scene
            history.clear()
            break

    print(f"\n{SEPARATOR}")
    print("  Session ended. Goodbye!")
    print(SEPARATOR)


def _print_kg_diff(suggestions: dict) -> None:
    """Pretty-print the KG update suggestions."""
    print()
    state_changes = suggestions.get("character_state_changes", [])
    rel_changes = suggestions.get("relationship_changes", [])
    new_threads = suggestions.get("new_plot_threads", [])
    resolved = suggestions.get("resolved_plot_threads", [])

    if not any([state_changes, rel_changes, new_threads, resolved]):
        print_info("No KG changes detected in this scene.")
        return

    if state_changes:
        print("  Character state changes:")
        for c in state_changes:
            print(f"    {c.get('character_name','?')}: {c.get('old_state','')} → {c.get('new_state','')}")

    if rel_changes:
        print("  Relationship changes:")
        for r in rel_changes:
            delta = r.get('trust_delta', 0)
            sign = "+" if delta >= 0 else ""
            print(f"    {r.get('char_a','?')}↔{r.get('char_b','?')}: trust {sign}{delta} ({r.get('reason','')})")

    if new_threads:
        print("  New foreshadowing:")
        for t in new_threads:
            print(f"    + {t.get('name','?')}: {t.get('description','')[:60]}...")

    if resolved:
        print("  Resolved foreshadowing:")
        for t in resolved:
            print(f"    ✓ {t.get('thread_name','?')}")


# ─────────────────────────────────────────────
# Entry point
# ─────────────────────────────────────────────

async def main() -> None:
    parser = argparse.ArgumentParser(description="NarrativeOS CLI")
    parser.add_argument("--project", "-p", help="Project ID (skip selection prompt)")
    args = parser.parse_args()

    await init_schema()

    project_id = args.project or await pick_project()
    await run_session(project_id)
    await close()


if __name__ == "__main__":
    asyncio.run(main())
