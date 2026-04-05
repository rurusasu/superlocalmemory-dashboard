#!/usr/bin/env python3
"""Skill health scoring — migrated from cognee-skills.

Pure calculation, no external dependencies.
"""

import logging
import os

logger = logging.getLogger(__name__)

WINDOW = int(os.environ.get("SKILL_HEALTH_WINDOW", "20"))
THRESHOLD = float(os.environ.get("SKILL_HEALTH_THRESHOLD", "0.7"))
PENALTY = float(os.environ.get("SKILL_CORRECTION_PENALTY", "0.05"))


def calculate_health_score(
    executions: list[dict[str, object]],
    correction_count: int = 0,
) -> float:
    """Calculate health score from recent executions.

    Args:
        executions: List of dicts with boolean 'success' field.
        correction_count: Number of user corrections.

    Returns:
        Score clamped to [0.0, 1.0].
    """
    recent = executions[-WINDOW:]
    if not recent:
        logger.debug("No executions found, returning default score 1.0")
        return 1.0
    successes = sum(1 for e in recent if e.get("success", False))
    rate = successes / len(recent)
    score = rate - (correction_count * PENALTY)
    result = max(0.0, min(1.0, score))
    logger.info(
        "Health score calculated: %.2f (success_rate=%.2f, corrections=%d, window=%d)",
        result,
        rate,
        correction_count,
        len(recent),
    )
    return result


def needs_improvement(score: float) -> bool:
    return score < THRESHOLD
