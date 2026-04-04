# superlocalmemory-dashboard

SuperLocalMemory container with built-in health & data dashboard.

## Quick Start

```bash
docker pull rurusasu/superlocalmemory-dashboard:latest
docker run -p 3000:3000 \
  -e SLM_MODE=b \
  -e OLLAMA_HOST=http://host.docker.internal:11434 \
  -v slm-data:/data \
  rurusasu/superlocalmemory-dashboard:latest
```

## Dashboard

Access at `http://localhost:3002/dashboard` (available after Phase 4 implementation).

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| SLM_MODE | b | SLM mode (b = Ollama) |
| OLLAMA_HOST | http://ollama:11434 | Ollama endpoint |
| OLLAMA_MODEL | qwen3.5:4b | LLM model |
| SLM_DATA_DIR | /data | Persistent data directory |

## Architecture

- **MCP Server**: SuperLocalMemory via supergateway on port 3000
- **Dashboard**: Next.js App Router on port 3002 (coming soon)
- **Base**: npm `superlocalmemory` + `supergateway` (wrapper, not fork)
