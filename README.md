# SuperLocalMemory Dashboard

[![CI](https://github.com/rurusasu/superlocalmemory-dashboard/actions/workflows/ci.yml/badge.svg)](https://github.com/rurusasu/superlocalmemory-dashboard/actions/workflows/ci.yml)
[![Security Scan](https://github.com/rurusasu/superlocalmemory-dashboard/actions/workflows/security.yml/badge.svg)](https://github.com/rurusasu/superlocalmemory-dashboard/actions/workflows/security.yml)
[![Docker Build](https://github.com/rurusasu/superlocalmemory-dashboard/actions/workflows/docker-publish.yml/badge.svg)](https://github.com/rurusasu/superlocalmemory-dashboard/actions/workflows/docker-publish.yml)
[![Docker Pulls](https://img.shields.io/docker/pulls/rurusasu/superlocalmemory-dashboard)](https://hub.docker.com/r/rurusasu/superlocalmemory-dashboard)
[![Docker Image Size](https://img.shields.io/docker/image-size/rurusasu/superlocalmemory-dashboard/latest)](https://hub.docker.com/r/rurusasu/superlocalmemory-dashboard)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

Docker containerized Node.js application that serves as a **dashboard and MCP gateway** for [SuperLocalMemory](https://www.npmjs.com/package/superlocalmemory) (SLM) — a memory management system that integrates with Ollama for local LLM inference.

---

## Features

| Feature | Description |
|---|---|
| **Next.js Dashboard** | Real-time memory visualization with stats cards, daily charts, and conversation search |
| **MCP Server** | Model Context Protocol server via supergateway (streamable HTTP) |
| **Ollama Integration** | Local LLM inference for embeddings and memory processing (Mode B) |
| **Health Monitoring** | Kubernetes-ready probes (liveness, readiness, startup) + Prometheus metrics |
| **Non-root Container** | Runs as `node` (UID 1000) for security best practices |
| **Multi-stage Build** | Optimized Docker image — no torch/GPU dependencies for Mode B |

---

## Architecture

```
┌──────────────────────────────────────────────────────┐
│                  Docker Container                     │
│                                                      │
│  ┌────────────────┐      ┌─────────────────────────┐ │
│  │  MCP Server     │      │  Next.js Dashboard      │ │
│  │  :3000          │      │  :3002                  │ │
│  │  supergateway   │      │  /dashboard/api/*       │ │
│  │  + slm mcp      │      │  - health, metrics      │ │
│  └───────┬────────┘      │  - conversations, stats  │ │
│          │                └───────────┬─────────────┘ │
│  ┌───────┴────────────────────────────┴─────────────┐ │
│  │            SLM Core (superlocalmemory)            │ │
│  │         memory.db  ·  config.json  ·  profiles    │ │
│  └──────────────────────┬───────────────────────────┘ │
│                         │                              │
└─────────────────────────┼──────────────────────────────┘
                          │
               ┌──────────┴──────────┐
               │   Ollama (external)  │
               │   LLM + Embeddings   │
               └─────────────────────┘
```

---

## CI Pipeline

| Workflow | Trigger | What it does |
|---|---|---|
| **CI** | push / PR to `main` | Lint (hadolint · ESLint · Prettier · Ruff) → Test (Vitest · pytest · tsc · build) |
| **Security** | `v*` tag / weekly | Trivy config scan · Trivy filesystem scan · npm audit · SARIF → GitHub Security |
| **Docker** | push to `main` / `v*` tag | Build + Smoke test (常時)。`v*` tag のみ Trivy scan → Push to Docker Hub |

```
push / PR to main
  ├─► CI ─────► Lint (parallel) ─► Test (parallel) ─► ✅
  │             ├ hadolint          ├ Vitest + tsc
  │             ├ ESLint            ├ pytest + coverage
  │             ├ Prettier          └ Next.js build
  │             └ Ruff
  └─► Docker ─► Build → Smoke Test ─► ✅

v* tag
  ├─► Security ─► Trivy + npm audit → GitHub Security tab
  └─► Docker ───► Build → Smoke Test → Trivy Scan → Push
```

---

## Quick Start

### Docker

```bash
docker pull rurusasu/superlocalmemory-dashboard:latest
docker run -p 3000:3000 -p 3002:3002 \
  -e SLM_MODE=b \
  -e OLLAMA_HOST=http://host.docker.internal:11434 \
  -v slm-data:/data \
  rurusasu/superlocalmemory-dashboard:latest
```

### Docker Compose

```yaml
services:
  slm:
    image: rurusasu/superlocalmemory-dashboard:latest
    ports:
      - "3000:3000"
      - "3002:3002"
    environment:
      SLM_MODE: b
      OLLAMA_HOST: http://ollama:11434
    volumes:
      - slm-data:/data
    depends_on:
      - ollama

  ollama:
    image: ollama/ollama:latest
    ports:
      - "11434:11434"
    volumes:
      - ollama-data:/root/.ollama

volumes:
  slm-data:
  ollama-data:
```

### Kubernetes

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: slm-dashboard
spec:
  replicas: 1
  selector:
    matchLabels:
      app: slm-dashboard
  template:
    spec:
      containers:
        - name: slm
          image: rurusasu/superlocalmemory-dashboard:latest
          ports:
            - containerPort: 3000
            - containerPort: 3002
          env:
            - name: OLLAMA_HOST
              value: http://ollama:11434
          livenessProbe:
            httpGet:
              path: /dashboard/api/healthz
              port: 3002
            periodSeconds: 30
            timeoutSeconds: 5
          readinessProbe:
            httpGet:
              path: /dashboard/api/readyz
              port: 3002
            periodSeconds: 10
            timeoutSeconds: 5
          startupProbe:
            httpGet:
              path: /dashboard/api/startupz
              port: 3002
            periodSeconds: 5
            failureThreshold: 12
```

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `SLM_MODE` | `b` | SLM mode (`b` = Ollama) |
| `OLLAMA_HOST` | `http://ollama:11434` | Ollama endpoint URL |
| `OLLAMA_MODEL` | `qwen3.5:4b` | LLM model name |
| `SLM_DATA_DIR` | `/data` | Persistent data directory |
| `LOG_LEVEL` | `info` | Log level (`debug`, `info`, `warn`, `error`) |
| `HEALTH_CACHE_TTL` | `60` | Health check disk cache TTL in seconds |

---

## Ports

| Port | Service | Description |
|---|---|---|
| `3000` | MCP Server | SuperLocalMemory MCP via supergateway (streamable HTTP) |
| `3002` | Dashboard | Next.js web UI and REST API |

---

## Volume Mounts

| Path | Description |
|---|---|
| `/data` | Persistent data — `memory.db`, `config.json`, profiles |

---

## API Endpoints

| Endpoint | Description |
|---|---|
| `GET /api/health` | System health check (status, Ollama, DB, disk) |
| `GET /api/conversations?q=&limit=&offset=` | List/search conversations with pagination |
| `GET /api/stats` | Daily memory counts for charts |
| `GET /api/healthz` | Liveness probe |
| `GET /api/readyz` | Readiness probe |
| `GET /api/startupz` | Startup probe |
| `GET /api/metrics` | Prometheus metrics |

### Examples

```bash
# Health check
curl http://localhost:3002/dashboard/api/health

# Search conversations
curl "http://localhost:3002/dashboard/api/conversations?q=hello&limit=10"

# Prometheus metrics
curl http://localhost:3002/dashboard/api/metrics
```

Full API specification: [`dashboard/docs/openapi.yaml`](dashboard/docs/openapi.yaml)

---

## Development

### Prerequisites

- Node.js 22+
- Python 3.11+
- Docker (for container builds)

### Local Setup

```bash
# Dashboard
cd dashboard
npm ci
npm run dev          # Start dev server on :3000

# Python skills_tools
pip install -r requirements-dev.txt
```

### Running Tests

```bash
# Dashboard (Vitest)
cd dashboard && npm test

# Python (pytest)
python -m pytest tests/unit/ -v --cov=skills_tools
```

### Linting

```bash
# Dashboard
cd dashboard
npm run lint         # ESLint
npm run format:check # Prettier

# Python
ruff check skills_tools/ tests/
ruff format --check skills_tools/ tests/

# Dockerfile
hadolint Dockerfile
```

### Build Docker Image Locally

```bash
docker build -t superlocalmemory-dashboard .
docker run --rm -p 3000:3000 -p 3002:3002 \
  -e SLM_MODE=b \
  superlocalmemory-dashboard
```

See [docs/development.md](docs/development.md) for full development guide.

---

## Security

- Container runs as non-root user `node` (UID 1000)
- Weekly Trivy scans for vulnerabilities (config, filesystem, image)
- npm audit on every PR for dependency vulnerabilities
- SARIF results uploaded to GitHub Security tab
- No secrets stored in image — all config via environment variables

---

## Troubleshooting

See [docs/troubleshooting.md](docs/troubleshooting.md) for common issues and solutions.

---

## License

[MIT](LICENSE)
