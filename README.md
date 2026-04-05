# SuperLocalMemory Dashboard

Docker containerized Node.js application that serves as a dashboard/gateway for SuperLocalMemory (SLM) — a memory management system that integrates with Ollama for local LLM inference.

## Architecture

```
┌─────────────────────────────────────────────────┐
│               Docker Container                  │
│                                                 │
│  ┌──────────────┐      ┌──────────────────────┐ │
│  │  MCP Server   │      │  Next.js Dashboard   │ │
│  │  (port 3000)  │      │  (port 3002)         │ │
│  │  supergateway │      │  /dashboard/api/*    │ │
│  │  + slm mcp    │      │  /dashboard          │ │
│  └──────┬───────┘      └──────────┬───────────┘ │
│         │                         │              │
│  ┌──────┴─────────────────────────┴───────────┐ │
│  │           SLM Core (superlocalmemory)       │ │
│  │           memory.db  │  config.json         │ │
│  └──────────────────────┬─────────────────────┘ │
│                         │                        │
└─────────────────────────┼────────────────────────┘
                          │
               ┌──────────┴──────────┐
               │   Ollama (external)  │
               │   LLM + Embeddings   │
               └─────────────────────┘
```

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

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `SLM_MODE` | `b` | SLM mode (`b` = Ollama) |
| `OLLAMA_HOST` | `http://ollama:11434` | Ollama endpoint URL |
| `OLLAMA_MODEL` | `qwen3.5:4b` | LLM model name |
| `SLM_DATA_DIR` | `/data` | Persistent data directory |
| `LOG_LEVEL` | `info` | Log level (debug, info, warn, error) |
| `HEALTH_CACHE_TTL` | `60` | Health check disk cache TTL in seconds |

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

## Development

See [docs/development.md](docs/development.md) for local development setup.

## Troubleshooting

See [docs/troubleshooting.md](docs/troubleshooting.md) for common issues and solutions.
