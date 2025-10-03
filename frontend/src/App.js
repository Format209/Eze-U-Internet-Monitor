import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import Dashboard from './components/Dashboard';
import Settings from './components/Settings';
import './App.css';

function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [currentSpeed, setCurrentSpeed] = useState({ download: 0, upload: 0, ping: 0 });
  const [history, setHistory] = useState([]);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [liveMonitoring, setLiveMonitoring] = useState({});
  const [settings, setSettings] = useState({
    testInterval: 30,
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

  // WebSocket connection
  useEffect(() => {
    const connectWebSocket = () => {
      const websocket = new WebSocket('ws://localhost:5000');

      websocket.onopen = () => {
        console.log('WebSocket connected');
        setIsConnected(true);
      };

      websocket.onmessage = (event) => {
        const message = JSON.parse(event.data);
        
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
            // Refresh history from server after a brief delay to ensure DB is updated
            setTimeout(() => {
              fetchHistory();
            }, 500);
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
          default:
            break;
        }
      };

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
