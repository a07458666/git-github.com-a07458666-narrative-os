"""
WebSocket endpoint — bridges the browser and the narrative loop.

Each connection runs narrative_loop.run_narrative_session() as a background task.
Messages from the browser are forwarded via an asyncio.Queue.
"""
from __future__ import annotations

import asyncio
import logging
from uuid import uuid4

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from .connection_manager import manager
from .message_protocol import msg_error
from backend.narrative_loop import run_narrative_session
from agent.logger import AgentLogger

logger = logging.getLogger(__name__)
router = APIRouter(tags=["websocket"])


@router.websocket("/ws/project/{project_id}")
async def websocket_endpoint(ws: WebSocket, project_id: str) -> None:
    session_id = str(uuid4())
    await manager.connect(ws, session_id)

    # Queue bridges the WebSocket receiver → narrative loop's receive() call
    queue: asyncio.Queue[dict] = asyncio.Queue()

    async def send(msg: dict) -> None:
        try:
            await ws.send_json(msg)
        except Exception as exc:
            logger.warning("WS send failed (%s): %s", session_id, exc)

    async def receive() -> dict:
        return await queue.get()

    agent_logger = AgentLogger(session_id=session_id)
    loop_task = asyncio.create_task(
        run_narrative_session(project_id, send, receive, agent_logger)
    )

    try:
        while True:
            data = await ws.receive_json()
            await queue.put(data)
    except WebSocketDisconnect:
        logger.info("Client disconnected: %s", session_id)
        loop_task.cancel()
    except Exception as exc:
        logger.error("WS error (%s): %s", session_id, exc)
        await send(msg_error(str(exc)))
        loop_task.cancel()
    finally:
        manager.disconnect(session_id)
        # Drain task to avoid "Task destroyed but it is pending" warnings
        try:
            await asyncio.wait_for(loop_task, timeout=1.0)
        except (asyncio.TimeoutError, asyncio.CancelledError):
            pass
