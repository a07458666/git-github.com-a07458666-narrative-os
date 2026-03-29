"""
Agent Logger — structured JSON logs for all agent actions.

Log format matches the plan spec:
{
  "timestamp": "...",
  "session_id": "...",
  "action": "...",
  "tools_called": [...],
  "kg_nodes_accessed": [...],
  "model_used": "...",
  "tokens_in": N,
  "tokens_out": N,
  "latency_ms": N
}
"""
from __future__ import annotations

import json
import time
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any


LOG_DIR = Path(__file__).parent.parent / "logs"
LOG_DIR.mkdir(exist_ok=True)


class AgentLogger:
    def __init__(self, session_id: str | None = None):
        self.session_id = session_id or str(uuid.uuid4())[:8]
        self._log_path = LOG_DIR / f"session_{self.session_id}.jsonl"
        self._timers: dict[str, float] = {}

    # ── Timer helpers ────────────────────────────────────────

    def start_timer(self, key: str = "default") -> None:
        self._timers[key] = time.monotonic()

    def elapsed_ms(self, key: str = "default") -> int:
        start = self._timers.get(key)
        if start is None:
            return 0
        return int((time.monotonic() - start) * 1000)

    # ── Core log method ──────────────────────────────────────

    def log(
        self,
        action: str,
        tools_called: list[str] | None = None,
        kg_nodes_accessed: list[str] | None = None,
        model_used: str = "",
        tokens_in: int = 0,
        tokens_out: int = 0,
        latency_ms: int = 0,
        extra: dict[str, Any] | None = None,
    ) -> None:
        entry: dict[str, Any] = {
            "timestamp": datetime.utcnow().isoformat(),
            "session_id": self.session_id,
            "action": action,
            "tools_called": tools_called or [],
            "kg_nodes_accessed": kg_nodes_accessed or [],
            "model_used": model_used,
            "tokens_in": tokens_in,
            "tokens_out": tokens_out,
            "latency_ms": latency_ms,
        }
        if extra:
            entry.update(extra)

        with self._log_path.open("a", encoding="utf-8") as f:
            f.write(json.dumps(entry, ensure_ascii=False) + "\n")

    # ── Convenience wrappers ─────────────────────────────────

    def log_query(self, tools: list[str], nodes: list[str], model: str, latency_ms: int) -> None:
        self.log("query_kg", tools_called=tools, kg_nodes_accessed=nodes,
                 model_used=model, latency_ms=latency_ms)

    def log_generation(self, tool: str, model: str, tokens_in: int, tokens_out: int, latency_ms: int) -> None:
        self.log("generation", tools_called=[tool], model_used=model,
                 tokens_in=tokens_in, tokens_out=tokens_out, latency_ms=latency_ms)

    def log_kg_update(self, changes: list[str], latency_ms: int) -> None:
        self.log("kg_update", extra={"changes": changes}, latency_ms=latency_ms)

    def log_user_action(self, action: str, detail: str = "") -> None:
        self.log("user_action", extra={"user_action": action, "detail": detail})

    def summary(self) -> str:
        """Return a one-line session summary."""
        if not self._log_path.exists():
            return f"Session {self.session_id}: no logs yet."
        with self._log_path.open(encoding="utf-8") as f:
            entries = [json.loads(l) for l in f if l.strip()]
        total_tokens = sum(e.get("tokens_in", 0) + e.get("tokens_out", 0) for e in entries)
        actions = [e["action"] for e in entries]
        return (
            f"Session {self.session_id} | "
            f"{len(entries)} entries | "
            f"tokens: {total_tokens} | "
            f"actions: {', '.join(actions)}"
        )
