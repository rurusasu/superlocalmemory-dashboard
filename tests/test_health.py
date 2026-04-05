"""Tests for skills_tools/health.py"""

import os

import pytest


@pytest.fixture(autouse=True)
def _reset_env(monkeypatch):
    """Ensure default env values for each test."""
    monkeypatch.setenv("SKILL_HEALTH_WINDOW", "20")
    monkeypatch.setenv("SKILL_HEALTH_THRESHOLD", "0.7")
    monkeypatch.setenv("SKILL_CORRECTION_PENALTY", "0.05")
    # Re-import to pick up env changes
    import importlib
    import skills_tools.health as h
    importlib.reload(h)


def test_calculate_health_score_all_success():
    from skills_tools.health import calculate_health_score

    executions = [{"success": True}] * 10
    score = calculate_health_score(executions)
    assert score == 1.0


def test_calculate_health_score_all_failures():
    from skills_tools.health import calculate_health_score

    executions = [{"success": False}] * 10
    score = calculate_health_score(executions)
    assert score == 0.0


def test_calculate_health_score_empty_list():
    from skills_tools.health import calculate_health_score

    score = calculate_health_score([])
    assert score == 1.0


def test_calculate_health_score_mixed():
    from skills_tools.health import calculate_health_score

    executions = [{"success": True}] * 7 + [{"success": False}] * 3
    score = calculate_health_score(executions)
    assert score == pytest.approx(0.7)


def test_calculate_health_score_with_corrections():
    from skills_tools.health import calculate_health_score

    executions = [{"success": True}] * 10
    score = calculate_health_score(executions, correction_count=4)
    # 1.0 - (4 * 0.05) = 0.8
    assert score == pytest.approx(0.8)


def test_calculate_health_score_clamped_to_zero():
    from skills_tools.health import calculate_health_score

    executions = [{"success": True}] * 10
    score = calculate_health_score(executions, correction_count=100)
    assert score == 0.0


def test_calculate_health_score_uses_window():
    from skills_tools.health import calculate_health_score

    # 30 entries: first 10 failures, last 20 successes (window=20)
    executions = [{"success": False}] * 10 + [{"success": True}] * 20
    score = calculate_health_score(executions)
    assert score == 1.0


def test_calculate_health_score_missing_success_key():
    from skills_tools.health import calculate_health_score

    executions = [{"other": "data"}] * 5
    score = calculate_health_score(executions)
    assert score == 0.0


def test_needs_improvement_below_threshold():
    from skills_tools.health import needs_improvement

    assert needs_improvement(0.5) is True


def test_needs_improvement_above_threshold():
    from skills_tools.health import needs_improvement

    assert needs_improvement(0.9) is False


def test_needs_improvement_at_threshold():
    from skills_tools.health import needs_improvement

    assert needs_improvement(0.7) is False
