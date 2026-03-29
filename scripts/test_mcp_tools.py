"""
CLI smoke test for MCP tools (Week 2).
Calls each tool directly (not via MCP protocol) to verify logic.

Usage:
    python -m scripts.test_mcp_tools
"""
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from dotenv import load_dotenv
load_dotenv()

from kg.client import init_schema, close
from kg import crud


async def get_project_id() -> str:
    projects = await crud.list_projects()
    if not projects:
        print("No projects found. Run seed_test_data.py first.")
        sys.exit(1)
    return projects[0]["id"]


async def test_query_tools(pid: str) -> None:
    print("\n── Query Tools ──────────────────────────")

    # query_character
    char = await crud.get_character_by_name("凱爾", pid)
    print(f"[query_character] 凱爾 found: {bool(char)}")
    if char:
        print(f"  current_state : {char.get('current_state', '')[:60]}")
        print(f"  speech_style  : {char.get('speech_style', '')[:60]}")

    # get_active_foreshadowing
    threads = await crud.list_active_plot_threads(pid)
    print(f"\n[get_active_foreshadowing] {len(threads)} active threads:")
    for t in threads:
        print(f"  - {t['name']}")

    # get_character_relationship
    kael = await crud.get_character_by_name("凱爾", pid)
    liya = await crud.get_character_by_name("莉雅", pid)
    if kael and liya:
        rel = await crud.get_character_relationship(kael["id"], liya["id"])
        print(f"\n[get_character_relationship] 凱爾↔莉雅:")
        if rel:
            print(f"  type={rel.get('rel_type','?')} trust={rel.get('trust_level','?')}")
            print(f"  true_face: {rel.get('true_face','')[:60]}")


async def test_llm_tools(pid: str) -> None:
    print("\n── LLM Tools (requires GEMINI_API_KEY) ──")

    try:
        from agent.config import chat

        # suggest_scene_direction
        threads = await crud.list_active_plot_threads(pid)
        characters = await crud.list_characters(pid)
        import json
        context_str = f"Active foreshadowing: {[t['name'] for t in threads]}\n"
        context_str += f"Characters: {[c['name'] + ' — ' + c.get('current_state','') for c in characters]}"

        messages = [
            {"role": "system", "content": (
                "You are Story Director helping an author. "
                "Suggest 2 scene directions based on the intent and context. Be concise. "
                "Reply in the same language as the author's intent."
            )},
            {"role": "user", "content": (
                f"Intent: 凱爾在廢棄觀測站發現了關於父親的線索\n\n"
                f"Context:\n{context_str}\n\nSuggest 2 directions."
            )},
        ]
        print("[suggest_scene_direction] calling LLM...")
        response = await chat("summary", messages, max_tokens=512)
        print(response[:400])

    except Exception as e:
        print(f"LLM test skipped: {e}")


async def main() -> None:
    print("Initialising schema...")
    await init_schema()

    pid = await get_project_id()
    print(f"Using project: {pid[:8]}...")

    await test_query_tools(pid)
    await test_llm_tools(pid)

    await close()
    print("\n✓ All tests done.")


if __name__ == "__main__":
    asyncio.run(main())
