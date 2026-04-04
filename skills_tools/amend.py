#!/usr/bin/env python3
"""Skill amendment — applies proposed changes to SKILL.md files."""

import hashlib
import json
import os
from datetime import datetime, timezone


def amend_skill(
    skill_name: str,
    proposed_content: str,
    rationale: str,
    skills_dir: str = "/app/data/skills",
    versions_dir: str = "/app/data/skill_versions",
) -> dict:
    """Apply an improvement proposal to a skill's SKILL.md.

    Args:
        skill_name: Name of the skill directory.
        proposed_content: New SKILL.md content.
        rationale: Why this change was made.
        skills_dir: Base directory for skills.
        versions_dir: Directory to store version backups.

    Returns:
        Dict with 'success', 'message', and 'version_id'.
    """
    skill_path = os.path.join(skills_dir, skill_name, "SKILL.md")
    # Path traversal guard: ensure skill_path is within skills_dir
    real_path = os.path.realpath(skill_path)
    real_base = os.path.realpath(skills_dir)
    if not real_path.startswith(real_base + os.sep):
        return {"success": False, "message": f"Path traversal rejected: {skill_name}"}
    if not os.path.exists(skill_path):
        return {"success": False, "message": f"Skill not found: {skill_path}"}

    # Read current content and create backup
    with open(skill_path, "r") as f:
        current_content = f.read()

    content_hash = hashlib.sha256(current_content.encode()).hexdigest()[:12]
    version_id = f"{skill_name}-{content_hash}-{datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S')}"

    os.makedirs(versions_dir, exist_ok=True)
    version_record = {
        "version_id": version_id,
        "skill_name": skill_name,
        "content_hash": content_hash,
        "rationale": rationale,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    # Apply the amendment first, then write version record
    try:
        with open(skill_path, "w") as f:
            f.write(proposed_content)
    except OSError as e:
        return {"success": False, "message": str(e), "version_id": version_id}

    # Write version backup only after amendment succeeded
    version_path = os.path.join(versions_dir, f"{version_id}.json")
    try:
        with open(version_path, "w") as f:
            json.dump(version_record, f, indent=2)
    except OSError as e:
        return {"success": True, "message": f"Amended {skill_name} (version backup failed: {e})", "version_id": version_id}

    return {"success": True, "message": f"Amended {skill_name}", "version_id": version_id}
