#!/usr/bin/env bash
set -euo pipefail

# Configure SLM for Mode B (Ollama)
export SLM_MODE="${SLM_MODE:-b}"
export OLLAMA_HOST="${OLLAMA_HOST:-http://ollama:11434}"
export SLM_DATA_DIR="${SLM_DATA_DIR:-/data}"

# SLM hardcodes Path.home() / ".superlocalmemory" as base_dir.
# Symlink ~/.superlocalmemory → /data/.superlocalmemory so DB lives on PVC.
SLM_HOME="$SLM_DATA_DIR/.superlocalmemory"
REAL_HOME="${HOME:-/home/node}"
mkdir -p "$SLM_HOME"
if [ ! -L "$REAL_HOME/.superlocalmemory" ]; then
  rm -rf "$REAL_HOME/.superlocalmemory"
  ln -sf "$SLM_HOME" "$REAL_HOME/.superlocalmemory"
  echo "[SLM] Symlinked $REAL_HOME/.superlocalmemory → $SLM_HOME"
fi

# Initialize SLM: bypass interactive wizard by creating config.json + DB directly.
# `slm setup` is interactive-only (prompts for mode selection via stdin) and
# crashes with EOFError in non-interactive containers. Instead, we create
# config.json directly with the desired Mode B (Ollama) settings.
CONFIG_FILE="$SLM_HOME/config.json"
python3 -c "
import json, sys, os
slm_home = sys.argv[1]
mode = sys.argv[2]
ollama_host = sys.argv[3]
ollama_model = sys.argv[4]

config_path = os.path.join(slm_home, 'config.json')

# Create or update config.json
if os.path.exists(config_path):
    with open(config_path) as f: cfg = json.load(f)
    print('[SLM] Updating existing config.json...')
else:
    cfg = {
        'mode': 'a',
        'active_profile': 'default',
        'llm': {'provider': '', 'model': '', 'api_key': '', 'base_url': ''},
        'embedding': {
            'model_name': 'nomic-ai/nomic-embed-text-v1.5',
            'dimension': 768,
            'provider': '',
            'api_endpoint': '',
            'api_key': '',
            'deployment_name': ''
        }
    }
    print('[SLM] Creating new config.json...')

cfg['mode'] = mode
if mode == 'b':
    cfg['llm']['provider'] = 'ollama'
    cfg['llm']['base_url'] = ollama_host
    cfg['llm']['model'] = ollama_model
    cfg['embedding']['provider'] = 'ollama'
    cfg['embedding']['api_endpoint'] = ollama_host
    cfg['embedding']['model_name'] = 'nomic-embed-text'

with open(config_path, 'w') as f: json.dump(cfg, f, indent=2)
print(f'[SLM] config.json ready: mode={cfg[\"mode\"]}, provider={cfg[\"llm\"][\"provider\"]}')
" "$SLM_HOME" "$SLM_MODE" "${OLLAMA_HOST}" "${OLLAMA_MODEL:-qwen3.5:4b}"

# Create memory.db via SLM's own init if missing (use load_or_create)
if [ ! -f "$SLM_HOME/memory.db" ]; then
  echo "[SLM] Creating database..."
  python3 -c "
from superlocalmemory.core.config import SLMConfig
cfg = SLMConfig.load_or_create()
print(f'[SLM] Database created at {cfg.db_path}')
" || echo "[SLM] Warning: DB auto-create failed. Check PVC mount permissions and disk space at $SLM_DATA_DIR. slm mcp may self-heal on start."
fi

# Create openclaw profile if not exists
slm profile create openclaw 2>&1 || echo "[SLM] profile 'openclaw' may already exist"
slm profile switch openclaw 2>&1 || {
  echo "[SLM] FATAL: cannot switch profile" >&2
  exit 1
}

echo "[SLM] Status:"
slm status 2>&1 || echo "[SLM] Warning: status check returned error"

echo "[SLM] Starting MCP server on port 3000 via supergateway (Mode $SLM_MODE)..."
exec npx -y supergateway --stdio "slm mcp" --outputTransport streamableHttp --port 3000 --host 0.0.0.0
