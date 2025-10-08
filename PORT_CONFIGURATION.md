# Port Configuration Update

## Overview
Updated the Ezé-U Internet Monitor to use non-common ports to avoid conflicts with other applications and services.

## New Port Configuration

### Previous Ports (Common Ports)
- **Backend**: Port 5000 (commonly used by Flask, other Node.js apps)
- **Frontend**: Port 3000 (default React port)

### New Ports (Non-Common)
- **Backend**: Port **8745** ⭐
- **Frontend**: Port **4280** ⭐

These ports are chosen to minimize conflicts with commonly used services.

---

## Files Modified

### Backend Changes

#### 1. `backend/.env`
```properties
PORT=8745  # Changed from 5000
NODE_ENV=development
```

#### 2. `backend/server.js`
```javascript
const PORT = process.env.PORT || 8745;  // Changed from 5000
```

### Frontend Changes

#### 3. `frontend/src/App.js`
```javascript
const getBackendUrl = () => {
  const protocol = window.location.protocol;
  const hostname = window.location.hostname;
  // Backend is always on port 8745
  return `${protocol}//${hostname}:8745`;  // Changed from 5000
};
```

#### 4. `frontend/src/components/Dashboard.js`
```javascript
const getBackendUrl = () => {
  const protocol = window.location.protocol;
  const hostname = window.location.hostname;
  // Backend is always on port 8745
  return `${protocol}//${hostname}:8745`;  // Changed from 5000
};
```

#### 5. `frontend/src/components/Settings.js`
```javascript
const getBackendUrl = () => {
  const protocol = window.location.protocol;
  const hostname = window.location.hostname;
  return `${protocol}//${hostname}:8745`;  // Changed from 5000
};

// Test notification fetch
const response = await fetch('http://localhost:8745/api/test-notification', {
  // Changed from 5000
```

#### 6. `frontend/package.json`
```json
{
  "scripts": {
    "start": "set PORT=4280 && set NODE_OPTIONS=--no-deprecation && react-scripts start"
  },
  "proxy": "http://localhost:8745"  // Changed from 5000
}
```

### Docker Changes

#### 7. `docker-compose.yml`
```yaml
services:
  internet-monitor:
    ports:
      - "8745:8745"  # Changed from "5000:5000"
    environment:
      - PORT=8745  # Changed from 5000
```

---

## How to Use

### Local Development

#### Starting the Backend:
```powershell
cd backend
npm install
node server.js
```
✅ Backend will now start on: `http://localhost:8745`

#### Starting the Frontend:
```powershell
cd frontend
npm install
npm start
```
✅ Frontend will now start on: `http://localhost:4280`

### Using Docker

```powershell
docker-compose up --build
```
✅ Application will be accessible at: `http://localhost:8745`

---

## Access URLs

### Development Mode (both running separately):
- **Frontend**: http://localhost:4280
- **Backend API**: http://localhost:8745
- **WebSocket**: ws://localhost:8745

### Production/Docker Mode:
- **Application**: http://localhost:8745
- **WebSocket**: ws://localhost:8745

---

## Firewall Configuration

If you need to access the application from other devices on your network, ensure these ports are allowed:

### Windows Firewall (PowerShell - Run as Administrator):
```powershell
# Allow Backend port 8745
New-NetFirewallRule -DisplayName "Ezé-U Monitor Backend" -Direction Inbound -LocalPort 8745 -Protocol TCP -Action Allow

# Allow Frontend port 4280 (development only)
New-NetFirewallRule -DisplayName "Ezé-U Monitor Frontend" -Direction Inbound -LocalPort 4280 -Protocol TCP -Action Allow
```

### Linux (ufw):
```bash
sudo ufw allow 8745/tcp
sudo ufw allow 4280/tcp
```

---

## Network Access

### Local Network Access:
Replace `localhost` with your computer's IP address:
- Frontend: `http://192.168.1.XXX:4280`
- Backend: `http://192.168.1.XXX:8745`

### Find Your IP:
**Windows:**
```powershell
ipconfig | findstr IPv4
```

**Linux/Mac:**
```bash
ip addr show | grep inet
# or
ifconfig | grep inet
```

---

## Troubleshooting

### Port Already in Use

If you get an error that the port is already in use:

#### Check what's using the port:
**Windows:**
```powershell
# Check port 8745
netstat -ano | findstr :8745

# Check port 4280
netstat -ano | findstr :4280
```

**Linux/Mac:**
```bash
lsof -i :8745
lsof -i :4280
```

#### Kill the process:
**Windows:**
```powershell
# Replace <PID> with the process ID from netstat
taskkill /PID <PID> /F
```

**Linux/Mac:**
```bash
kill -9 <PID>
```

### Change Ports Again

If you need different ports, update these values:

1. `backend/.env` → `PORT=XXXX`
2. `backend/server.js` → `const PORT = process.env.PORT || XXXX;`
3. `frontend/package.json` → `"start": "set PORT=YYYY && ..."`
4. `frontend/package.json` → `"proxy": "http://localhost:XXXX"`
5. All `getBackendUrl()` functions → `return '${protocol}//${hostname}:XXXX';`
6. `docker-compose.yml` → `ports: ["XXXX:XXXX"]`

---

## Benefits of Non-Common Ports

✅ **Reduced Conflicts**: Avoids conflicts with:
- Port 3000: Create React App, Next.js, Gatsby, many dev servers
- Port 5000: Flask, .NET Core, macOS AirPlay, other Node.js apps

✅ **Security**: Less likely to be scanned by automated port scanners

✅ **Flexibility**: Can run multiple Node.js/React projects simultaneously

✅ **Professional**: Production apps shouldn't use default dev ports

---

## Testing

After making changes, verify everything works:

1. **Backend Test:**
   ```powershell
   cd backend
   node server.js
   ```
   Should see: `Server running on port 8745`

2. **Frontend Test:**
   ```powershell
   cd frontend
   npm start
   ```
   Should open browser at: `http://localhost:4280`

3. **API Test:**
   Open browser: `http://localhost:8745/api/settings`
   Should return JSON with settings

4. **WebSocket Test:**
   Open frontend, check browser console for WebSocket connection

---

## Rollback Instructions

To revert to the original ports (5000/3000):

1. Replace all instances of `8745` with `5000`
2. Remove `set PORT=4280 &&` from frontend package.json start script
3. Restart both backend and frontend

---

## Notes

- The frontend dev server (port 4280) is only used during development
- In production/Docker, only port 8745 is exposed (serves both API and static frontend)
- WebSocket connections automatically use the same port as HTTP
- CORS is configured to allow cross-origin requests during development

---

## Summary

| Component | Old Port | New Port | URL |
|-----------|----------|----------|-----|
| Backend | 5000 | **8745** | http://localhost:8745 |
| Frontend Dev | 3000 | **4280** | http://localhost:4280 |
| Docker | 5000 | **8745** | http://localhost:8745 |
| WebSocket | 5000 | **8745** | ws://localhost:8745 |

**Status**: ✅ All configurations updated and tested
**Impact**: Requires restarting both backend and frontend
**Breaking Changes**: Update any bookmarks or external references to use new ports
