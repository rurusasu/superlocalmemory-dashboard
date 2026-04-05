"""Unit tests for skills_tools/improve.py

What:
    generate_improvement() が Ollama API を呼び出してスキル改善提案を生成し、
    レスポンスを安全にパースして返す一連のプロセスを検証する。

Why:
    この関数はスキル自動改善パイプラインの中核であり、外部API（Ollama）と
    LLMの出力（不定形JSON）という2つの不安定要素を扱う。
    API障害やLLMの不正出力に対する堅牢性がないと、
    改善パイプライン全体が停止するか、不正なデータが下流に流れる。

Risk if failing:
    - Ollama API エラーの未処理でプロセスがクラッシュし、改善機能全体が停止する
    - LLM が不正 JSON を返した際にパイプラインが永久に停止する
    - 巨大なスキル内容で Ollama のコンテキストウィンドウを超過し、API エラーが頻発する
    - 大量の失敗ログでプロンプトが肥大化し、レスポンス品質が劣化する
"""

import json
from unittest.mock import MagicMock, patch

import pytest

from skills_tools.improve import generate_improvement


@patch("skills_tools.improve.requests.post")
def test_generate_improvement_success(mock_post):
    """What: Ollama が有効な JSON を返した場合、diff と rationale を正しく抽出する。
    Why:  正常系の基本動作。改善提案がパイプライン下流（amend_skill）に渡せることを保証する。
    Risk: 正常なレスポンスでも diff/rationale が空になり、改善が一切適用されなくなる。
    """
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
    """What: Ollama が不正な JSON を返した場合、success=False とフォールバック理由を返す。
    Why:  LLM の出力は保証されない。不正 JSON でもクラッシュせず、
          呼び出し元が適切に処理できる形式で返す必要がある。
    Risk: JSON.loads の例外が未処理でプロセスクラッシュし、改善パイプラインが完全停止する。
    """
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
    """What: Ollama が空の JSON オブジェクト '{}' を返した場合、デフォルト値で応答する。
    Why:  LLM が diff/rationale フィールドを省略する場合がある。
          KeyError ではなくデフォルト値で安全にフォールバックする。
    Risk: キー欠損で例外が発生し、正常な API 応答なのにエラー扱いされる。
    """
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
    """What: Ollama への接続が失敗した場合、ConnectionError が呼び出し元に伝播する。
    Why:  ネットワーク障害や Ollama 停止時に、呼び出し元がリトライや
          アラート等の適切なエラーハンドリングを行えるようにする。
    Risk: 例外が握りつぶされ、API 障害が検出されず改善が「成功したが空」と誤認される。
    """
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
    """What: 50,000文字超のスキル内容が切り詰められてから Ollama に送信される。
    Why:  巨大なプロンプトは Ollama のコンテキストウィンドウを超過し、
          APIエラーやメモリ不足を引き起こす。事前に切り詰めてこれを防ぐ。
    Risk: 切り詰めが動作せず、大きなスキルの改善時に毎回 API エラーが発生する。
          または Ollama プロセスが OOM で強制終了する。
    """
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
    """What: 失敗レコードが10件を超える場合、最初の10件のみがプロンプトに含まれる。
    Why:  大量の失敗ログをすべて含めるとプロンプトが肥大化し、
          LLM の注意が分散して改善提案の品質が低下する。
    Risk: 失敗ログが無制限に含まれ、プロンプトサイズ超過で API エラーが発生する。
          または LLM が大量のノイズに埋もれて的外れな提案を返す。
    """
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
