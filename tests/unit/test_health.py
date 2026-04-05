"""Unit tests for skills_tools/health.py

What:
    calculate_health_score() と needs_improvement() の計算ロジックを検証する。
    成功率の算出、補正ペナルティの適用、ウィンドウサイズによる直近データの切り出し、
    スコアの0.0-1.0クランプ、閾値による改善判定を網羅する。

Why:
    ヘルススコアはスキルの自動改善トリガーの判断基盤。
    スコア計算が狂うと、正常なスキルが不要に改善されたり、
    劣化したスキルが放置されたりする。

Risk if failing:
    - スコアが常に1.0を返すと、劣化スキルが一切改善されず品質が低下し続ける
    - スコアが常に0.0を返すと、全スキルが不要な改善ループに入り Ollama に過負荷がかかる
    - ウィンドウ処理の不備で古い実行結果が評価に含まれ、改善判断が不正確になる
    - クランプ漏れで負のスコアが発生し、下流の比較ロジックが破綻する
"""

import pytest


@pytest.fixture(autouse=True)
def _reset_env(monkeypatch):
    """Ensure default env values for each test."""
    monkeypatch.setenv("SKILL_HEALTH_WINDOW", "20")
    monkeypatch.setenv("SKILL_HEALTH_THRESHOLD", "0.7")
    monkeypatch.setenv("SKILL_CORRECTION_PENALTY", "0.05")
    # Re-import to pick up env changes
    import importlib  # noqa: E402

    import skills_tools.health as h  # noqa: E402

    importlib.reload(h)


def test_calculate_health_score_all_success():
    """What: 全実行が成功の場合、スコア 1.0 を返す。
    Why:  完全に正常なスキルが最高スコアを得ることを保証する。
    Risk: 正常スキルが低スコアとなり、不要な改善処理が走る。
    """
    from skills_tools.health import calculate_health_score

    executions = [{"success": True}] * 10
    score = calculate_health_score(executions)
    assert score == 1.0


def test_calculate_health_score_all_failures():
    """What: 全実行が失敗の場合、スコア 0.0 を返す。
    Why:  完全に壊れたスキルが最低スコアを得ることを保証する。
    Risk: 全失敗スキルが高スコアとなり、改善がトリガーされない。
    """
    from skills_tools.health import calculate_health_score

    executions = [{"success": False}] * 10
    score = calculate_health_score(executions)
    assert score == 0.0


def test_calculate_health_score_empty_list():
    """What: 実行履歴が空の場合、デフォルト値 1.0 を返す。
    Why:  新規作成直後のスキルはまだ実行実績がない。
          この場合「問題なし」とみなし、不要な改善を防ぐ。
    Risk: 空リストで例外が発生するか 0.0 を返し、新規スキルが即座に改善対象になる。
    """
    from skills_tools.health import calculate_health_score

    score = calculate_health_score([])
    assert score == 1.0


def test_calculate_health_score_mixed():
    """What: 成功7件・失敗3件（成功率70%）で正確なスコアを返す。
    Why:  成功率の計算精度を検証する。閾値ちょうどのケースが正しく計算されることが重要。
    Risk: 成功率の計算に端数誤差があり、閾値判定が不安定になる。
    """
    from skills_tools.health import calculate_health_score

    executions = [{"success": True}] * 7 + [{"success": False}] * 3
    score = calculate_health_score(executions)
    assert score == pytest.approx(0.7)


def test_calculate_health_score_with_corrections():
    """What: ユーザー補正回数がペナルティとしてスコアから減算される。
    Why:  ユーザーが手動で修正した回数が多いスキルは、自動実行の信頼性が低い。
          ペナルティで改善対象に誘導する。
    Risk: ペナルティが反映されず、頻繁に手動修正されるスキルが改善されない。
    """
    from skills_tools.health import calculate_health_score

    executions = [{"success": True}] * 10
    score = calculate_health_score(executions, correction_count=4)
    # 1.0 - (4 * 0.05) = 0.8
    assert score == pytest.approx(0.8)


def test_calculate_health_score_clamped_to_zero():
    """What: ペナルティ過大でも、スコアが 0.0 未満にならない（クランプ）。
    Why:  負のスコアは下流ロジック（比較、表示等）で想定されていない。
    Risk: 負のスコアが発生し、ソート順の逆転や表示バグが起きる。
    """
    from skills_tools.health import calculate_health_score

    executions = [{"success": True}] * 10
    score = calculate_health_score(executions, correction_count=100)
    assert score == 0.0


def test_calculate_health_score_uses_window():
    """What: WINDOW サイズ（デフォルト20）で直近の実行のみが評価対象になる。
    Why:  古い実行結果は現在のスキル品質を反映しない。
          ウィンドウで「今の状態」だけを評価する。
    Risk: ウィンドウ処理が壊れ、過去の大量の失敗が永久にスコアを下げ続ける。
    """
    from skills_tools.health import calculate_health_score

    # 30 entries: first 10 failures, last 20 successes (window=20)
    executions = [{"success": False}] * 10 + [{"success": True}] * 20
    score = calculate_health_score(executions)
    assert score == 1.0


def test_calculate_health_score_missing_success_key():
    """What: 実行レコードに 'success' キーがない場合、失敗として扱う。
    Why:  不完全なデータ（ログ欠損等）を安全側（失敗）に倒す。
    Risk: キー欠損で例外が発生してスコア計算自体が不能になる。
          または成功と誤判定され、壊れたスキルが放置される。
    """
    from skills_tools.health import calculate_health_score

    executions = [{"other": "data"}] * 5
    score = calculate_health_score(executions)
    assert score == 0.0


def test_needs_improvement_below_threshold():
    """What: スコアが閾値未満の場合 True を返す。
    Why:  改善トリガーの基本判定。閾値未満のスキルを確実に検出する。
    Risk: 劣化スキルが検出されず、改善プロセスが一切起動しない。
    """
    from skills_tools.health import needs_improvement

    assert needs_improvement(0.5) is True


def test_needs_improvement_above_threshold():
    """What: スコアが閾値より高い場合 False を返す。
    Why:  正常なスキルに不要な改善が走らないことを保証する。
    Risk: 全スキルが改善対象となり、Ollama への無駄な負荷が発生する。
    """
    from skills_tools.health import needs_improvement

    assert needs_improvement(0.9) is False


def test_needs_improvement_at_threshold():
    """What: スコアがちょうど閾値と等しい場合 False を返す（境界値テスト）。
    Why:  閾値ジャストで「改善不要」とする仕様を検証する。off-by-one の防止。
    Risk: 閾値ちょうどのスキルが改善対象になり、安定したスキルが不安定化する。
    """
    from skills_tools.health import needs_improvement

    assert needs_improvement(0.7) is False
