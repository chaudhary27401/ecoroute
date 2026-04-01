# EcoRoute Docker Setup Guide

> This guide explains how to containerize and deploy the EcoRoute delivery optimization system using Docker and Docker Compose.

## Contents

1. [Quick Start](#quick-start)
2. [Docker Architecture](#docker-architecture)
3. [File Descriptions](#file-descriptions)
4. [Common Commands](#common-commands)
5. [Production Deployment](#production-deployment)
6. [Troubleshooting](#troubleshooting)

---

## Quick Start

### Prerequisites
- Docker Engine 20.10+
- Docker Compose 2.0+
- 4GB RAM minimum

### Start All Services

```bash
# Navigate to project root
cd ecoroute

# Start all services (builds and runs in background)
docker-compose up -d

# View service status
docker-compose ps

# View logs
docker-compose logs -f

# Open in browser
# Frontend: http://localhost:5173
# Admin Dashboard: http://localhost:5173/ → Admin
```

### Stop All Services

```bash
docker-compose down              # Stop services
docker-compose down -v           # Stop and remove volumes (includes DB data)
```

---

## Docker Architecture

```
Docker Network: ecoroute
├── postgres:5432 (PostgreSQL 16)
│   ├── Auto-loads: core_schema.sql
│   ├── Auto-loads: relations.sql
│   └── Auto-loads: seed_data.sql
├── driver-service:5002 (FastAPI)
├── order-service:5001 (FastAPI)
├── optimizer:8000 (FastAPI)
└── frontend:5173 (React + Vite)
```

### Data Flow

1. **Browser** → Frontend (React)
2. **Frontend** → Order Service (5001) / Driver Service (5002)
3. **Order Service** → Optimizer (8000) for route optimization
4. **All Services** → PostgreSQL (5432)

---

## File Descriptions

### Docker Configuration Files Created

| File | Purpose |
|---|---|
| `docker-compose.yml` | Orchestrates all 5 containers, sets up networking, volumes, and environment |
| `services/driver-service/Dockerfile` | Python 3.10 + FastAPI for Driver Service |
| `services/order-service/Dockerfile` | Python 3.10 + FastAPI for Order Service |
| `optimizations/Dockerfile` | Python 3.10 + FastAPI for ML Optimizer |
| `frontend/Dockerfile` | Node 18 multi-stage build for React + Vite |
| `.env.example` | Environment variable template (copy to `.env`) |
| `.dockerignore` | Exclude unnecessary files from Docker builds |

### Key Features

✅ **Health checks** on all services  
✅ **Auto-database initialization** with SQL scripts  
✅ **Named volumes** for persistent database storage  
✅ **Internal DNS** for service-to-service communication  
✅ **Multi-stage build** for minimal frontend image  
✅ **Environment variable injection** via `.env`

---

## Common Commands

### Build & Start

```bash
# Build all images (don't run)
docker-compose build

# Build and start (attach logs)
docker-compose up

# Build and start (detached, run in background)
docker-compose up -d

# Rebuild specific service
docker-compose up -d --build order-service
```

### Logs & Debugging

```bash
# Follow logs from all services
docker-compose logs -f

# Follow logs from one service
docker-compose logs -f order-service

# View last 100 lines
docker-compose logs --tail=100

# View logs with timestamps
docker-compose logs -f -t
```

### Execute Commands Inside Containers

```bash
# Open a shell in the order-service container
docker-compose exec order-service bash

# Run a Python command
docker-compose exec order-service python -c "import sys; print(sys.version)"

# Connect to the database
docker-compose exec postgres psql -U postgres -d ecoroute

# View database schema
docker-compose exec postgres psql -U postgres -d ecoroute -c "\dt"
```

### Manage Volumes

```bash
# List all volumes
docker volume ls

# View volume details
docker volume inspect ecoroute_postgres_data

# Remove all unused volumes
docker volume prune

# Clean everything (images, volumes, networks)
docker system prune -a --volumes
```

---

## Production Deployment

### Before Deploying

1. **Set secure environment variables:**
   ```bash
   cp .env.example .env
   # Edit .env with production values
   ORS_API_KEY=your_production_key
   POSTGRES_PASSWORD=very_secure_password_here
   ```

2. **Use production-grade database:**
   ```yaml
   # Instead of postgres:16-alpine, use managed PostgreSQL
   # (AWS RDS, Google Cloud SQL, Azure Database, etc.)
   ```

3. **Configure external secrets manager:**
   - Use Docker Secrets (Swarm) or
   - Use docker-compose overrides with CI/CD pipeline

### Docker Compose for Production

Create `docker-compose.prod.yml`:

```yaml
version: '3.9'

services:
  driver-service:
    restart: always
    environment:
      DATABASE_URL: ${DATABASE_URL}
    deploy:
      resources:
        limits:
          cpus: '1'
          memory: 512M
        reservations:
          cpus: '0.5'
          memory: 256M

  # Similar for other services...
```

Start with:
```bash
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

---

## Troubleshooting

### Service Won't Start

```bash
# Check logs
docker-compose logs postgres
docker-compose logs order-service

# Inspect the image
docker image inspect ecoroute-order-service

# Rebuild from scratch
docker-compose down -v
docker system prune -a
docker-compose build --no-cache
docker-compose up -d
```

### Database Connection Error

```bash
# Verify PostgreSQL is running
docker-compose ps postgres

# Check database health
docker-compose exec postgres pg_isready

# View database logs
docker-compose logs postgres

# Reset database
docker-compose down -v postgres
docker-compose up -d postgres
```

### Port Already in Use

```bash
# Find process using port 5001
# Windows:
netstat -ano | findstr :5001

# macOS/Linux:
lsof -i :5001

# Change port in docker-compose.yml
# Or kill the process using the port
```

### Memory Issues

```bash
# Check Docker resource usage
docker stats

# Limit container memory
# Edit docker-compose.yml under deploy.resources.limits

# Free up space
docker system prune -a
```

### Service Dependency Issues

**Ensure proper startup order:**
```bash
# Services should start in order:
1. postgres (must be healthy first)
2. driver-service  (depends on postgres)
3. order-service   (depends on driver-service and postgres)
4. optimizer       (can start anytime)
5. frontend        (depends on order-service)
```

Check `docker-compose.yml` `depends_on` conditions.

---

## Updating Services

### Update Frontend

```bash
# Frontend code is in ./frontend/
# Edit source files
# Rebuild container
docker-compose up -d --build frontend

# Changes take effect immediately
```

### Update Backend Services

```bash
# Edit Python files (e.g., services/order-service/main.py)
# Rebuild the service
docker-compose up -d --build order-service

# Old container stops, new one starts with updated code
```

### Update Database Schema

```bash
# Edit database/core_schema.sql
# Restart database
docker-compose down -v postgres
docker-compose up -d

# New schema is auto-loaded in the container
```

---

## Network Isolation

All services run on a dedicated Docker network `ecoroute`:

- **Internal communication:** Use service names (e.g., `http://order-service:5001`)
- **External access:** Use `localhost` or your machine's IP

Example from inside container:
```python
# Inside order-service container:
requests.get("http://driver-service:5002")  # ← Works (internal DNS)
requests.get("http://localhost:5002")       # ← Fails (localhost inside container)
```

---

## Persisting Data

PostgreSQL data is stored in a named volume `ecoroute_postgres_data`:

```bash
# View volume
docker volume inspect ecoroute_postgres_data

# Backup before cleanup
docker run --rm -v ecoroute_postgres_data:/data -v $(pwd):/backup \
  alpine tar czf /backup/db-backup.tar.gz -C /data .

# Restore from backup
docker run --rm -v ecoroute_postgres_data:/data -v $(pwd):/backup \
  alpine tar xzf /backup/db-backup.tar.gz -C /data
```

---

## Next Steps

- Review [DOC.md](../docs/DOC.md) for full project documentation
- Check [README.md](../README.md) for contribution guidelines
- Explore the [architecture.md](../docs/architecture.md) for system design details
