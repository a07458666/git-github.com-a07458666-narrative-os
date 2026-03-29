"""
WebSocket message protocol for NarrativeOS.

Client → Server messages:
  {"type": "intent",              "content": "..."}
  {"type": "confirm_direction",   "direction": "...", "pov_character": "...", "location": "...", "target_words": 800}
  {"type": "refine_intent",       "content": "..."}
  {"type": "skip"}
  {"type": "confirm_kg_updates",  "apply": true}
  {"type": "status_request"}
  {"type": "quit"}

Server → Client messages:
  {"type": "session_start",       "project": {...}}
  {"type": "suggestions",         "content": "...", "kg_nodes": [...]}
  {"type": "scene_start"}
  {"type": "scene_chunk",         "content": "..."}
  {"type": "scene_end",           "char_count": 1234, "session_id": "..."}
  {"type": "kg_suggestions",      "changes": {...}}
  {"type": "kg_updates_applied",  "results": [...]}
  {"type": "status",              "message": "..."}
  {"type": "project_status",      "characters": [...], "active_threads": [...]}
  {"type": "error",               "message": "..."}
  {"type": "session_end"}
"""
from typing import Literal

# Client message types
CLIENT_TYPES = Literal[
    "intent",
    "confirm_direction",
    "refine_intent",
    "skip",
    "confirm_kg_updates",
    "status_request",
    "quit",
]

# Server message types
SERVER_TYPES = Literal[
    "session_start",
    "suggestions",
    "scene_start",
    "scene_chunk",
    "scene_end",
    "kg_suggestions",
    "kg_updates_applied",
    "status",
    "project_status",
    "error",
    "session_end",
]


def msg_status(message: str) -> dict:
    return {"type": "status", "message": message}


def msg_error(message: str) -> dict:
    return {"type": "error", "message": message}


def msg_suggestions(content: str, kg_nodes: list[str]) -> dict:
    return {"type": "suggestions", "content": content, "kg_nodes": kg_nodes}


def msg_scene_chunk(content: str) -> dict:
    return {"type": "scene_chunk", "content": content}


def msg_kg_suggestions(changes: dict) -> dict:
    return {"type": "kg_suggestions", "changes": changes}
