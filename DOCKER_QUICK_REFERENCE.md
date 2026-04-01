# Docker Quick Reference

## 🚀 Getting Started (60 seconds)

```bash
# 1. Start everything
docker-compose up -d

# 2. Wait for database (check status)
docker-compose ps

# 3. Open in browser
# http://localhost:5173
```

## 📋 Most Common Commands

| Command | What it does |
|---------|------------|
| `docker-compose up -d` | Start all services in background |
| `docker-compose down` | Stop all services |
| `docker-compose logs -f` | Follow live logs from all services |
| `docker-compose ps` | Show service status |
| `docker-compose restart [service]` | Restart a service |
| `docker-compose exec [service] bash` | Open shell in a service |

## 🔧 Troubleshooting

### Services not starting?
```bash
docker-compose logs [service-name]
# Example: docker-compose logs postgres
```

### Can't connect to API from frontend?
```bash
# Check if order-service is running
docker-compose ps order-service

# View its logs
docker-compose logs order-service
```

### Database lost/corrupted?
```bash
# Reset database (WARNING: DELETES DATA)
docker-compose down -v
docker-compose up -d
```

### Port already in use?
```bash
# Change port in docker-compose.yml
# From:  ports: - "5001:5001"
# To:    ports: - "5003:5001"  # Use different external port
```

## 📊 Monitoring

```bash
# Show resource usage
docker stats

# Show container logs with timestamps
docker-compose logs -t

# Show last N lines of logs
docker-compose logs -n 50

# Live follow specific service
docker-compose logs -f order-service
```

## 🗄️ Database

```bash
# Connect to PostgreSQL
docker-compose exec postgres psql -U postgres -d ecoroute

# Show all tables
docker-compose exec postgres psql -U postgres -d ecoroute -c "\dt"

# Backup database
docker-compose exec postgres pg_dump -U postgres ecoroute > backup.sql

# Restore database
docker-compose exec -T postgres psql -U postgres ecoroute < backup.sql
```

## 🏗️ Building & Rebuilding

```bash
# Rebuild all services
docker-compose build

# Rebuild specific service (after code changes)
docker-compose build order-service

# Rebuild and restart
docker-compose up -d --build order-service
```

## 🧹 Cleanup

```bash
# Stop containers but keep volumes
docker-compose down

# Stop containers and remove database data
docker-compose down -v

# Remove ALL Docker stuff (images, volumes, networks)
docker system prune -a --volumes

# Remove just unused images
docker image prune -a
```

## 🔍 Debugging Inside Containers

```bash
# Check if service is responding
docker-compose exec order-service curl http://localhost:5001

# Run Python command in container
docker-compose exec order-service python -c "print('Hello')"

# Check environment variables
docker-compose exec order-service env

# View service startup logs
docker-compose logs -f --tail=100 order-service
```

## 📈 Performance

```bash
# See container memory/CPU usage
docker stats --no-stream

# Check disk usage
docker system df

# Limit container resources (edit docker-compose.yml)
# deploy:
#   resources:
#     limits:
#       cpus: '1'
#       memory: 512M
```

## 🔐 Production Notes

- Use `.env` file with secure credentials
- Don't commit `.env` to git
- Use managed database (AWS RDS, etc.) for production
- Set resources limits for each service
- Monitor logs and metrics
- Auto-restart containers with `restart: unless-stopped`

---

**Need more help?** See [DOCKER.md](DOCKER.md) or [DOC.md](docs/DOC.md#docker-deployment--troubleshooting)
