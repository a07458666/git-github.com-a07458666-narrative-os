"""
Agent log endpoints.

GET /api/logs                    — list all session log files (newest first)
GET /api/logs/{session_id}       — full list of log entries for a session
DELETE /api/logs/{session_id}    — delete a session log file
"""
from __future__ import annotations

import json
from pathlib import Path

from fastapi import APIRouter, HTTPException, Response

router = APIRouter(prefix="/api/logs", tags=["logs"])

LOG_DIR = Path(__file__).parent.parent.parent / "logs"


def _session_id_from_path(p: Path) -> str:
    return p.stem.replace("session_", "")


def _read_entries(path: Path) -> list[dict]:
    entries = []
    with path.open(encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line:
                try:
                    entries.append(json.loads(line))
                except json.JSONDecodeError:
                    pass
    return entries


# ─────────────────────────────────────────────
# Routes
# ─────────────────────────────────────────────

@router.get("/")
async def list_sessions() -> list[dict]:
    """Return session summaries sorted by modification time (newest first)."""
    if not LOG_DIR.exists():
        return []

    sessions = []
    for p in sorted(LOG_DIR.glob("session_*.jsonl"), key=lambda x: x.stat().st_mtime, reverse=True):
        sid = _session_id_from_path(p)
        entries = _read_entries(p)
        total_tokens = sum(e.get("tokens_in", 0) + e.get("tokens_out", 0) for e in entries)
        actions = [e.get("action", "") for e in entries]
        first_ts = entries[0].get("timestamp", "") if entries else ""
        sessions.append({
            "session_id": sid,
            "entry_count": len(entries),
            "total_tokens": total_tokens,
            "actions": actions,
            "first_timestamp": first_ts,
            "file": p.name,
        })
    return sessions


@router.get("/{session_id}")
async def get_session(session_id: str) -> dict:
    """Return all log entries for a session."""
    path = LOG_DIR / f"session_{session_id}.jsonl"
    if not path.exists():
        raise HTTPException(status_code=404, detail="Session log not found")
    entries = _read_entries(path)
    total_tokens = sum(e.get("tokens_in", 0) + e.get("tokens_out", 0) for e in entries)
    return {
        "session_id": session_id,
        "entries": entries,
        "total_tokens": total_tokens,
    }


@router.delete("/{session_id}")
async def delete_session(session_id: str) -> Response:
    """Delete a session log file."""
    path = LOG_DIR / f"session_{session_id}.jsonl"
    if not path.exists():
        raise HTTPException(status_code=404, detail="Session log not found")
    path.unlink()
    return Response(status_code=204)
