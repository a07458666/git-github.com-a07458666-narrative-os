"""
CLI script: seed the 星裂紀元 test world into Neo4j.

Usage:
    # From project root
    python -m scripts.seed_test_data

    # Or directly
    python scripts/seed_test_data.py
"""
import asyncio
import sys
from pathlib import Path

# Allow running from project root
sys.path.insert(0, str(Path(__file__).parent.parent))

from dotenv import load_dotenv
load_dotenv()

from kg.client import init_schema, close  # noqa: E402
from kg.seed import seed_all, print_summary  # noqa: E402


async def main() -> None:
    print("Initialising Neo4j schema...")
    await init_schema()
    print("Schema ready.\n")

    print("Seeding test world: 星裂紀元...")
    project_id = await seed_all()
    print("Seed complete.")

    await print_summary(project_id)
    await close()


if __name__ == "__main__":
    asyncio.run(main())
