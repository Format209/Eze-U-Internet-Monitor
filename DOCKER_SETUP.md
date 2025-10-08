# Docker Setup Guide for Internet Monitor

This guide explains how to run the Internet Monitoring Application in Docker containers with Ookla Speedtest CLI pre-installed.

## 📦 What's Included

- **Frontend**: React application (production build)
- **Backend**: Node.js/Express API server
- **Ookla CLI**: Official Speedtest CLI pre-installed
- **SQLite Database**: Persistent storage via Docker volumes
- **Networking**: Optimized for ICMP ping and speed tests

## 🚀 Quick Start

### Prerequisites
- Docker Desktop installed (Windows/Mac) or Docker Engine (Linux)
- Docker Compose (included with Docker Desktop)

### 1. Build and Start Container

```powershell
# Build the Docker image
docker-compose build

# Start the container
docker-compose up -d

# View logs
docker-compose logs -f
```

### 2. Access Application

Open your browser to: **http://localhost:8745**

### 3. Stop Container

```powershell
# Stop the container
docker-compose down

# Stop and remove volumes (WARNING: deletes database)
docker-compose down -v
```

## 🛠️ Docker Commands Reference

### Build & Run
```powershell
# Build without cache
docker-compose build --no-cache

# Start in foreground (see logs directly)
docker-compose up

# Start in background (detached mode)
docker-compose up -d

# Rebuild and restart
docker-compose up -d --build
```

### Container Management
```powershell
# View running containers
docker ps

# View all containers
docker ps -a

# Stop containers
docker-compose stop

# Start stopped containers
docker-compose start

# Restart containers
docker-compose restart

# Remove containers
docker-compose down
```

### Logs & Debugging
```powershell
# View logs
docker-compose logs

# Follow logs in real-time
docker-compose logs -f

# View last 100 lines
docker-compose logs --tail=100

# Execute command in running container
docker-compose exec internet-monitor sh

# Access container shell
docker-compose exec internet-monitor /bin/bash

# Check Speedtest CLI installation
docker-compose exec internet-monitor speedtest --version
```

### Database Management
```powershell
# Backup database
docker cp internet-monitor:/app/backend/monitoring.db ./backup-monitoring.db

# Restore database
docker cp ./backup-monitoring.db internet-monitor:/app/backend/monitoring.db

# View database location
docker-compose exec internet-monitor ls -la /app/backend/
```

## 📁 Volume Persistence

The database is persisted using Docker volumes:

```yaml
volumes:
  - ./backend/data:/app/backend/data           # Data directory
  - ./backend/monitoring.db:/app/backend/monitoring.db  # Database file
```

**What this means:**
- Your data survives container restarts
- Database file is accessible on your host machine at `backend/monitoring.db`
- You can backup by simply copying `backend/monitoring.db`

## 🌐 Network Configuration

### Default Mode (Bridge Network)
The container uses a bridge network with port mapping:
- Container Port 8745 → Host Port 8745

### Host Network Mode (Advanced)
For better ping/network access, uncomment in `docker-compose.yml`:
```yaml
network_mode: host
```

**Note:** Host mode gives direct network access but uses host's network stack.

## 🔧 Configuration

### Environment Variables

Edit `docker-compose.yml` to customize:

```yaml
environment:
  - NODE_ENV=production
  - PORT=5000
  - TZ=Africa/Johannesburg  # Your timezone
```

### Resource Limits

Adjust CPU and memory limits in `docker-compose.yml`:

```yaml
deploy:
  resources:
    limits:
      cpus: '2.0'        # Max 2 CPU cores
      memory: 1024M      # Max 1GB RAM
    reservations:
      cpus: '0.5'        # Min 0.5 CPU cores
      memory: 256M       # Min 256MB RAM
```

### Port Mapping

Change the host port in `docker-compose.yml`:

```yaml
ports:
  - "8080:8745"  # Access on http://localhost:8080
```

## 🏥 Health Checks

The container includes automatic health monitoring:

```dockerfile
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:8745/api/status || exit 1
```

**Check health status:**
```powershell
docker inspect --format='{{.State.Health.Status}}' internet-monitor
```

## 🐛 Troubleshooting

### Container Won't Start
```powershell
# Check logs
docker-compose logs

# Verify Docker is running
docker ps

# Check for port conflicts
netstat -ano | findstr :8745
```

### Speedtest Not Working
```powershell
# Verify CLI is installed
docker-compose exec internet-monitor speedtest --version

# Test manually
docker-compose exec internet-monitor speedtest --accept-license --accept-gdpr --format=json

# Check network connectivity
docker-compose exec internet-monitor ping -c 4 8.8.8.8
```

### Database Issues
```powershell
# Check database file permissions
docker-compose exec internet-monitor ls -la /app/backend/monitoring.db

# Check database location
docker-compose exec internet-monitor ls -la /app/backend/

# Verify SQLite installation
docker-compose exec internet-monitor npm list sqlite3
```

### Performance Issues
```powershell
# Check resource usage
docker stats internet-monitor

# Check container health
docker inspect internet-monitor | grep -A 10 Health
```

## 🔄 Updates & Maintenance

### Update Application
```powershell
# Pull latest code
git pull

# Rebuild container
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

### Backup Before Update
```powershell
# Backup database
docker cp internet-monitor:/app/backend/monitoring.db ./monitoring-backup-$(date +%Y%m%d).db

# Or use volume mount (database already on host)
cp ./backend/monitoring.db ./monitoring-backup-$(date +%Y%m%d).db
```

## 📊 Production Deployment

### Docker Swarm (Optional)
```powershell
# Initialize swarm
docker swarm init

# Deploy stack
docker stack deploy -c docker-compose.yml monitor

# View services
docker stack services monitor
```

### Docker with Reverse Proxy (Nginx)
```nginx
server {
    listen 80;
    server_name monitor.yourdomain.com;

    location / {
        proxy_pass http://localhost:8745;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## 🔐 Security Considerations

1. **Firewall Rules**: Ensure only necessary ports are exposed
2. **Network Isolation**: Use custom networks for multi-container setups
3. **Resource Limits**: Set appropriate CPU/memory limits
4. **Read-only Filesystem**: Consider making filesystem read-only except for data directory
5. **Non-root User**: Container runs as root by default (consider creating non-root user for production)

## 📈 Monitoring Container

### View Real-time Stats
```powershell
docker stats internet-monitor
```

### Export Logs
```powershell
docker-compose logs > monitor-logs-$(date +%Y%m%d).log
```

### Automated Backups (Windows Task Scheduler)
Create a backup script `backup.ps1`:
```powershell
$date = Get-Date -Format "yyyyMMdd-HHmmss"
docker cp internet-monitor:/app/backend/monitoring.db ".\backups\monitoring-$date.db"
```

## 🎯 Benefits of Docker Setup

✅ **Consistent Environment**: Same setup on any machine
✅ **Easy Deployment**: One command to run everything
✅ **Isolated Dependencies**: No conflicts with host system
✅ **Ookla CLI Pre-installed**: No manual installation needed
✅ **Persistent Data**: Database survives container restarts
✅ **Easy Updates**: Rebuild and redeploy quickly
✅ **Resource Control**: Set CPU and memory limits
✅ **Health Monitoring**: Automatic health checks
✅ **Portable**: Move to any Docker-enabled server

## 📚 Additional Resources

- [Docker Documentation](https://docs.docker.com/)
- [Docker Compose Reference](https://docs.docker.com/compose/compose-file/)
- [Ookla Speedtest CLI](https://www.speedtest.net/apps/cli)
- [Node.js Docker Best Practices](https://github.com/nodejs/docker-node/blob/main/docs/BestPractices.md)

---

**Need Help?** Check the logs first: `docker-compose logs -f`
