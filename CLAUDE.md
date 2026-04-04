# SuperLocalMemory Dashboard

## Project Overview
Docker containerized Node.js application that serves as a dashboard/gateway for SuperLocalMemory (SLM).
SLM is a memory management system that integrates with Ollama for local LLM inference.

## Architecture
- **Dockerfile**: Multi-stage Node.js 22 container with Python 3 support
- **entrypoint.sh**: Container startup script (SLM init + MCP server via supergateway)
- **skills_tools/**: Python utility modules (amend, health scoring, improvement proposals)
- **Port 3000**: MCP server exposed via supergateway (streamable HTTP)

## Key Dependencies
- `superlocalmemory` (npm, global): Core memory management
- `supergateway` (npm, global): HTTP wrapper for MCP protocol
- `requests` (Python): Used by `skills_tools/improve.py` for Ollama API calls

## Environment Variables
- `SLM_MODE` — default `b` (Ollama mode)
- `OLLAMA_HOST` — default `http://ollama:11434`
- `OLLAMA_MODEL` — default `qwen3.5:4b`
- `SLM_DATA_DIR` — default `/data`

## Development Notes
- No test framework is configured yet.
- No linter is configured yet.
- CI/CD: GitHub Actions builds and pushes Docker image to Docker Hub on `main` push.
- The container runs as non-root user `node` (UID 1000).
- Python scripts in `skills_tools/` are pure library modules (no CLI entrypoints).

## Building & Testing the Docker Image
```bash
docker build -t superlocalmemory-dashboard .
docker run --rm -p 3000:3000 -e SLM_MODE=b superlocalmemory-dashboard
```
