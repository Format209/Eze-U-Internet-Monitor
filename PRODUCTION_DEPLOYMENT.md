# Production Deployment Guide

This guide covers different ways to run the Ezé-U Internet Monitor in production.

## 🚀 Deployment Options

### Option 1: Docker (Recommended)
Best for: Easy deployment, consistency, isolation

### Option 2: npm start (Built Frontend)
Best for: Simple setups, direct control, no Docker

### Option 3: npm start (Separate Frontend)
Best for: Development, debugging, making changes

---

## Option 1: Docker Deployment

### Prerequisites
- Docker and Docker Compose installed
- Ookla Speedtest CLI (installed automatically in container)

### Steps

1. **Build and Start**
   ```bash
   docker-compose build
   docker-compose up -d
   ```

2. **Check Logs**
   ```bash
   docker-compose logs -f
   ```

3. **Access Application**
   - URL: http://localhost:8745
   - Everything runs on port 8745

4. **Stop/Restart**
   ```bash
   docker-compose down
   docker-compose restart
   ```

### Docker Environment
- **Image**: Node 18 Alpine Linux
- **Ports**: 8745 (frontend + backend + WebSocket)
- **Database**: Persisted in `/app/backend/data/monitoring.db`
- **Auto-start**: Monitoring starts automatically
- **Health Check**: Built-in health monitoring

---

## Option 2: npm start (Built Frontend)

Perfect for running in production without Docker.

### Prerequisites
- Node.js 14 or higher
- Ookla Speedtest CLI installed ([setup guide](OOKLA_CLI_SETUP.md))

### Steps

1. **Install Dependencies**
   ```bash
   # Backend
   cd backend
   npm install
   cd ..

   # Frontend
   cd frontend
   npm install
   cd ..
   ```

2. **Build Frontend**
   ```bash
   cd frontend
   npm run build
   cd ..
   ```

3. **Configure Backend**
   
   Edit `backend/.env`:
   ```env
   PORT=8745
   NODE_ENV=production
   ```

4. **Start Backend (Serves Everything)**
   ```bash
   cd backend
   npm start
   ```

5. **Access Application**
   - URL: http://localhost:8745
   - Backend automatically serves the built frontend

### How It Works
- Backend detects `frontend/build` folder exists
- Serves static files from build folder
- All API routes still work
- WebSocket on same port
- Single process for everything

### Keep It Running

**Windows (PowerShell as Admin)**
```powershell
# Install PM2 globally
npm install -g pm2

# Start with PM2
cd backend
pm2 start server.js --name "internet-monitor"

# View logs
pm2 logs internet-monitor

# Auto-start on boot
pm2 startup
pm2 save
```

**Linux (systemd)**

Create `/etc/systemd/system/internet-monitor.service`:
```ini
[Unit]
Description=Ezé-U Internet Monitor
After=network.target

[Service]
Type=simple
User=YOUR_USERNAME
WorkingDirectory=/path/to/Ez--U-Internet-Monitor/backend
ExecStart=/usr/bin/node server.js
Restart=on-failure
Environment=NODE_ENV=production
Environment=PORT=8745

[Install]
WantedBy=multi-user.target
```

Enable and start:
```bash
sudo systemctl daemon-reload
sudo systemctl enable internet-monitor
sudo systemctl start internet-monitor
sudo systemctl status internet-monitor
```

---

## Option 3: npm start (Separate Frontend)

Best for development or when you want to make real-time changes.

### Steps

1. **Install Dependencies** (same as Option 2)

2. **Configure Backend**
   
   Edit `backend/.env`:
   ```env
   PORT=8745
   NODE_ENV=development
   ```

3. **Start Backend**
   ```bash
   cd backend
   npm start
   ```

4. **Start Frontend (Separate Terminal)**
   ```bash
   cd frontend
   npm start
   ```

5. **Access Application**
   - Frontend: http://localhost:4280
   - Backend: http://localhost:8745
   - WebSocket: ws://localhost:8745

### How It Works
- Frontend runs on port 4280 with hot reload
- Backend runs on port 8745
- Frontend proxies API requests to backend
- WebSocket connects directly to backend
- Any frontend changes reload automatically

---

## 🔧 Configuration

### Environment Variables

**backend/.env**
```env
# Backend server port
PORT=8745

# Environment mode
NODE_ENV=production  # or development
```

### Ports

| Mode | Frontend | Backend | WebSocket | Access URL |
|------|----------|---------|-----------|------------|
| Docker | 8745 (static) | 8745 | 8745 | http://localhost:8745 |
| Built Frontend | 8745 (static) | 8745 | 8745 | http://localhost:8745 |
| Separate Frontend | 4280 (live) | 8745 | 8745 | http://localhost:4280 |

### Firewall Rules

If accessing from other devices on your network:

**Windows Firewall**
```powershell
New-NetFirewallRule -DisplayName "Internet Monitor" -Direction Inbound -Protocol TCP -LocalPort 8745 -Action Allow
```

**Linux (ufw)**
```bash
sudo ufw allow 8745/tcp
```

---

## 🔍 Verification

### Check Backend Logs

Look for these messages:

**With Built Frontend:**
```
✅ Server running on port 8745
✅ WebSocket server ready
✅ Serving static frontend from: /path/to/frontend/build
✅ Access application at: http://localhost:8745
```

**Without Built Frontend (API-only):**
```
✅ Server running on port 8745
✅ WebSocket server ready
ℹ Frontend build folder not found
ℹ Running in API-only mode (frontend should run separately on port 4280)
```

### Health Check

Test the API:
```bash
curl http://localhost:8745/api/status
```

Should return:
```json
{
  "isMonitoring": true,
  "history": [...],
  "settings": {...},
  "liveMonitoring": {...}
}
```

---

## 🐛 Troubleshooting

### "Frontend not loading"

**If using built frontend:**
1. Check `frontend/build` folder exists
2. Rebuild frontend: `cd frontend && npm run build`
3. Restart backend: `cd backend && npm start`

**If using separate frontend:**
1. Check both terminals are running
2. Frontend should be on port 4280
3. Backend should be on port 8745

### "WebSocket not connecting"

**Check browser console:**
- Should see: `WebSocket connected`
- URL should match: `ws://localhost:8745` or `ws://localhost:4280`

**Check backend logs:**
- Should see: `WebSocket server ready`

### "Live monitoring shows -1ms"

**Linux/Docker:**
- Ping command should use `-c` flag (fixed automatically)

**Windows:**
- Ping command should use `-n` flag (fixed automatically)

**Check logs:**
```
Ping 8.8.8.8: alive=true, time=15
```

If `alive=false`, check network connectivity.

---

## 📊 Performance

### Resource Usage

| Mode | Memory | CPU | Disk |
|------|--------|-----|------|
| Docker | ~150MB | Low | ~200MB |
| npm (built) | ~100MB | Low | ~150MB |
| npm (separate) | ~150MB | Medium | ~150MB |

### Database

- **Location**: `backend/monitoring.db` or `backend/data/monitoring.db` (Docker)
- **Size**: Grows ~1MB per 1000 speed tests
- **Cleanup**: Live monitoring history auto-cleaned after 7 days

---

## 🔄 Updates

### Update Application

**Docker:**
```bash
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

**npm:**
```bash
git pull
cd backend && npm install && cd ..
cd frontend && npm install && npm run build && cd ..
cd backend && npm start
```

### Update Speedtest CLI

**Docker:** Rebuild image

**npm:**
- Windows: Download from [Speedtest.net](https://www.speedtest.net/apps/cli)
- Linux: `sudo apt update && sudo apt upgrade speedtest`

---

## 🔐 Security

### Best Practices

1. **Don't expose to internet** without proper security
2. **Use reverse proxy** (nginx/Apache) for HTTPS
3. **Keep Node.js updated**: `node -v` should be 14+
4. **Regular updates**: `npm audit fix`
5. **Secure notification tokens** in `.env` file

### Example nginx Config

```nginx
server {
    listen 80;
    server_name monitor.example.com;

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

---

## 📝 Summary

Choose your deployment method:

✅ **Docker** - Easiest, most consistent  
✅ **npm + built frontend** - Simple production without Docker  
✅ **npm + separate frontend** - Best for development  

All methods support the same features - pick what works best for your setup!
