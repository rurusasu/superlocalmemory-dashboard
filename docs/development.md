# Development Guide

## Prerequisites

- Node.js 22+
- Python 3.11+
- Docker (for container builds)

## Local Development Setup

### Dashboard (Next.js)

```bash
cd dashboard
npm install
npm run dev
```

The dashboard will be available at `http://localhost:3000`.

### Python (skills_tools)

```bash
pip install -r requirements-dev.txt
```

## Running Tests

### Dashboard (Vitest)

```bash
cd dashboard
npm test           # Run once
npm run test:watch # Watch mode
```

### Python (pytest)

```bash
python -m pytest tests/ -v
```

## Linting & Formatting

### TypeScript/React

```bash
cd dashboard
npm run lint       # ESLint
npm run format     # Prettier (auto-fix)
npm run format:check  # Prettier (check only)
```

### Python

```bash
ruff check skills_tools/       # Lint
ruff check skills_tools/ --fix # Lint with auto-fix
ruff format skills_tools/      # Format
```

### Type Checking (Python)

```bash
mypy skills_tools/
```

## Pre-commit Hooks

Pre-commit hooks are configured via husky and lint-staged. They run automatically on `git commit`:

- TypeScript/TSX files: ESLint + Prettier
- Python files: Ruff check + format

## Code Standards

- **TypeScript**: ESLint flat config (`eslint.config.mjs`) with typescript-eslint
- **Python**: Ruff with rules E, F, W, I (isort), UP (pyupgrade); line length 100
- **Formatting**: Prettier for TS/JS, Ruff format for Python
- **Type checking**: mypy strict mode for Python
- **Editor**: `.editorconfig` at project root for consistent settings

## Building the Docker Image

```bash
docker build -t superlocalmemory-dashboard .
docker run --rm -p 3000:3000 -p 3002:3002 \
  -e SLM_MODE=b \
  -e OLLAMA_HOST=http://host.docker.internal:11434 \
  superlocalmemory-dashboard
```

## API Documentation

OpenAPI specification is at `dashboard/docs/openapi.yaml`.
