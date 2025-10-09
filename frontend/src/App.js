import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import Dashboard from './components/Dashboard';
import Settings from './components/Settings';
import './App.css';

// Dynamic backend URL configuration
// Frontend connects to backend on the same IP/hostname it's running on
const getBackendUrl = () => {
  const protocol = window.location.protocol;
  const hostname = window.location.hostname;
  const port = window.location.port;
  
  // Detect if we're in development mode (frontend on port 4280)
  // or production mode (static serving on port 8745)
  if (port === '4280') {
    // Development mode: frontend on 4280, backend on 8745
    return `${protocol}//${hostname}:8745`;
  } else if (port === '8745' || !port || port === '80' || port === '443') {
    // Production mode: both on same port (8745 or default HTTP/HTTPS ports)
    return `${protocol}//${hostname}${port && port !== '80' && port !== '443' ? ':' + port : ''}`;
  }
  
  // Fallback: assume backend is on port 8745
  return `${protocol}//${hostname}:8745`;
};

const getWebSocketUrl = () => {
  const hostname = window.location.hostname;
  const port = window.location.port;
  
  // Detect if we're in development mode (frontend on port 4280)
  // or production mode (static serving on port 8745)
  if (port === '4280') {
    // Development mode: WebSocket connects to backend on 8745
    return `ws://${hostname}:8745`;
  } else if (port === '8745' || !port) {
    // Production mode: WebSocket on same port as frontend
    const wsPort = port || '8745';
    return `ws://${hostname}:${wsPort}`;
  }
  
  // Fallback: assume WebSocket is on port 8745
  return `ws://${hostname}:8745`;
};

const BACKEND_URL = getBackendUrl();
const WS_URL = getWebSocketUrl();

function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [currentSpeed, setCurrentSpeed] = useState({ download: 0, upload: 0, ping: 0 });
  const [history, setHistory] = useState([]);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [liveMonitoring, setLiveMonitoring] = useState({});
  const [settings, setSettings] = useState({
    testInterval: 30,
    monitorInterval: 5,
    pingHost: '8.8.8.8',
    monitoringHosts: [
      { address: '8.8.8.8', name: 'Google DNS', enabled: true },
      { address: '1.1.1.1', name: 'Cloudflare DNS', enabled: true },
      { address: '208.67.222.222', name: 'OpenDNS', enabled: false }
    ],
    autoStart: false,
    notifications: true,
    thresholds: {
      minDownload: 50,
      minUpload: 10,
      maxPing: 100
    }
  });
  const [ws, setWs] = useState(null);
  const [isConnected, setIsConnected] = useState(false);

  // Fetch history function (defined early so it can be used in WebSocket)
  const fetchHistory = useCallback(async () => {
    try {
      const response = await axios.get('/api/history?limit=100');
      setHistory(response.data);
    } catch (error) {
      console.error('Error fetching history:', error);
    }
  }, []);

  // Handle notifications from backend
  const handleNotification = useCallback((eventType, data) => {
    console.log('🔔 Notification received:', eventType, data);
    console.log('   Settings:', {
      notificationsEnabled: settings?.notificationSettings?.enabled,
      browserEnabled: settings?.notificationSettings?.types?.browser?.enabled,
      soundEnabled: settings?.notificationSettings?.types?.browser?.sound,
      permission: typeof Notification !== 'undefined' ? Notification.permission : 'not supported'
    });
    
    // Check if browser notifications are enabled in settings
    if (!settings?.notificationSettings?.enabled) {
      console.log('   ❌ Notifications disabled in settings');
      return;
    }
    if (!settings?.notificationSettings?.types?.browser?.enabled) {
      console.log('   ❌ Browser notifications disabled in settings');
      return;
    }
    
    // Build notification content based on event type
    let title = '';
    let body = '';
    let icon = '/favicon.svg';
    
    switch (eventType) {
      case 'onSpeedTestComplete':
        title = 'Speed Test Complete';
        body = `Download: ${data.download} Mbps | Upload: ${data.upload} Mbps | Ping: ${data.ping} ms`;
        break;
      
      case 'onThresholdBreach':
        title = '⚠️ Speed Threshold Breach';
        body = data.breaches.join('\n');
        break;
      
      case 'onHostDown':
        title = '🔴 Host Down';
        body = `${data.host} (${data.address}) is unreachable`;
        break;
      
      case 'onHostUp':
        title = '🟢 Host Recovered';
        body = `${data.host} (${data.address}) is back online - ${data.ping}ms`;
        break;
      
      case 'onConnectionLost':
        title = '🔴 Connection Lost';
        body = 'All monitored hosts are unreachable';
        break;
      
      case 'onConnectionRestored':
        title = '🟢 Connection Restored';
        body = 'Internet connection has been restored';
        break;
      
      case 'onHighLatency':
        title = '⚠️ High Latency Detected';
        body = `${data.host}: ${data.ping}ms (threshold: ${data.threshold}ms)`;
        break;
      
      case 'onPacketLoss':
        title = '⚠️ Packet Loss Detected';
        body = `${data.host}: ${data.packetLoss}% packet loss`;
        break;
      
      default:
        return;
    }
    
    console.log('   📢 Attempting to show notification:', { title, body });
    
    // Show browser notification
    if ('Notification' in window && Notification.permission === 'granted') {
      console.log('   ✅ Showing browser notification');
      const notification = new Notification(title, {
        body: body,
        icon: icon,
        badge: icon,
        tag: eventType,
        requireInteraction: false
      });
      
      // Play sound if enabled
      if (settings?.notificationSettings?.types?.browser?.sound) {
        try {
          const audio = new Audio('/notification.mp3');
          audio.play().catch(err => console.log('Could not play notification sound:', err));
        } catch (err) {
          console.log('Notification sound not available');
        }
      }
      
      // Auto-close after 5 seconds
      setTimeout(() => notification.close(), 5000);
    } else if ('Notification' in window && Notification.permission === 'default') {
      console.log('   ⚠️  Notification permission not granted, requesting...');
      // Request permission if not yet granted
      Notification.requestPermission().then(permission => {
        if (permission === 'granted') {
          console.log('   ✅ Permission granted, showing notification');
          handleNotification(eventType, data);
        } else {
          console.log('   ❌ Permission denied');
        }
      });
    } else if ('Notification' in window && Notification.permission === 'denied') {
      console.log('   ❌ Browser notifications are blocked. Enable in browser settings.');
    } else {
      console.log('   ❌ Browser does not support notifications');
    }
  }, [settings]);

  // WebSocket connection
  useEffect(() => {
    console.log('🔌 Initializing WebSocket connection...');
    console.log('   Backend URL:', BACKEND_URL);
    console.log('   WebSocket URL:', WS_URL);
    
    const connectWebSocket = () => {
      console.log('🔌 Connecting to WebSocket:', WS_URL);
      const websocket = new WebSocket(WS_URL);

      websocket.onopen = () => {
        console.log('WebSocket connected');
        setIsConnected(true);
      };

      websocket.onmessage = (event) => {
        const message = JSON.parse(event.data);
        console.log(`📨 WebSocket message received:`, message.type, message);
        
        // Phase 2: Handle batched messages
        if (message.type === 'batch') {
          console.log(`📦 Processing ${message.count} batched messages`);
          message.messages.forEach(msg => {
            handleWebSocketMessage(msg);
          });
          return;
        }
        
        handleWebSocketMessage(message);
      };

      const handleWebSocketMessage = (message) => {
        switch (message.type) {
          case 'initial':
            setCurrentSpeed(message.data.currentSpeed);
            setHistory(message.data.history);
            setIsMonitoring(message.data.isMonitoring);
            setSettings(message.data.settings);
            setLiveMonitoring(message.data.liveMonitoring || {});
            break;
          case 'speedtest':
            setCurrentSpeed({
              download: message.data.download,
              upload: message.data.upload,
              ping: message.data.ping
            });
            break;
          case 'history':
            // Directly update history from broadcast (fixes cache timing issue)
            setHistory(message.data);
            break;
          case 'ping':
            setCurrentSpeed(prev => ({ ...prev, ping: message.data.ping }));
            break;
          case 'liveMonitoring':
            setLiveMonitoring(message.data);
            break;
          case 'status':
            setIsMonitoring(message.isMonitoring);
            break;
          case 'settings':
            setSettings(message.data);
            break;
          case 'historyCleared':
            setHistory([]);
            break;
          case 'notification':
            handleNotification(message.event, message.data);
            break;
          default:
            break;
        }
      };
      // End of handleWebSocketMessage

      websocket.onclose = () => {
        console.log('WebSocket disconnected');
        setIsConnected(false);
        // Reconnect after 3 seconds
        setTimeout(connectWebSocket, 3000);
      };

      websocket.onerror = (error) => {
        console.error('WebSocket error:', error);
      };

      setWs(websocket);
    };

    connectWebSocket();

    return () => {
      if (ws) {
        ws.close();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchHistory]);

  // Fetch initial data
  useEffect(() => {
    fetchStatus();
    fetchHistory();
    fetchSettings();
  }, [fetchHistory]);

  const fetchStatus = async () => {
    try {
      const response = await axios.get('/api/status');
      setIsMonitoring(response.data.isMonitoring);
      setCurrentSpeed(response.data.currentSpeed);
      if (response.data.liveMonitoring) {
        setLiveMonitoring(response.data.liveMonitoring);
      }
    } catch (error) {
      console.error('Error fetching status:', error);
    }
  };

  const fetchSettings = async () => {
    try {
      const response = await axios.get('/api/settings');
      const fetchedSettings = response.data;
      // Ensure monitoringHosts exists
      if (!fetchedSettings.monitoringHosts) {
        fetchedSettings.monitoringHosts = [
          { address: '8.8.8.8', name: 'Google DNS', enabled: true },
          { address: '1.1.1.1', name: 'Cloudflare DNS', enabled: true },
          { address: '208.67.222.222', name: 'OpenDNS', enabled: false }
        ];
      }
      setSettings(fetchedSettings);
    } catch (error) {
      console.error('Error fetching settings:', error);
    }
  };

  const runSpeedTest = async () => {
    try {
      await axios.post('/api/test');
    } catch (error) {
      console.error('Error running speed test:', error);
    }
  };

  const toggleMonitoring = async () => {
    try {
      if (isMonitoring) {
        await axios.post('/api/monitor/stop');
      } else {
        await axios.post('/api/monitor/start');
      }
    } catch (error) {
      console.error('Error toggling monitoring:', error);
    }
  };

  const updateSettings = async (newSettings) => {
    try {
      const response = await axios.post('/api/settings', newSettings);
      setSettings(response.data);
    } catch (error) {
      console.error('Error updating settings:', error);
    }
  };

  const clearHistory = async () => {
    try {
      await axios.delete('/api/history');
      setHistory([]);
    } catch (error) {
      console.error('Error clearing history:', error);
    }
  };

  return (
    <div className="App">
      <header className="app-header">
        <h1>
          <img src="/favicon.svg" alt="Ezé-U Logo" className="app-icon" />
          Ezé-U Internet Monitor
        </h1>
        <div className="connection-status">
          <span className={`status-dot ${isConnected ? 'connected' : 'disconnected'}`}></span>
          <span>{isConnected ? 'Connected' : 'Disconnected'}</span>
        </div>
      </header>
      
      <nav className="app-nav">
        <button
          className={activeTab === 'dashboard' ? 'active' : ''}
          onClick={() => setActiveTab('dashboard')}
        >
          Dashboard
        </button>
        <button
          className={activeTab === 'settings' ? 'active' : ''}
          onClick={() => setActiveTab('settings')}
        >
          Settings
        </button>
      </nav>

      <main className="app-main">
        {activeTab === 'dashboard' && (
          <Dashboard
            currentSpeed={currentSpeed}
            history={history}
            isMonitoring={isMonitoring}
            liveMonitoring={liveMonitoring}
            toggleMonitoring={toggleMonitoring}
            runSpeedTest={runSpeedTest}
            clearHistory={clearHistory}
            settings={settings}
          />
        )}
        {activeTab === 'settings' && (
          <Settings
            settings={settings}
            updateSettings={updateSettings}
          />
        )}
      </main>

      <footer className="app-footer">
        <div className="footer-content">
          <p>Made with ❤️ by Format209</p>
          <a
            href="https://github.com/sponsors/Format209"
            target="_blank"
            rel="noopener noreferrer"
            className="footer-donate"
          >
            ❤️ Support Development
          </a>
        </div>
      </footer>
    </div>
  );
}

export default App;
