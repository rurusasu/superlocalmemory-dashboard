#!/usr/bin/env python3
"""Skill improvement proposals via Ollama LLM."""

import json
import logging
import os

import requests

logger = logging.getLogger(__name__)

OLLAMA_HOST = os.environ.get("OLLAMA_HOST", "http://ollama:11434")
OLLAMA_MODEL = os.environ.get("OLLAMA_MODEL", "qwen3.5:4b")


def generate_improvement(
    skill_name: str,
    skill_content: str,
    recent_failures: list[dict[str, str]],
) -> dict[str, object]:
    """Generate a skill improvement proposal using Ollama.

    Args:
        skill_name: Name of the skill.
        skill_content: Current SKILL.md content.
        recent_failures: List of recent failure records.

    Returns:
        Dict with 'diff' (unified diff string) and 'rationale'.
    """
    # Size guard: truncate large content to prevent Ollama context overflow
    MAX_CONTENT_CHARS = 50000
    if len(skill_content) > MAX_CONTENT_CHARS:
        skill_content = skill_content[:MAX_CONTENT_CHARS] + "\n... (truncated)"

    failures_text = "\n".join(
        f"- {f.get('error', 'unknown error')} (task: {f.get('task_description', 'N/A')})"
        for f in recent_failures[:10]
    )

    prompt = f"""You are a skill improvement assistant. Analyze the following SKILL.md
and its recent failures, then propose a minimal improvement as a unified diff.

## Current SKILL.md for "{skill_name}"
```
{skill_content}
```

## Recent Failures
{failures_text}

## Instructions
1. Identify the root cause pattern in the failures.
2. Propose the smallest change to SKILL.md that addresses it.
3. Return ONLY valid JSON with two fields:
   - "diff": a unified diff string
   - "rationale": one sentence explaining the change
"""

    logger.info(
        "Requesting improvement for skill %s from %s/%s",
        skill_name,
        OLLAMA_HOST,
        OLLAMA_MODEL,
    )
    resp = requests.post(
        f"{OLLAMA_HOST}/api/generate",
        json={
            "model": OLLAMA_MODEL,
            "prompt": prompt,
            "stream": False,
            "format": "json",
        },
        timeout=120,
    )
    resp.raise_for_status()
    text = resp.json().get("response", "{}")

    try:
        result = json.loads(text)
        rationale = result.get("rationale", "")[:100]
        logger.info("Improvement generated for skill %s: %s", skill_name, rationale)
        return {
            "success": True,
            "diff": result.get("diff", ""),
            "rationale": result.get("rationale", "No rationale provided"),
        }
    except json.JSONDecodeError:
        logger.error("LLM returned invalid JSON for skill %s: %s", skill_name, text[:200])
        msg = f"LLM returned invalid JSON: {text[:200]}"
        return {"success": False, "diff": "", "rationale": msg}
