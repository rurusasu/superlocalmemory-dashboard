"""Unit tests for skills_tools/amend.py

What:
    amend_skill() がスキルファイル（SKILL.md）を安全に更新し、
    バージョンバックアップを作成する一連のプロセスを検証する。

Why:
    amend_skill() はスキルの自動改善パイプラインの最終段階で、
    実際にファイルを上書きする破壊的操作を行う。
    不具合があるとスキルファイルの破損、データ損失、
    またはセキュリティ侵害（パストラバーサル）につながる。

Risk if failing:
    - スキルファイルが更新されず、改善提案が永久に反映されない
    - パストラバーサルが通過し、攻撃者がコンテナ内の任意ファイルを上書きできる
    - バージョンバックアップが作成されず、改善前の状態に復元不能になる
    - versions_dir の自動作成が失敗し、初回実行時にクラッシュする
"""

import json
import os

import pytest

from skills_tools.amend import amend_skill


@pytest.fixture
def skill_dirs(tmp_path):
    """Create temporary skill and version directories."""
    skills_dir = tmp_path / "skills"
    versions_dir = tmp_path / "versions"
    skill_dir = skills_dir / "test_skill"
    skill_dir.mkdir(parents=True)
    (skill_dir / "SKILL.md").write_text("# Original Content")
    return str(skills_dir), str(versions_dir)


def test_amend_skill_success(skill_dirs):
    """What: 正常なスキル名と内容で、ファイル更新＋バックアップ作成が行われる。
    Why:  改善パイプラインの正常系。ファイル書き込みとメタデータ保存の両方が成功する
          ことを保証する。
    Risk: ファイルが更新されないか、バックアップが作成されず、
          改善の適用または復元が不可能になる。
    """
    skills_dir, versions_dir = skill_dirs
    result = amend_skill(
        skill_name="test_skill",
        proposed_content="# Updated Content",
        rationale="Improving clarity",
        skills_dir=skills_dir,
        versions_dir=versions_dir,
    )
    assert result["success"] is True
    assert "Amended test_skill" in result["message"]
    assert "version_id" in result

    # Verify file was updated
    skill_path = os.path.join(skills_dir, "test_skill", "SKILL.md")
    with open(skill_path) as f:
        assert f.read() == "# Updated Content"

    # Verify version backup was created
    version_files = os.listdir(versions_dir)
    assert len(version_files) == 1
    with open(os.path.join(versions_dir, version_files[0])) as f:
        record = json.load(f)
    assert record["skill_name"] == "test_skill"
    assert record["rationale"] == "Improving clarity"


def test_amend_skill_not_found(skill_dirs):
    """What: 存在しないスキル名を指定した場合、success=False を返す。
    Why:  スキル削除後やスキル名のタイポで存在しないパスへの書き込みを防ぐ。
    Risk: 存在しないパスへの書き込みを試行し、予期しないディレクトリ構造が作られる。
          または例外が未処理で上位にクラッシュが伝播する。
    """
    skills_dir, versions_dir = skill_dirs
    result = amend_skill(
        skill_name="nonexistent",
        proposed_content="content",
        rationale="reason",
        skills_dir=skills_dir,
        versions_dir=versions_dir,
    )
    assert result["success"] is False
    assert "Skill not found" in result["message"]


def test_amend_skill_path_traversal(skill_dirs):
    """What: '../../etc' のようなパストラバーサル攻撃を検出し拒否する。
    Why:  skill_name はMCPプロトコル経由でLLMやクライアントから渡される入力。
          未検証だと攻撃者がスキルディレクトリ外の任意ファイル（/etc/passwd等）を
          上書きできるセキュリティ脆弱性になる。
    Risk: コンテナ内の任意ファイルが上書き可能になり、
          権限昇格やシステム破壊につながる重大なセキュリティインシデントが発生する。
    """
    skills_dir, versions_dir = skill_dirs
    result = amend_skill(
        skill_name="../../etc",
        proposed_content="content",
        rationale="reason",
        skills_dir=skills_dir,
        versions_dir=versions_dir,
    )
    assert result["success"] is False
    assert "Path traversal rejected" in result["message"]


def test_amend_skill_version_id_format(skill_dirs):
    """What: version_id がスキル名をプレフィックスとする一意な文字列である。
    Why:  version_id はバックアップファイル名やログの追跡に使われる。
          スキル名がプレフィックスにないと、どのスキルのバージョンかの特定が困難になる。
    Risk: バージョン追跡が不能になり、問題発生時にどの改善が原因かを特定できない。
    """
    skills_dir, versions_dir = skill_dirs
    result = amend_skill(
        skill_name="test_skill",
        proposed_content="# New",
        rationale="test",
        skills_dir=skills_dir,
        versions_dir=versions_dir,
    )
    assert result["version_id"].startswith("test_skill-")


def test_amend_skill_creates_versions_dir(skill_dirs):
    """What: versions_dir が存在しない場合、自動的に作成される。
    Why:  初回実行時やクリーンデプロイ直後は versions_dir がまだ存在しない。
          自動作成しないと初回の改善適用がすべて失敗する。
    Risk: 初回実行時に FileNotFoundError で改善パイプライン全体が停止する。
    """
    skills_dir, versions_dir = skill_dirs
    # versions_dir doesn't exist yet
    assert not os.path.exists(versions_dir)
    amend_skill(
        skill_name="test_skill",
        proposed_content="# New",
        rationale="test",
        skills_dir=skills_dir,
        versions_dir=versions_dir,
    )
    assert os.path.exists(versions_dir)
