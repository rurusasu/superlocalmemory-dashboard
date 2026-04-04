# syntax=docker/dockerfile:1.7

# Stage 1: Build dashboard
FROM node:22-bookworm-slim AS dashboard-builder
WORKDIR /dashboard
COPY dashboard/package.json dashboard/package-lock.json* ./
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

# SLM + supergateway
RUN --mount=type=cache,target=/root/.npm \
    npm install -g superlocalmemory supergateway

# Patch: increase worker timeout from 60s to 300s
RUN find / -name "worker_pool.py" -path "*/superlocalmemory/*" -exec \
    sed -i 's/_REQUEST_TIMEOUT = 60/_REQUEST_TIMEOUT = 300/' {} + 2>/dev/null || true

# Mode B: remove GPU deps (saves ~5GB)
RUN find / -type d \( \
    -name "nvidia" -o -name "torch" -o -name "triton" -o -name "sympy" \
    -o -name "cuda" -o -name "sklearn" -o -name "transformers" \
    -o -name "sentence_transformers" -o -name "safetensors" \
    -o -name "tokenizers" \
    \) -path "*/dist-packages/*" -exec rm -rf {} + 2>/dev/null || true && \
    rm -rf /root/.cache 2>/dev/null || true

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

COPY --chown=node:node entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

ENTRYPOINT ["/app/entrypoint.sh"]
