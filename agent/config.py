"""
LiteLLM multi-model configuration.

Each task type maps to the most suitable model.
API keys are loaded from environment variables automatically by LiteLLM.
"""
from __future__ import annotations

import asyncio
import os
from typing import AsyncIterator

import logging

import litellm
from dotenv import load_dotenv

load_dotenv()

# Suppress litellm internal logging noise
litellm.suppress_debug_info = True
os.environ.setdefault("LITELLM_LOG", "CRITICAL")
logging.getLogger("litellm").setLevel(logging.CRITICAL)

# ─────────────────────────────────────────────
# Task → Model mapping
# ─────────────────────────────────────────────

TASK_MODEL_MAP: dict[str, str] = {
    # Free tier daily limits (approx):
    #   gemini-3.1-flash-lite      → 500 RPD, 15 RPM  ← main model
    #   gemini-2.0-flash           → 200 RPD, 15 RPM
    #   gemini-2.0-flash-lite      → 1500 RPD, 30 RPM
    #   gemini-1.5-flash           → 1500 RPD, 15 RPM ← reliable fallback
    "director":    "gemini/gemini-3.1-flash-lite-preview",
    "write_scene": "gemini/gemini-3.1-flash-lite-preview",
    "dialogue":    "gemini/gemini-3.1-flash-lite-preview",
    "consistency": "gemini/gemini-3.1-flash-lite-preview",
    "summary":     "gemini/gemini-3.1-flash-lite-preview",
    "timeline":    "gemini/gemini-3.1-flash-lite-preview",
}

# Fallback chain: tried in order when primary returns retryable error
_FALLBACK_CHAIN: list[str] = [
    "gemini/gemini-1.5-flash",        # 1500 RPD free tier
    "gemini/gemini-1.5-flash-8b",     # 1500 RPD free tier, lighter
]

# LiteLLM global settings
litellm.drop_params = True   # Ignore unsupported params per-provider

_RETRYABLE_CODES = {
    "503", "529",
    "overloaded", "unavailable", "service unavailable",
    # 429 quota / rate-limit errors
    "429", "rate limit", "resource_exhausted", "quota exceeded",
    "generaterequeststodayperproject",  # Gemini free-tier daily quota
}


def _is_retryable(exc: Exception) -> bool:
    msg = str(exc).lower()
    return any(code in msg for code in _RETRYABLE_CODES)


def _sleep_for(exc: Exception) -> float:
    """Return seconds to sleep before retrying. Longer for rate-limits."""
    msg = str(exc).lower()
    if any(c in msg for c in ("429", "rate limit", "quota", "resource_exhausted")):
        return 5.0  # quota errors need a bit more breathing room
    return 2.0


# ─────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────

def get_model(task: str) -> str:
    """Return the model ID for a given task. Falls back to director model."""
    return TASK_MODEL_MAP.get(task, TASK_MODEL_MAP["director"])


async def chat(
    task: str,
    messages: list[dict],
    temperature: float = 0.7,
    max_tokens: int = 2048,
) -> str:
    """Single-shot async chat completion with retry + fallback on 503."""
    candidates = [get_model(task)] + _FALLBACK_CHAIN
    last_exc: Exception | None = None

    for i, model in enumerate(candidates):
        try:
            if i > 0:
                await asyncio.sleep(_sleep_for(last_exc))  # type: ignore[arg-type]
            response = await litellm.acompletion(
                model=model,
                messages=messages,
                temperature=temperature,
                max_tokens=max_tokens,
            )
            return response.choices[0].message.content
        except Exception as exc:
            last_exc = exc
            if not _is_retryable(exc):
                raise
            # retryable — try next candidate

    raise last_exc  # type: ignore[misc]


async def stream_chat(
    task: str,
    messages: list[dict],
    temperature: float = 0.7,
    max_tokens: int = 4096,
) -> AsyncIterator[str]:
    """Streaming async chat completion with retry + fallback on 503."""
    candidates = [get_model(task)] + _FALLBACK_CHAIN
    last_exc: Exception | None = None

    for i, model in enumerate(candidates):
        try:
            if i > 0:
                await asyncio.sleep(_sleep_for(last_exc))  # type: ignore[arg-type]
            response = await litellm.acompletion(
                model=model,
                messages=messages,
                temperature=temperature,
                max_tokens=max_tokens,
                stream=True,
            )
            async for chunk in response:
                delta = chunk.choices[0].delta
                if delta and delta.content:
                    yield delta.content
            return  # success — stop iterating candidates
        except Exception as exc:
            last_exc = exc
            if not _is_retryable(exc):
                raise

    raise last_exc  # type: ignore[misc]


def list_available_tasks() -> list[str]:
    return list(TASK_MODEL_MAP.keys())
