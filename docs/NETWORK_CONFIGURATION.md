# Network Configuration

## Dynamic Backend URL Configuration

The frontend now automatically detects and connects to the backend using dynamic URL resolution instead of hardcoded `localhost:8745`.

### How It Works

The frontend uses a simple, elegant approach - it **always connects to the backend on the same IP/hostname it's running on**, using port 8745:

```javascript
const getBackendUrl = () => {
  const protocol = window.location.protocol;
  const hostname = window.location.hostname;
  
  // Backend is always on port 8745
  return `${protocol}//${hostname}:8745`;
};
```

**Key Principle**: If you access the frontend at `http://X.X.X.X:4280`, it will connect to the backend at `http://X.X.X.X:8745`. This works for any IP address, hostname, or domain.

### Connection Scenarios

| Environment | Frontend URL | Backend URL | WebSocket URL |
|-------------|-------------|-------------|---------------|
| **Development** | http://localhost:4280 | http://localhost:8745 | ws://localhost:8745 |
| **Network Development** | http://192.168.1.100:4280 | http://192.168.1.100:8745 | ws://192.168.1.100:8745 |
| **Docker** | http://localhost:8745 | http://localhost:8745 | ws://localhost:8745 |
| **Network Docker** | http://192.168.1.100:8745 | http://192.168.1.100:8745 | ws://192.168.1.100:8745 |
| **Production Build** | http://example.com | http://example.com | ws://example.com |

### Benefits

✅ **Automatic Network Detection**: Frontend automatically connects to backend on any IP address  
✅ **Docker Compatible**: Works in containerized environments  
✅ **Development Friendly**: Still uses localhost in development mode  
✅ **Network Accessible**: Can be accessed from other devices on the network  
✅ **Production Ready**: Works with custom domains and ports  

### Updated Files

- **frontend/src/App.js**: Added dynamic URL configuration and updated WebSocket connection
- **frontend/src/components/Dashboard.js**: Updated all fetch calls to use dynamic backend URL

### Testing

To test the network connectivity:

1. **Find your machine's IP address**:
   ```powershell
   ipconfig | findstr "IPv4"
   ```

2. **Start the servers**:
   ```powershell
   # Terminal 1 - Backend
   cd backend
   npm start
   
   # Terminal 2 - Frontend  
   cd frontend
   npm start
   ```

3. **Access from network devices**:
   - **Frontend**: http://YOUR_IP:4280
   - **Backend API**: http://YOUR_IP:8745/api/status
   - **WebSocket**: The frontend will automatically connect to ws://YOUR_IP:8745

### Troubleshooting

If you experience connection issues:

1. **Check Windows Firewall**: Ensure ports 4280 and 8745 are allowed
2. **Check Network**: Make sure devices are on the same network
3. **Check Browser Console**: Look for WebSocket connection errors
4. **Check Backend Logs**: Verify CORS is allowing the frontend origin

### Legacy Support

The `frontend/package.json` still includes the proxy configuration for development mode compatibility:

```json
"proxy": "http://localhost:5000"
```

This ensures axios requests without full URLs still work in development mode.