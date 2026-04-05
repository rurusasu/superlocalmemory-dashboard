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
- **Dashboard tests**: Vitest — run `npm test` in `dashboard/`
- **Python tests**: pytest — run `python -m pytest tests/unit/ -v` from project root
- The container runs as non-root user `node` (UID 1000).
- Python scripts in `skills_tools/` are pure library modules (no CLI entrypoints).

## Linting
- **Dockerfile**: hadolint (config: `.hadolint.yaml`)
- **TypeScript/JSX**: ESLint — `npm run lint` in `dashboard/`
- **Formatting (TS)**: Prettier — `npm run format:check` in `dashboard/`
- **Python**: Ruff (check + format) — `ruff check skills_tools/ tests/` and `ruff format --check skills_tools/ tests/`
- Ruff config is in `pyproject.toml` (`line-length = 100`, rules: E, F, W, I, UP)

## CI/CD (GitHub Actions)
- **CI** (`ci.yml`): push/PR to `main` → Lint (hadolint, ESLint, Prettier, Ruff) → Test (Vitest, pytest, tsc, build). Lint jobs run in parallel; test jobs depend on their respective lint jobs passing.
- **Security** (`security.yml`): `v*` tag + weekly schedule → Trivy config/filesystem scan, npm audit, SARIF → GitHub Security tab.
- **Docker** (`docker-publish.yml`): `v*` tag only → Build → Smoke test → Trivy image scan → Push to Docker Hub. Does NOT run on push to main or PRs.

## Building & Testing the Docker Image
```bash
docker build -t superlocalmemory-dashboard .
docker run --rm -p 3000:3000 -p 3002:3002 -e SLM_MODE=b superlocalmemory-dashboard
```
