#!/bin/bash
set -e

# Claude Code on the Web - setup script
# Runs before each new session on Anthropic's cloud VM.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$SCRIPT_DIR"

cd "$REPO_ROOT"
echo "[setup] repo root: $REPO_ROOT"

# Install dashboard dependencies
if [ -d "dashboard" ]; then
  cd dashboard && npm install
  echo "[setup] dashboard dependencies installed"
fi
