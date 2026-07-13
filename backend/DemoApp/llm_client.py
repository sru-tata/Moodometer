"""llm_client.py

Thin wrapper around the NeuroVerse OpenAI-compatible chat-completions API,
used to turn raw computed statistics into a short, readable HR narrative for
the admin dashboard's "AI Insights" tab.

Design goal: never let an LLM outage break the dashboard. Every call is
wrapped so a network failure, timeout, or bad response falls back to a
clear, deterministic message instead of raising.
"""

import logging
from typing import Optional

import requests

from settings import settings

logger = logging.getLogger(__name__)

CHAT_COMPLETIONS_URL = f"{settings.openai_api_base}/chat/completions"

SYSTEM_PROMPT = (
    "You are an HR People Analytics assistant embedded in the Mood-O-Meter "
    "dashboard. You are given computed sentiment statistics (Motivation, "
    "Growth, Leadership Trust, Workload, Belonging indices, each 0-100) for "
    "an organization and its departments. Write a concise, plain-English "
    "executive summary (3-5 sentences) an HR leader can read in 10 seconds. "
    "Call out the single biggest concern and the single biggest positive. "
    "Be specific with numbers. No headers, no bullet points, no markdown — "
    "just prose. Never invent data that wasn't given to you."
)


def is_configured() -> bool:
    return bool(settings.openai_api_key and settings.openai_api_base)


def generate_narrative(context: str, fallback: str, max_tokens: int = 220) -> tuple:
    """Call the LLM to turn `context` (a data summary) into prose.
    Returns (text, used_llm). On any failure returns (fallback, False) so
    callers never have to special-case errors, while still being able to
    show an accurate "AI-generated" vs "auto-generated" label in the UI."""
    if not is_configured():
        return fallback, False

    payload = {
        "model": settings.model_name_llm,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": context},
        ],
        "max_tokens": max_tokens,
        "temperature": 0.4,
    }
    headers = {
        "Authorization": f"Bearer {settings.openai_api_key}",
        "Content-Type": "application/json",
    }

    try:
        resp = requests.post(
            CHAT_COMPLETIONS_URL,
            json=payload,
            headers=headers,
            timeout=settings.llm_request_timeout_seconds,
            verify=False,
        )
        resp.raise_for_status()
        data = resp.json()
        text = data["choices"][0]["message"]["content"].strip()
        return (text, True) if text else (fallback, False)
    except Exception as e:  # network / auth / parsing — always degrade gracefully
        logger.warning("LLM narrative generation failed, using fallback: %s", e)
        return fallback, False
