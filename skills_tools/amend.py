#!/usr/bin/env python3
"""Skill amendment — applies proposed changes to SKILL.md files."""

import hashlib
import json
import logging
import os
from datetime import UTC, datetime

logger = logging.getLogger(__name__)


def amend_skill(
    skill_name: str,
    proposed_content: str,
    rationale: str,
    skills_dir: str = "/app/data/skills",
    versions_dir: str = "/app/data/skill_versions",
) -> dict[str, object]:
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
        logger.warning("Path traversal rejected for skill: %s", skill_name)
        return {"success": False, "message": f"Path traversal rejected: {skill_name}"}
    if not os.path.exists(skill_path):
        logger.warning("Skill not found: %s", skill_path)
        return {"success": False, "message": f"Skill not found: {skill_path}"}

    # Read current content and create backup
    with open(skill_path) as f:
        current_content = f.read()

    content_hash = hashlib.sha256(current_content.encode()).hexdigest()[:12]
    version_id = f"{skill_name}-{content_hash}-{datetime.now(UTC).strftime('%Y%m%dT%H%M%S')}"

    os.makedirs(versions_dir, exist_ok=True)
    version_record = {
        "version_id": version_id,
        "skill_name": skill_name,
        "content_hash": content_hash,
        "rationale": rationale,
        "created_at": datetime.now(UTC).isoformat(),
    }
    # Apply the amendment first, then write version record
    try:
        with open(skill_path, "w") as f:
            f.write(proposed_content)
    except OSError as e:
        logger.error("Failed to write skill file %s: %s", skill_path, e)
        return {"success": False, "message": str(e), "version_id": version_id}

    # Write version backup only after amendment succeeded
    version_path = os.path.join(versions_dir, f"{version_id}.json")
    try:
        with open(version_path, "w") as f:
            json.dump(version_record, f, indent=2)
    except OSError as e:
        logger.error("Failed to write version backup %s: %s", version_path, e)
        msg = f"Amended {skill_name} (version backup failed: {e})"
        return {"success": True, "message": msg, "version_id": version_id}

    logger.info("Amended skill %s, version_id=%s", skill_name, version_id)
    return {"success": True, "message": f"Amended {skill_name}", "version_id": version_id}
