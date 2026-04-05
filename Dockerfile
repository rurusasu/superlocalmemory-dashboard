# syntax=docker/dockerfile:1.7

# Stage 1: Build dashboard
FROM node:22-bookworm-slim AS dashboard-builder
WORKDIR /dashboard
COPY dashboard/package.json dashboard/package-lock.json* dashboard/.npmrc* ./
RUN npm ci
COPY dashboard/ .
RUN npm run build

# Stage 2: Runtime
FROM node:22-bookworm-slim

SHELL ["/bin/bash", "-o", "pipefail", "-c"]

RUN \
  --mount=type=cache,target=/var/lib/apt,sharing=locked \
  --mount=type=cache,target=/var/cache/apt,sharing=locked \
  apt-get update && \
  apt-get install -y --no-install-recommends \
    python3 python3-pip ca-certificates

# Install SLM npm package WITHOUT running postinstall (skip torch/GPU deps).
# Mode B uses Ollama for embeddings, so sentence-transformers/torch are unnecessary.
RUN --mount=type=cache,target=/root/.npm \
    npm install -g --ignore-scripts superlocalmemory supergateway

# Install only the Python dependencies needed for Mode B (Ollama).
# Core deps from pyproject.toml [project.dependencies] — NO [search] extras.
# This avoids torch (~2GB), sentence-transformers (~500MB), onnxruntime (~200MB).
RUN --mount=type=cache,target=/root/.cache/pip \
    pip install --no-cache-dir --break-system-packages \
      "numpy>=1.26.0,<3.0.0" \
      "scipy>=1.12.0,<2.0.0" \
      "networkx>=3.0" \
      "httpx>=0.24.0" \
      "python-dateutil>=2.9.0" \
      "rank-bm25>=0.2.2" \
      "vaderSentiment>=3.3.2" \
      "einops>=0.8.2" \
      "mcp>=1.0.0" \
      "fastapi[all]>=0.135.1" \
      "uvicorn>=0.42.0" \
      "websockets>=16.0" \
      "lightgbm>=4.0.0" \
      "diskcache>=5.6.0" \
      "orjson>=3.9.0"

# pip install the SLM package itself (from npm-installed source, no extras)
RUN --mount=type=cache,target=/root/.cache/pip \
    SLM_PKG=$(find /usr/local/lib/node_modules/superlocalmemory -name "pyproject.toml" -maxdepth 1 -printf '%h' -quit) \
    && pip install --no-cache-dir --break-system-packages --no-deps "$SLM_PKG"

# Patch: increase worker timeout from 60s to 300s for CPU/slow-GPU inference
RUN find / -name "worker_pool.py" -path "*/superlocalmemory/*" -exec \
    sed -i 's/_REQUEST_TIMEOUT = 60/_REQUEST_TIMEOUT = 300/' {} + 2>/dev/null || true

# Dashboard
COPY --from=dashboard-builder /dashboard/.next/standalone /app/dashboard
COPY --from=dashboard-builder /dashboard/.next/static /app/dashboard/.next/static
COPY --from=dashboard-builder /dashboard/public /app/dashboard/public

# Skills tools
COPY skills_tools/ /app/skills_tools/

# Non-root user (node user already exists with UID 1000)
USER node

WORKDIR /app
EXPOSE 3000 3002

HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD node -e "fetch('http://localhost:3002/api/healthz').then(r=>{if(!r.ok)throw 1}).catch(()=>process.exit(1))"

COPY --chown=node:node entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

ENTRYPOINT ["/app/entrypoint.sh"]
