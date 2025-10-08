# Quick Start Guide - Updated Ports

## 🚀 Quick Start After Port Changes

The application now uses **non-common ports** to avoid conflicts:
- **Backend**: Port `8745` (was 5000)
- **Frontend**: Port `4280` (was 3000)

---

## Starting the Application

### Option 1: Development Mode (Separate Backend & Frontend)

#### Terminal 1 - Start Backend:
```powershell
cd backend
node server.js
```
✅ Backend running at: **http://localhost:8745**

#### Terminal 2 - Start Frontend:
```powershell
cd frontend
npm start
```
✅ Frontend running at: **http://localhost:4280**

Browser should automatically open to `http://localhost:4280`

---

### Option 2: Docker (Production Mode)

```powershell
docker-compose up --build
```
✅ Application running at: **http://localhost:8745**

---

## Access URLs

### Development Mode:
- **Frontend UI**: http://localhost:4280
- **Backend API**: http://localhost:8745/api/settings
- **WebSocket**: ws://localhost:8745

### Docker/Production:
- **Application**: http://localhost:8745
- **Backend API**: http://localhost:8745/api/settings
- **WebSocket**: ws://localhost:8745

---

## First Time Setup

### 1. Install Dependencies

```powershell
# Install all dependencies
npm run install-all

# OR install separately:
npm install           # Root dependencies
cd backend && npm install
cd ../frontend && npm install
```

### 2. Start Backend
```powershell
cd backend
node server.js
```
Wait for: `✅ Server running on port 8745`

### 3. Start Frontend (New Terminal)
```powershell
cd frontend
npm start
```
Wait for: `Compiled successfully!` and browser opens

---

## Verify Everything Works

### 1. Check Backend API:
Open in browser: http://localhost:8745/api/settings

Should see JSON response like:
```json
{
  "testInterval": 30,
  "monitorInterval": 5,
  "pingHost": "8.8.8.8",
  ...
}
```

### 2. Check Frontend:
Browser should open automatically to: http://localhost:4280

You should see the dashboard with:
- "Start Monitoring" button
- "Run Speed Test" button
- Settings/Reports tabs

### 3. Check WebSocket:
1. Open browser console (F12)
2. Click "Start Monitoring"
3. Look for: `WebSocket client connected`

---

## Troubleshooting

### Port Already in Use

**Error**: `Error: listen EADDRINUSE: address already in use :::8745`

**Solution 1 - Find and kill the process:**
```powershell
# Find what's using port 8745
netstat -ano | findstr :8745

# Kill the process (replace <PID> with the number from above)
taskkill /PID <PID> /F
```

**Solution 2 - Use different port:**
Edit `backend/.env`:
```properties
PORT=9000
```

---

### Frontend Won't Start

**Error**: `Something is already running on port 4280`

**Solution 1 - Kill the process:**
```powershell
netstat -ano | findstr :4280
taskkill /PID <PID> /F
```

**Solution 2 - Use different port:**
Edit `frontend/package.json`:
```json
"start": "set PORT=4500 && set NODE_OPTIONS=--no-deprecation && react-scripts start"
```

---

### Can't Connect to Backend

**Symptom**: Frontend loads but no data appears

**Solutions:**
1. Check backend is running: http://localhost:8745/api/settings
2. Check frontend is pointing to correct port (should be 8745)
3. Check browser console for errors (F12)
4. Restart both backend and frontend

---

## Common Commands

### Start Both (Root Directory)
```powershell
# Terminal 1
npm run server

# Terminal 2
npm run client
```

### Or use concurrently:
```powershell
npm run dev
```

### Build for Production:
```powershell
cd frontend
npm run build
```

### Docker:
```powershell
# Start
docker-compose up -d

# View logs
docker-compose logs -f

# Stop
docker-compose down

# Rebuild
docker-compose up --build
```

---

## Network Access (Other Devices)

To access from other devices on your network:

1. **Find your IP address:**
   ```powershell
   ipconfig | findstr IPv4
   ```
   Example result: `192.168.1.100`

2. **Open firewall ports:**
   ```powershell
   # Run as Administrator
   New-NetFirewallRule -DisplayName "Ezé-U Monitor Backend" -Direction Inbound -LocalPort 8745 -Protocol TCP -Action Allow
   New-NetFirewallRule -DisplayName "Ezé-U Monitor Frontend" -Direction Inbound -LocalPort 4280 -Protocol TCP -Action Allow
   ```

3. **Access from other device:**
   - Frontend: `http://192.168.1.100:4280`
   - Backend: `http://192.168.1.100:8745`

---

## Status Indicators

### Backend Running Successfully:
```
2025-10-08 14:30:45.123 [SUCCESS] - Server running on port 8745
2025-10-08 14:30:45.125 [INFO   ] - Database path: E:\Coding\...
2025-10-08 14:30:45.130 [SUCCESS] - Database loaded successfully
```

### Frontend Running Successfully:
```
Compiled successfully!

You can now view eze-u-internet-monitor-frontend in the browser.

  Local:            http://localhost:4280
  On Your Network:  http://192.168.1.100:4280
```

---

## Need Help?

Check the documentation:
- `README.md` - General overview
- `PORT_CONFIGURATION.md` - Detailed port configuration
- `QUICKSTART.md` - This guide
- `DOCKER_SETUP.md` - Docker instructions

---

## Summary

| Component | Port | URL |
|-----------|------|-----|
| Backend API | 8745 | http://localhost:8745 |
| Frontend Dev | 4280 | http://localhost:4280 |
| WebSocket | 8745 | ws://localhost:8745 |
| Docker | 8745 | http://localhost:8745 |

**Remember**: When you run `npm start` in frontend, it will automatically open `http://localhost:4280` in your browser!
