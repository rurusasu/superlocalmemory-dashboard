"""Tests for skills_tools/improve.py"""

import json
from unittest.mock import MagicMock, patch

import pytest

from skills_tools.improve import generate_improvement


@patch("skills_tools.improve.requests.post")
def test_generate_improvement_success(mock_post):
    mock_response = MagicMock()
    mock_response.json.return_value = {
        "response": json.dumps({
            "diff": "--- a/SKILL.md\n+++ b/SKILL.md\n@@ -1 +1 @@\n-old\n+new",
            "rationale": "Fixed error handling",
        })
    }
    mock_response.raise_for_status = MagicMock()
    mock_post.return_value = mock_response

    result = generate_improvement(
        skill_name="test_skill",
        skill_content="# SKILL.md content",
        recent_failures=[{"error": "timeout", "task_description": "run query"}],
    )

    assert result["success"] is True
    assert "old" in result["diff"]
    assert result["rationale"] == "Fixed error handling"


@patch("skills_tools.improve.requests.post")
def test_generate_improvement_invalid_json(mock_post):
    mock_response = MagicMock()
    mock_response.json.return_value = {"response": "not valid json {{{"}
    mock_response.raise_for_status = MagicMock()
    mock_post.return_value = mock_response

    result = generate_improvement(
        skill_name="test_skill",
        skill_content="content",
        recent_failures=[],
    )

    assert result["success"] is False
    assert "invalid JSON" in result["rationale"]


@patch("skills_tools.improve.requests.post")
def test_generate_improvement_empty_response(mock_post):
    mock_response = MagicMock()
    mock_response.json.return_value = {"response": "{}"}
    mock_response.raise_for_status = MagicMock()
    mock_post.return_value = mock_response

    result = generate_improvement(
        skill_name="test_skill",
        skill_content="content",
        recent_failures=[],
    )

    assert result["success"] is True
    assert result["diff"] == ""
    assert result["rationale"] == "No rationale provided"


@patch("skills_tools.improve.requests.post")
def test_generate_improvement_api_error(mock_post):
    import requests

    mock_post.side_effect = requests.exceptions.ConnectionError("connection refused")

    with pytest.raises(requests.exceptions.ConnectionError):
        generate_improvement(
            skill_name="test_skill",
            skill_content="content",
            recent_failures=[],
        )


@patch("skills_tools.improve.requests.post")
def test_generate_improvement_truncates_large_content(mock_post):
    mock_response = MagicMock()
    mock_response.json.return_value = {
        "response": json.dumps({"diff": "", "rationale": "ok"})
    }
    mock_response.raise_for_status = MagicMock()
    mock_post.return_value = mock_response

    large_content = "x" * 100000
    generate_improvement(
        skill_name="test_skill",
        skill_content=large_content,
        recent_failures=[],
    )

    # Verify the prompt sent to Ollama has truncated content
    call_args = mock_post.call_args
    prompt = call_args[1]["json"]["prompt"] if "json" in call_args[1] else call_args[0][1]["prompt"]
    assert "... (truncated)" in prompt


@patch("skills_tools.improve.requests.post")
def test_generate_improvement_limits_failures(mock_post):
    mock_response = MagicMock()
    mock_response.json.return_value = {
        "response": json.dumps({"diff": "", "rationale": "ok"})
    }
    mock_response.raise_for_status = MagicMock()
    mock_post.return_value = mock_response

    failures = [{"error": f"error {i}", "task_description": f"task {i}"} for i in range(20)]
    generate_improvement(
        skill_name="test_skill",
        skill_content="content",
        recent_failures=failures,
    )

    call_args = mock_post.call_args
    prompt = call_args[1]["json"]["prompt"] if "json" in call_args[1] else call_args[0][1]["prompt"]
    # Only first 10 failures should be included
    assert "error 9" in prompt
    assert "error 10" not in prompt
