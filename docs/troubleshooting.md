# Troubleshooting Guide

## Ollama Connection Failures

**Symptom**: Dashboard shows `ollama: disconnected` or `degraded` status.

**Solutions**:
1. Verify Ollama is running: `curl http://localhost:11434/api/tags`
2. Check `OLLAMA_HOST` environment variable — inside Docker, use `http://host.docker.internal:11434` (macOS/Windows) or `http://172.17.0.1:11434` (Linux)
3. In Docker Compose, use the service name: `http://ollama:11434`
4. Verify network connectivity between containers: `docker exec <container> curl http://ollama:11434/api/tags`

## Missing memory.db

**Symptom**: Dashboard shows `database: missing`.

**Solutions**:
1. Verify `SLM_DATA_DIR` points to a mounted volume: `docker inspect <container> | grep Mounts`
2. Check volume permissions — the container runs as `node` (UID 1000): `ls -la /data/.superlocalmemory/`
3. If the database was never created, restart the container — `entrypoint.sh` will initialize it
4. Verify disk space: `df -h /data`

## Dashboard Not Displaying

**Symptom**: Cannot access `http://localhost:3002/dashboard`.

**Solutions**:
1. Verify port 3002 is exposed: `docker ps` should show `0.0.0.0:3002->3002/tcp`
2. Check container logs: `docker logs <container>`
3. Verify the dashboard process started: look for `Starting dashboard on port 3002` in logs
4. Try the health endpoint directly: `curl http://localhost:3002/dashboard/api/healthz`

## Abnormal Disk Usage

**Symptom**: `diskUsage` shows unexpectedly large values.

**Solutions**:
1. Inspect the data directory: `docker exec <container> du -sh /data/.superlocalmemory/*`
2. Check if old backups are accumulating in the skill versions directory
3. Verify memory.db size: `docker exec <container> ls -lh /data/.superlocalmemory/memory.db`

## Container Startup Failures

**Symptom**: Container exits immediately or keeps restarting.

**Solutions**:
1. Check logs for timestamped startup messages: `docker logs <container>`
2. Look for `FATAL` messages — these indicate non-recoverable errors
3. Common causes:
   - Volume mount permissions (must be writable by UID 1000)
   - Invalid `SLM_MODE` value (must be `b` for Ollama mode)
   - Insufficient disk space for database creation
4. Verify environment variables: `docker exec <container> env | grep SLM`

## Slow Health Check Responses

**Symptom**: `/api/health` takes several seconds to respond.

**Solutions**:
1. Disk usage is cached for 60 seconds (configurable via `HEALTH_CACHE_TTL`)
2. Ollama check has a 3-second timeout — slow Ollama responses will delay health checks
3. Use `/api/healthz` for lightweight liveness checks instead
