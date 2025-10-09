# Docker Production Fixes

This document details the fixes applied to make the application work correctly in Docker production mode.

## Issues Fixed

### 1. Frontend Not Being Served (Static Files)
**Problem**: Backend wasn't configured to serve the built frontend files in production mode.

**Solution**: Added static file serving in `backend/server.js`:
```javascript
// Serve static frontend files in production (Docker)
if (process.env.NODE_ENV === 'production') {
  const frontendBuildPath = path.join(__dirname, '../frontend/build');
  
  if (fs.existsSync(frontendBuildPath)) {
    // Serve static files from the React build folder
    app.use(express.static(frontendBuildPath));
    
    // Handle React routing - return index.html for all non-API routes
    app.get('*', (req, res) => {
      res.sendFile(path.join(frontendBuildPath, 'index.html'));
    });
    
    logger.info('Serving static frontend from:', frontendBuildPath);
  }
}
```

### 2. WebSocket Connection Issues
**Problem**: WebSocket URL wasn't correctly determined for both development and production modes.

**Solution**: Enhanced URL detection in `frontend/src/App.js`:

**Development Mode (Port 4280)**:
- Frontend: `http://localhost:4280`
- Backend API: `http://localhost:8745`
- WebSocket: `ws://localhost:8745`

**Production Mode (Port 8745)**:
- Frontend: `http://localhost:8745` (static files)
- Backend API: `http://localhost:8745`
- WebSocket: `ws://localhost:8745`

```javascript
const getBackendUrl = () => {
  const protocol = window.location.protocol;
  const hostname = window.location.hostname;
  const port = window.location.port;
  
  if (port === '4280') {
    // Development: backend on 8745
    return `${protocol}//${hostname}:8745`;
  } else if (port === '8745' || !port || port === '80' || port === '443') {
    // Production: same port
    return `${protocol}//${hostname}${port && port !== '80' && port !== '443' ? ':' + port : ''}`;
  }
  
  return `${protocol}//${hostname}:8745`;
};

const getWebSocketUrl = () => {
  const hostname = window.location.hostname;
  const port = window.location.port;
  
  if (port === '4280') {
    // Development: WebSocket on backend port 8745
    return `ws://${hostname}:8745`;
  } else if (port === '8745' || !port) {
    // Production: WebSocket on same port
    const wsPort = port || '8745';
    return `ws://${hostname}:${wsPort}`;
  }
  
  return `ws://${hostname}:8745`;
};
```

### 3. Live Monitoring Not Working (Linux Ping)
**Problem**: Ping command uses different flags on Windows vs Linux:
- Windows: `ping -n 1 8.8.8.8`
- Linux/Mac: `ping -c 1 8.8.8.8`

**Solution**: Added platform detection in `backend/server.js`:
```javascript
async function performPing(host = '8.8.8.8') {
  try {
    // Detect OS for proper ping flags
    // Windows uses -n, Linux/Mac uses -c
    const isWindows = process.platform === 'win32';
    const pingArgs = isWindows ? ['-n', '1'] : ['-c', '1'];
    
    const res = await ping.promise.probe(host, {
      timeout: 10,
      min_reply: 1,
      extra: pingArgs
    });
    
    // ... rest of function
  } catch (error) {
    logger.error(`Ping error for ${host}:`, error.message);
    return -1;
  }
}
```

### 4. Dockerfile Syntax Error
**Problem**: Comment was concatenated to RUN command on the same line.

**Solution**: Fixed formatting in `Dockerfile`:
```dockerfile
# Before (ERROR)
RUN npm install --production# Copy frontend source

# After (CORRECT)
RUN npm install --production

# Copy frontend source
```

## Testing

### Development Mode
```bash
# Terminal 1 - Backend
cd backend
npm start

# Terminal 2 - Frontend
cd frontend
npm start
```
- Frontend: http://localhost:4280
- Backend: http://localhost:8745
- WebSocket: ws://localhost:8745

### Production Mode (Docker)
```bash
docker-compose build
docker-compose up -d
docker-compose logs -f
```
- Everything: http://localhost:8745
- WebSocket: ws://localhost:8745

## Verification

Check that these log messages appear:

### Backend Logs
```
✅ Server running on port 8745
✅ WebSocket server ready
✅ Serving static frontend from: /app/frontend/build
✅ Ping 8.8.8.8: alive=true, time=15
✅ Ping 1.1.1.1: alive=true, time=12
```

### Frontend Console (Browser)
```
✅ 🔌 Backend URL: http://localhost:8745
✅ 🔌 WebSocket URL: ws://localhost:8745
✅ WebSocket connected
✅ 📨 WebSocket message received: initial
✅ 📨 WebSocket message received: ping
```

## Architecture

### Development Architecture
```
┌─────────────────┐         ┌─────────────────┐
│   Frontend      │  Proxy  │    Backend      │
│   Port 4280     │────────>│    Port 8745    │
└─────────────────┘         └─────────────────┘
         │                           │
         └───── WebSocket ──────────┘
              ws://localhost:8745
```

### Production Architecture (Docker)
```
┌─────────────────────────────────────┐
│         Docker Container            │
│  ┌──────────────────────────────┐  │
│  │  Backend (Port 8745)         │  │
│  │  - Serves API                │  │
│  │  - Serves Static Frontend    │  │
│  │  - WebSocket Server          │  │
│  └──────────────────────────────┘  │
└─────────────────────────────────────┘
              │
     http://localhost:8745
     ws://localhost:8745
```

## Summary

All fixes ensure the application works seamlessly in both:
1. **Development mode**: Separate frontend (4280) and backend (8745) servers
2. **Production mode**: Single backend (8745) serving everything statically

The WebSocket connection, live monitoring, and all features now work correctly in Docker! 🐳✅
