"""
WebSocket connection manager — tracks active sessions.
"""
from __future__ import annotations

import logging
from fastapi import WebSocket

logger = logging.getLogger(__name__)


class ConnectionManager:
    def __init__(self) -> None:
        # session_id → WebSocket
        self._connections: dict[str, WebSocket] = {}

    async def connect(self, ws: WebSocket, session_id: str) -> None:
        await ws.accept()
        self._connections[session_id] = ws
        logger.info("WS connected: %s (total: %d)", session_id, len(self._connections))

    def disconnect(self, session_id: str) -> None:
        self._connections.pop(session_id, None)
        logger.info("WS disconnected: %s (total: %d)", session_id, len(self._connections))

    async def send_json(self, session_id: str, data: dict) -> None:
        ws = self._connections.get(session_id)
        if ws:
            await ws.send_json(data)

    @property
    def active_count(self) -> int:
        return len(self._connections)


# Singleton — shared across the application
manager = ConnectionManager()
