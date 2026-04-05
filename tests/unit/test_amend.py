"""Tests for skills_tools/amend.py"""

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
