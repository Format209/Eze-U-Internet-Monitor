import React, { useState, useEffect } from 'react';
import { Save, RotateCcw, Plus, Trash2, Settings as SettingsIcon, Activity, AlertTriangle, Heart, FileText, Calendar, Download, ArrowUpDown, ArrowUp, ArrowDown, Bell, Monitor, Mail, Send, MessageSquare, Hash, Smartphone, X, Check } from 'lucide-react';
import { format } from 'date-fns';
import './Settings.css';

// Dynamic backend URL configuration
const getBackendUrl = () => {
  const protocol = window.location.protocol;
  const hostname = window.location.hostname;
  return `${protocol}//${hostname}:8745`;
};

const BACKEND_URL = getBackendUrl();

function Settings({ settings, updateSettings }) {
  const [activeTab, setActiveTab] = useState('monitoring');
  const [localSettings, setLocalSettings] = useState({
    ...settings,
    monitorInterval: settings.monitorInterval || 60,
    liveMonitoringInterval: settings.liveMonitoringInterval || 10,
    logLevel: settings.logLevel || 'ALL',
    monthlyDataCap: settings.monthlyDataCap || '',
    dataRetention: settings.dataRetention || {
      speedTestRetentionDays: 90,
      liveMonitoringRetentionDays: 7,
      autoCleanupEnabled: true,
      autoCleanupTime: '00:00'
    },
    monitoringHosts: settings.monitoringHosts || [
      { address: '8.8.8.8', name: 'Google DNS', enabled: true },
      { address: '1.1.1.1', name: 'Cloudflare DNS', enabled: true },
      { address: '208.67.222.222', name: 'OpenDNS', enabled: false }
    ],
    notificationSettings: settings.notificationSettings || {
      enabled: settings.notifications || false,
      types: {
        browser: { enabled: true, sound: true },
        email: { enabled: false, address: '', smtp: { host: '', port: 587, user: '', password: '' } },
        webhook: { enabled: false, url: '', method: 'POST', headers: {} },
        telegram: { enabled: false, botToken: '', chatId: '' },
        discord: { enabled: false, webhookUrl: '' },
        slack: { enabled: false, webhookUrl: '' },
        sms: { enabled: false, provider: 'twilio', accountSid: '', authToken: '', fromNumber: '', toNumber: '' }
      },
      events: {
        onSpeedTestComplete: true,
        onThresholdBreach: true,
        onHostDown: true,
        onHostUp: false,
        onConnectionLost: true,
        onConnectionRestored: false,
        onHighLatency: false,
        onPacketLoss: false
      },
      minTimeBetweenNotifications: 5,
      quietHoursEnabled: false,
      quietHoursStart: '22:00',
      quietHoursEnd: '08:00'
    },
    thresholds: settings.thresholds || {
      minDownload: 10,
      minUpload: 10,
      maxPing: 500
    }
  });
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [newHost, setNewHost] = useState({ address: '', name: '', enabled: true });
  const [notificationConfigModal, setNotificationConfigModal] = useState({ isOpen: false, type: null });
  
  // Parse monthlyDataCap into separate value and unit
  const parseDataCap = (capString) => {
    if (!capString) return { value: '', unit: 'GB' };
    const match = capString.trim().match(/^(\d+(?:\.\d+)?)\s*(KB|MB|GB|TB|PB)$/i);
    if (match) {
      return { value: match[1], unit: match[2].toUpperCase() };
    }
    return { value: '', unit: 'GB' };
  };
  
  const initialDataCap = parseDataCap(settings.monthlyDataCap);
  const [dataCapValue, setDataCapValue] = useState(initialDataCap.value);
  const [dataCapUnit, setDataCapUnit] = useState(initialDataCap.unit);
  
  // Report tab state
  const [reportData, setReportData] = useState([]);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportTimeRange, setReportTimeRange] = useState('24h');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [showCustomDatePicker, setShowCustomDatePicker] = useState(false);
  const [sortColumn, setSortColumn] = useState('timestamp');
  const [sortDirection, setSortDirection] = useState('asc');

  // Console tab state
  const [consoleLogs, setConsoleLogs] = useState([]);
  const [consoleFilter, setConsoleFilter] = useState('ALL'); // ALL, DEBUG, INFO, WARN, ERROR, SUCCESS
  const [consoleSearch, setConsoleSearch] = useState('');
  const [autoScroll, setAutoScroll] = useState(true);
  const consoleEndRef = React.useRef(null);

  // Data cleanup state
  const [isCleaningUp, setIsCleaningUp] = useState(false);
  const [cleanupStatus, setCleanupStatus] = useState(null);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    
    if (name.includes('.')) {
      const [parent, child] = name.split('.');
      setLocalSettings(prev => ({
        ...prev,
        [parent]: {
          ...prev[parent],
          [child]: type === 'checkbox' ? checked : parseFloat(value) || value
        }
      }));
    } else {
      setLocalSettings(prev => ({
        ...prev,
        [name]: type === 'checkbox' ? checked : parseFloat(value) || value
      }));
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveMessage('');
    
    try {
      // Combine data cap value and unit into a single string
      const monthlyDataCap = dataCapValue && dataCapUnit ? `${dataCapValue} ${dataCapUnit}` : '';
      
      const settingsToSave = {
        ...localSettings,
        monthlyDataCap
      };
      
      await updateSettings(settingsToSave);
      setSaveMessage('Settings saved successfully!');
      setTimeout(() => setSaveMessage(''), 3000);
    } catch (error) {
      setSaveMessage('Error saving settings');
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = async () => {
    // Reset only current tab values back to DEFAULT values
    const resetSettings = { ...localSettings };
    let dataCapToSave = '';
    
    switch(activeTab) {
      case 'monitoring':
        resetSettings.testInterval = 60;
        resetSettings.monitorInterval = 10;
        resetSettings.logLevel = 'INFO';
        break;
      case 'hosts':
        resetSettings.monitoringHosts = [
          { address: '8.8.8.8', name: 'Google DNS', enabled: true },
          { address: '1.1.1.1', name: 'Cloudflare DNS', enabled: true },
          { address: '208.67.222.222', name: 'OpenDNS', enabled: false }
        ];
        break;
      case 'thresholds':
        resetSettings.thresholds = {
          minDownload: 10,
          minUpload: 10,
          maxPing: 500
        };
        break;
      case 'notifications':
        resetSettings.notificationSettings = {
          enabled: false,
          types: {
            browser: { enabled: true, sound: true },
            email: { enabled: false, address: '', smtp: { host: '', port: 587, user: '', password: '' } },
            webhook: { enabled: false, url: '', method: 'POST', headers: {} },
            telegram: { enabled: false, botToken: '', chatId: '' },
            discord: { enabled: false, webhookUrl: '' },
            slack: { enabled: false, webhookUrl: '' },
            sms: { enabled: false, provider: 'twilio', accountSid: '', authToken: '', fromNumber: '', toNumber: '' }
          },
          events: {
            onSpeedTestComplete: true,
            onThresholdBreach: true,
            onHostDown: true,
            onHostUp: false,
            onConnectionLost: true,
            onConnectionRestored: false,
            onHighLatency: false,
            onPacketLoss: false
          },
          minTimeBetweenNotifications: 5,
          quietHoursEnabled: false,
          quietHoursStart: '22:00',
          quietHoursEnd: '08:00'
        };
        break;
      case 'retention':
        resetSettings.dataRetention = {
          speedTestRetentionDays: 90,
          liveMonitoringRetentionDays: 7,
          autoCleanupEnabled: true,
          autoCleanupTime: '00:00'
        };
        resetSettings.monthlyDataCap = '';
        dataCapToSave = '';
        setDataCapValue('');
        setDataCapUnit('GB');
        break;
      default:
        break;
    }
    
    setLocalSettings(resetSettings);
    
    // Auto-save the reset values
    setIsSaving(true);
    try {
      const monthlyDataCap = activeTab === 'retention' ? dataCapToSave : (dataCapValue && dataCapUnit ? `${dataCapValue} ${dataCapUnit}` : resetSettings.monthlyDataCap || '');
      const settingsToSave = {
        ...resetSettings,
        monthlyDataCap
      };
      await updateSettings(settingsToSave);
      setSaveMessage(`${activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} settings reset and saved!`);
      setTimeout(() => setSaveMessage(''), 3000);
    } catch (error) {
      setSaveMessage('Error resetting settings');
    } finally {
      setIsSaving(false);
    }
  };

  // Manual data cleanup
  const handleManualCleanup = async () => {
    setIsCleaningUp(true);
    setCleanupStatus(null);
    
    try {
      const response = await fetch(`${BACKEND_URL}/api/cleanup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      
      if (result.success) {
        setCleanupStatus({
          type: 'success',
          message: '✅ Data cleanup completed successfully'
        });
        
        // Clear frontend cache and refresh data after cleanup
        // Add cache-busting parameter to force fresh data from server
        try {
          const timestamp = Date.now();
          
          // Refresh history data with cache buster
          const historyResponse = await fetch(`${BACKEND_URL}/api/history?limit=100&t=${timestamp}`);
          if (historyResponse.ok) {
            const historyData = await historyResponse.json();
            console.log('✓ History data refreshed after cleanup:', historyData.length || historyData.results?.length || 0, 'records');
          }
          
          // Refresh settings
          const settingsResponse = await fetch(`${BACKEND_URL}/api/settings?t=${timestamp}`);
          if (settingsResponse.ok) {
            const settingsData = await settingsResponse.json();
            console.log('✓ Settings refreshed after cleanup');
          }
          
          // Refresh live monitoring
          const statusResponse = await fetch(`${BACKEND_URL}/api/status?t=${timestamp}`);
          if (statusResponse.ok) {
            const statusData = await statusResponse.json();
            console.log('✓ Status refreshed after cleanup:', statusData);
          }
          
          console.log('✓ Frontend cache cleared and data refreshed');
        } catch (refreshError) {
          console.warn('Warning: Could not refresh all data after cleanup:', refreshError.message);
          // Don't fail the cleanup, just log the warning
        }
      } else {
        throw new Error(result.message || 'Cleanup failed');
      }
    } catch (error) {
      setCleanupStatus({
        type: 'error',
        message: `❌ Cleanup failed: ${error.message}`
      });
    } finally {
      setIsCleaningUp(false);
      // Clear status after 5 seconds
      setTimeout(() => setCleanupStatus(null), 5000);
    }
  };

  // Fetch report data based on time range
  const fetchReportData = async () => {
    setReportLoading(true);
    try {
      let url = `${BACKEND_URL}/api/history?limit=1000`;
      
      const response = await fetch(url);
      const data = await response.json();
      
      // Filter by time range
      const now = new Date();
      let filteredData = data;
      
      if (reportTimeRange === 'custom' && customStartDate && customEndDate) {
        const startDate = new Date(customStartDate);
        const endDate = new Date(customEndDate);
        endDate.setHours(23, 59, 59, 999); // End of day
        
        filteredData = data.filter(item => {
          const itemDate = new Date(item.timestamp);
          return itemDate >= startDate && itemDate <= endDate;
        });
      } else {
        const cutoffTime = new Date();
        switch (reportTimeRange) {
          case '1h':
            cutoffTime.setHours(now.getHours() - 1);
            break;
          case '6h':
            cutoffTime.setHours(now.getHours() - 6);
            break;
          case '24h':
            cutoffTime.setHours(now.getHours() - 24);
            break;
          case '7d':
            cutoffTime.setDate(now.getDate() - 7);
            break;
          case '30d':
            cutoffTime.setDate(now.getDate() - 30);
            break;
          case 'all':
            cutoffTime.setFullYear(2000);
            break;
          default:
            cutoffTime.setHours(now.getHours() - 24);
        }
        
        filteredData = data.filter(item => {
          const itemDate = new Date(item.timestamp);
          return itemDate >= cutoffTime;
        });
      }
      
      setReportData(filteredData);
    } catch (error) {
      console.error('Error fetching report data:', error);
    } finally {
      setReportLoading(false);
    }
  };

  // Fetch report data when tab becomes active or time range changes
  useEffect(() => {
    if (activeTab === 'report') {
      fetchReportData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, reportTimeRange, customStartDate, customEndDate]);

  // Handle console logs from WebSocket
  useEffect(() => {
    if (activeTab !== 'console') return;

    const handleConsoleLog = (message) => {
      if (message.type === 'console_log' && message.log) {
        setConsoleLogs(prev => {
          const newLogs = [...prev, message.log];
          // Keep only last 10000 logs
          return newLogs.slice(-10000);
        });
      }
    };

    // Set the global listener
    window.__consoleLogListener = handleConsoleLog;

    return () => {
      // Clean up listener when tab changes
      if (window.__consoleLogListener === handleConsoleLog) {
        delete window.__consoleLogListener;
      }
    };
  }, [activeTab, autoScroll]);

  // Auto-scroll effect - scroll only the console container, not the entire page
  useEffect(() => {
    if (autoScroll && consoleEndRef.current) {
      // Scroll the parent console-output container instead of the entire page
      const consoleContainer = consoleEndRef.current.closest('.console-output');
      if (consoleContainer) {
        consoleContainer.scrollTop = consoleContainer.scrollHeight;
      }
    }
  }, [consoleLogs, autoScroll]);

  // Export report as CSV
  const exportReportCSV = () => {
    if (reportData.length === 0) return;
    
    const headers = ['Timestamp', 'Download (Mbps)', 'Upload (Mbps)', 'Ping (ms)', 'Jitter (ms)', 'Download Latency (ms)', 'Upload Latency (ms)', 'Server', 'ISP', 'Result URL'];
    const csvContent = [
      headers.join(','),
      ...reportData.map(item => [
        format(new Date(item.timestamp), 'yyyy-MM-dd HH:mm:ss'),
        item.download.toFixed(2),
        item.upload.toFixed(2),
        item.ping.toFixed(2),
        (item.jitter || 0).toFixed(2),
        (item.downloadLatency || 0).toFixed(2),
        (item.uploadLatency || 0).toFixed(2),
        `"${item.server || 'N/A'}"`,
        `"${item.isp || 'N/A'}"`,
        `"${item.result_url || 'N/A'}"`
      ].join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `speed-test-report-${format(new Date(), 'yyyy-MM-dd-HHmmss')}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  // Calculate statistics
  const calculateStats = () => {
    if (reportData.length === 0) {
      return {
        avgDownload: 0,
        avgUpload: 0,
        avgPing: 0,
        avgJitter: 0,
        avgDownloadLatency: 0,
        avgUploadLatency: 0,
        minDownload: 0,
        maxDownload: 0,
        minUpload: 0,
        maxUpload: 0,
        minPing: 0,
        maxPing: 0,
        totalTests: 0
      };
    }

    const downloads = reportData.map(d => d.download);
    const uploads = reportData.map(d => d.upload);
    const pings = reportData.map(d => d.ping);
    const jitters = reportData.map(d => d.jitter || 0);
    const downloadLatencies = reportData.map(d => d.downloadLatency || 0);
    const uploadLatencies = reportData.map(d => d.uploadLatency || 0);

    return {
      avgDownload: (downloads.reduce((a, b) => a + b, 0) / downloads.length).toFixed(2),
      avgUpload: (uploads.reduce((a, b) => a + b, 0) / uploads.length).toFixed(2),
      avgPing: (pings.reduce((a, b) => a + b, 0) / pings.length).toFixed(2),
      avgJitter: (jitters.reduce((a, b) => a + b, 0) / jitters.length).toFixed(2),
      avgDownloadLatency: (downloadLatencies.reduce((a, b) => a + b, 0) / downloadLatencies.length).toFixed(2),
      avgUploadLatency: (uploadLatencies.reduce((a, b) => a + b, 0) / uploadLatencies.length).toFixed(2),
      minDownload: Math.min(...downloads).toFixed(2),
      maxDownload: Math.max(...downloads).toFixed(2),
      minUpload: Math.min(...uploads).toFixed(2),
      maxUpload: Math.max(...uploads).toFixed(2),
      minPing: Math.min(...pings).toFixed(2),
      maxPing: Math.max(...pings).toFixed(2),
      totalTests: reportData.length
    };
  };

  // Sort report data
  const handleSort = (column) => {
    if (sortColumn === column) {
      // Toggle direction if clicking same column
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // Set new column and default to ascending
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  // Get sorted data
  const getSortedData = () => {
    if (!reportData || reportData.length === 0) return [];
    
    const sorted = [...reportData].sort((a, b) => {
      let aVal, bVal;
      
      switch (sortColumn) {
        case 'timestamp':
          aVal = new Date(a.timestamp).getTime();
          bVal = new Date(b.timestamp).getTime();
          break;
        case 'download':
          aVal = a.download;
          bVal = b.download;
          break;
        case 'upload':
          aVal = a.upload;
          bVal = b.upload;
          break;
        case 'ping':
          aVal = a.ping;
          bVal = b.ping;
          break;
        case 'jitter':
          aVal = a.jitter || 0;
          bVal = b.jitter || 0;
          break;
        case 'downloadLatency':
          aVal = a.downloadLatency || 0;
          bVal = b.downloadLatency || 0;
          break;
        case 'uploadLatency':
          aVal = a.uploadLatency || 0;
          bVal = b.uploadLatency || 0;
          break;
        case 'server':
          aVal = (a.server || '').toLowerCase();
          bVal = (b.server || '').toLowerCase();
          break;
        case 'isp':
          aVal = (a.isp || '').toLowerCase();
          bVal = (b.isp || '').toLowerCase();
          break;
        case 'result_url':
          aVal = (a.result_url || '').toLowerCase();
          bVal = (b.result_url || '').toLowerCase();
          break;
        default:
          return 0;
      }
      
      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
    
    return sorted;
  };

  // Render sort icon
  const renderSortIcon = (column) => {
    if (sortColumn !== column) {
      return <ArrowUpDown size={14} className="sort-icon" />;
    }
    return sortDirection === 'asc' 
      ? <ArrowUp size={14} className="sort-icon active" />
      : <ArrowDown size={14} className="sort-icon active" />;
  };

  const handleHostToggle = (index) => {
    const hosts = localSettings.monitoringHosts || [];
    const updatedHosts = [...hosts];
    updatedHosts[index].enabled = !updatedHosts[index].enabled;
    setLocalSettings(prev => ({
      ...prev,
      monitoringHosts: updatedHosts
    }));
  };

  const handleAddHost = () => {
    if (newHost.address && newHost.name) {
      const hosts = localSettings.monitoringHosts || [];
      setLocalSettings(prev => ({
        ...prev,
        monitoringHosts: [...hosts, { ...newHost }]
      }));
      setNewHost({ address: '', name: '', enabled: true });
    }
  };

  const handleRemoveHost = (index) => {
    const hosts = localSettings.monitoringHosts || [];
    const updatedHosts = hosts.filter((_, i) => i !== index);
    setLocalSettings(prev => ({
      ...prev,
      monitoringHosts: updatedHosts
    }));
  };

  return (
    <div className="settings">
      <div className="settings-container">
        <h2>Settings</h2>

        {saveMessage && (
          <div className={`save-message ${saveMessage.includes('Error') ? 'error' : 'success'}`}>
            {saveMessage}
          </div>
        )}

        <div className="settings-layout">
          {/* Side Tabs */}
          <div className="settings-sidebar">
            <button
              className={`sidebar-tab ${activeTab === 'monitoring' ? 'active' : ''}`}
              onClick={() => setActiveTab('monitoring')}
            >
              <SettingsIcon size={20} />
              <span>Monitoring</span>
            </button>
            <button
              className={`sidebar-tab ${activeTab === 'hosts' ? 'active' : ''}`}
              onClick={() => setActiveTab('hosts')}
            >
              <Activity size={20} />
              <span>Live Hosts</span>
            </button>
            <button
              className={`sidebar-tab ${activeTab === 'thresholds' ? 'active' : ''}`}
              onClick={() => setActiveTab('thresholds')}
            >
              <AlertTriangle size={20} />
              <span>Thresholds</span>
            </button>
            <button
              className={`sidebar-tab ${activeTab === 'notifications' ? 'active' : ''}`}
              onClick={() => setActiveTab('notifications')}
            >
              <Bell size={20} />
              <span>Notifications</span>
            </button>
            <button
              className={`sidebar-tab ${activeTab === 'report' ? 'active' : ''}`}
              onClick={() => setActiveTab('report')}
            >
              <FileText size={20} />
              <span>Report</span>
            </button>
            <button
              className={`sidebar-tab ${activeTab === 'console' ? 'active' : ''}`}
              onClick={() => setActiveTab('console')}
            >
              <Monitor size={20} />
              <span>Console</span>
            </button>
            <button
              className={`sidebar-tab ${activeTab === 'retention' ? 'active' : ''}`}
              onClick={() => setActiveTab('retention')}
            >
              <Calendar size={20} />
              <span>Data Retention</span>
            </button>
            <button
              className={`sidebar-tab ${activeTab === 'donate' ? 'active' : ''}`}
              onClick={() => setActiveTab('donate')}
            >
              <Heart size={20} />
              <span>Donate</span>
            </button>
          </div>

          {/* Content Area */}
          <div className="settings-content">
            {/* Monitoring Configuration Tab */}
            {activeTab === 'monitoring' && (
              <div className="settings-section">
          <h3>Monitoring Configuration</h3>
          
          <div className="setting-item">
            <label htmlFor="testInterval">
              Test Interval (minutes)
              <span className="help-text">How often to run automatic speed tests</span>
            </label>
            <input
              type="number"
              id="testInterval"
              name="testInterval"
              value={localSettings.testInterval}
              onChange={handleChange}
              min="1"
              max="1440"
            />
          </div>

          <div className="setting-item">
            <label htmlFor="monitorInterval">
              Live Monitoring Interval (seconds)
              <span className="help-text">How often to check host connectivity (recommended: 3-10 seconds)</span>
            </label>
            <input
              type="number"
              id="monitorInterval"
              name="monitorInterval"
              value={localSettings.monitorInterval || 5}
              onChange={handleChange}
              min="1"
              max="60"
            />
          </div>

          <div className="setting-item">
            <label htmlFor="logLevel">
              Server Log Level
              <span className="help-text">Controls how much detail is logged by the backend server (DEBUG shows everything, ERROR shows only errors)</span>
            </label>
            <select
              id="logLevel"
              name="logLevel"
              value={localSettings.logLevel || 'INFO'}
              onChange={handleChange}
            >
              <option value="DEBUG">DEBUG - Show all logs (most verbose)</option>
              <option value="INFO">INFO - Show info, warnings, and errors</option>
              <option value="WARN">WARN - Show only warnings and errors</option>
              <option value="ERROR">ERROR - Show only errors (least verbose)</option>
            </select>
          </div>

          <div className="setting-item">
            <label htmlFor="dataCapValue">
              Monthly Data Cap (Optional)
              <span className="help-text">Set a monthly limit for speedtest data usage. Leave empty for unlimited. Speed tests will be blocked when the cap is reached until next month.</span>
            </label>
            <div className="data-cap-input-group">
              <input
                type="number"
                id="dataCapValue"
                name="dataCapValue"
                value={dataCapValue}
                onChange={(e) => setDataCapValue(e.target.value)}
                placeholder="e.g., 5, 10, 100"
                min="0"
                step="0.1"
              />
              <select
                id="dataCapUnit"
                name="dataCapUnit"
                value={dataCapUnit}
                onChange={(e) => setDataCapUnit(e.target.value)}
              >
                <option value="MB">MB</option>
                <option value="GB">GB</option>
                <option value="TB">TB</option>
                <option value="PB">PB</option>
              </select>
            </div>
            {dataCapValue && (
              <div className="data-cap-preview">
                Cap set to: <strong>{dataCapValue} {dataCapUnit}</strong> per month
              </div>
            )}
            {!dataCapValue && (
              <div className="data-cap-preview unlimited">
                No limit - Unlimited data usage
              </div>
            )}
          </div>
        </div>
      )}

            {/* Monitoring Hosts Tab */}
            {activeTab === 'hosts' && (
              <div className="settings-section">
                <h3>Monitoring Hosts</h3>
          <p className="section-description">
            Configure which hosts to ping during live monitoring. Multiple hosts can be monitored simultaneously.
          </p>

          <div className="monitoring-hosts-list">
            {(localSettings.monitoringHosts || []).map((host, index) => (
              <div key={index} className="monitoring-host-item">
                <div className="host-toggle">
                  <input
                    type="checkbox"
                    checked={host.enabled}
                    onChange={() => handleHostToggle(index)}
                  />
                </div>
                <div className="host-details">
                  <div className="host-name">{host.name}</div>
                  <div className="host-address-small">{host.address}</div>
                </div>
                <button
                  className="btn-remove-host"
                  onClick={() => handleRemoveHost(index)}
                  title="Remove host"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>

          <div className="add-host-section">
            <h4>Add New Host</h4>
            <div className="add-host-form">
              <input
                type="text"
                placeholder="Host Name (e.g., Google DNS)"
                value={newHost.name}
                onChange={(e) => setNewHost({ ...newHost, name: e.target.value })}
              />
              <input
                type="text"
                placeholder="IP Address (e.g., 8.8.8.8)"
                value={newHost.address}
                onChange={(e) => setNewHost({ ...newHost, address: e.target.value })}
              />
              <button
                className="btn-add-host"
                onClick={handleAddHost}
                disabled={!newHost.address || !newHost.name}
              >
                <Plus size={20} />
                Add Host
              </button>
            </div>
          </div>
        </div>
      )}

            {/* Performance Thresholds Tab */}
            {activeTab === 'thresholds' && (
              <div className="settings-section">
                <h3>Performance Thresholds</h3>
          <p className="section-description">
            Set minimum acceptable values for network performance. Values below these thresholds will be highlighted as warnings.
          </p>

          <div className="setting-item">
            <label htmlFor="thresholds.minDownload">
              Minimum Download Speed (Mbps)
              <span className="help-text">Alert when download speed falls below this value</span>
            </label>
            <input
              type="number"
              id="thresholds.minDownload"
              name="thresholds.minDownload"
              value={localSettings.thresholds.minDownload}
              onChange={handleChange}
              min="1"
              step="1"
            />
          </div>

          <div className="setting-item">
            <label htmlFor="thresholds.minUpload">
              Minimum Upload Speed (Mbps)
              <span className="help-text">Alert when upload speed falls below this value</span>
            </label>
            <input
              type="number"
              id="thresholds.minUpload"
              name="thresholds.minUpload"
              value={localSettings.thresholds.minUpload}
              onChange={handleChange}
              min="1"
              step="1"
            />
          </div>

          <div className="setting-item">
            <label htmlFor="thresholds.maxPing">
              Maximum Ping (ms)
              <span className="help-text">Alert when ping exceeds this value</span>
            </label>
            <input
              type="number"
              id="thresholds.maxPing"
              name="thresholds.maxPing"
              value={localSettings.thresholds.maxPing}
              onChange={handleChange}
              min="1"
              step="1"
            />
          </div>
        </div>
      )}

            {/* Notifications Tab */}
            {activeTab === 'notifications' && (
              <div className="settings-section">
                <h3>Notification Settings</h3>
                <p className="section-description">
                  Configure multiple notification channels and select which events trigger alerts
                </p>

                {/* Master Toggle */}
                <div className="notification-master-toggle">
                  <div className="input-group">
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        name="notificationSettings.enabled"
                        checked={localSettings.notificationSettings.enabled}
                        onChange={handleChange}
                      />
                      <span className="notification-master-label">
                        <Bell size={18} />
                        Enable Notifications
                      </span>
                    </label>
                    <p className="notification-hint">
                      Master switch for all notifications. Disable to stop all alerts.
                    </p>
                  </div>
                </div>

                {/* Notification Channels */}
                <div className="notification-section">
                  <h4>Notification Channels</h4>
                  <p className="notification-hint">
                    Enable multiple notification channels. Each can be configured independently.
                  </p>
                  
                  <div className="notification-channels-grid">
                    {/* Browser/Desktop */}
                    <div className={`notification-channel-card ${localSettings.notificationSettings?.types?.browser?.enabled ? 'active' : ''}`}>
                      <div className="channel-header">
                        <Monitor size={24} />
                        <div className="channel-info">
                          <h5>Browser</h5>
                          <span className="channel-status">
                            {localSettings.notificationSettings?.types?.browser?.enabled ? 'Active' : 'Disabled'}
                          </span>
                        </div>
                        <label className="channel-toggle">
                          <input
                            type="checkbox"
                            checked={localSettings.notificationSettings?.types?.browser?.enabled || false}
                            onChange={(e) => {
                              setLocalSettings(prev => ({
                                ...prev,
                                notificationSettings: {
                                  ...prev.notificationSettings,
                                  types: {
                                    ...prev.notificationSettings?.types,
                                    browser: { ...prev.notificationSettings?.types?.browser, enabled: e.target.checked }
                                  }
                                }
                              }));
                            }}
                            disabled={!localSettings.notificationSettings?.enabled}
                          />
                        </label>
                      </div>
                      {localSettings.notificationSettings?.types?.browser?.enabled && (
                        <div className="channel-config">
                          <label className="checkbox-label-inline">
                            <input
                              type="checkbox"
                              checked={localSettings.notificationSettings?.types?.browser?.sound || false}
                              onChange={(e) => {
                                setLocalSettings(prev => ({
                                  ...prev,
                                  notificationSettings: {
                                    ...prev.notificationSettings,
                                    types: {
                                      ...prev.notificationSettings?.types,
                                      browser: { ...prev.notificationSettings?.types?.browser, sound: e.target.checked }
                                    }
                                  }
                                }));
                              }}
                            />
                            <span>Enable sound</span>
                          </label>
                        </div>
                      )}
                    </div>

                    {/* Email */}
                    <div className={`notification-channel-card ${localSettings.notificationSettings?.types?.email?.enabled ? 'active' : ''}`}>
                      <div className="channel-header">
                        <Mail size={24} />
                        <div className="channel-info">
                          <h5>Email</h5>
                          <span className="channel-status">
                            {localSettings.notificationSettings?.types?.email?.enabled ? 'Active' : 'Disabled'}
                          </span>
                        </div>
                        <label className="channel-toggle">
                          <input
                            type="checkbox"
                            checked={localSettings.notificationSettings?.types?.email?.enabled || false}
                            onChange={(e) => {
                              setLocalSettings(prev => ({
                                ...prev,
                                notificationSettings: {
                                  ...prev.notificationSettings,
                                  types: {
                                    ...prev.notificationSettings?.types,
                                    email: { ...prev.notificationSettings?.types?.email, enabled: e.target.checked }
                                  }
                                }
                              }));
                            }}
                            disabled={!localSettings.notificationSettings?.enabled}
                          />
                        </label>
                      </div>
                      {localSettings.notificationSettings?.types?.email?.enabled && (
                        <button 
                          className="config-btn"
                          onClick={() => setNotificationConfigModal({ isOpen: true, type: 'email' })}
                        >
                          <SettingsIcon size={14} />
                          Configure Email
                        </button>
                      )}
                    </div>

                    {/* Webhook */}
                    <div className={`notification-channel-card ${localSettings.notificationSettings?.types?.webhook?.enabled ? 'active' : ''}`}>
                      <div className="channel-header">
                        <Send size={24} />
                        <div className="channel-info">
                          <h5>Webhook</h5>
                          <span className="channel-status">
                            {localSettings.notificationSettings?.types?.webhook?.enabled ? 'Active' : 'Disabled'}
                          </span>
                        </div>
                        <label className="channel-toggle">
                          <input
                            type="checkbox"
                            checked={localSettings.notificationSettings?.types?.webhook?.enabled || false}
                            onChange={(e) => {
                              setLocalSettings(prev => ({
                                ...prev,
                                notificationSettings: {
                                  ...prev.notificationSettings,
                                  types: {
                                    ...prev.notificationSettings?.types,
                                    webhook: { ...prev.notificationSettings?.types?.webhook, enabled: e.target.checked }
                                  }
                                }
                              }));
                            }}
                            disabled={!localSettings.notificationSettings?.enabled}
                          />
                        </label>
                      </div>
                      {localSettings.notificationSettings?.types?.webhook?.enabled && (
                        <button 
                          className="config-btn"
                          onClick={() => setNotificationConfigModal({ isOpen: true, type: 'webhook' })}
                        >
                          <SettingsIcon size={14} />
                          Configure Webhook
                        </button>
                      )}
                    </div>

                    {/* Telegram */}
                    <div className={`notification-channel-card ${localSettings.notificationSettings?.types?.telegram?.enabled ? 'active' : ''}`}>
                      <div className="channel-header">
                        <Send size={24} />
                        <div className="channel-info">
                          <h5>Telegram</h5>
                          <span className="channel-status">
                            {localSettings.notificationSettings?.types?.telegram?.enabled ? 'Active' : 'Disabled'}
                          </span>
                        </div>
                        <label className="channel-toggle">
                          <input
                            type="checkbox"
                            checked={localSettings.notificationSettings?.types?.telegram?.enabled || false}
                            onChange={(e) => {
                              setLocalSettings(prev => ({
                                ...prev,
                                notificationSettings: {
                                  ...prev.notificationSettings,
                                  types: {
                                    ...prev.notificationSettings?.types,
                                    telegram: { ...prev.notificationSettings?.types?.telegram, enabled: e.target.checked }
                                  }
                                }
                              }));
                            }}
                            disabled={!localSettings.notificationSettings?.enabled}
                          />
                        </label>
                      </div>
                      {localSettings.notificationSettings?.types?.telegram?.enabled && (
                        <button 
                          className="config-btn"
                          onClick={() => setNotificationConfigModal({ isOpen: true, type: 'telegram' })}
                        >
                          <SettingsIcon size={14} />
                          Configure Telegram
                        </button>
                      )}
                    </div>

                    {/* Discord */}
                    <div className={`notification-channel-card ${localSettings.notificationSettings?.types?.discord?.enabled ? 'active' : ''}`}>
                      <div className="channel-header">
                        <MessageSquare size={24} />
                        <div className="channel-info">
                          <h5>Discord</h5>
                          <span className="channel-status">
                            {localSettings.notificationSettings?.types?.discord?.enabled ? 'Active' : 'Disabled'}
                          </span>
                        </div>
                        <label className="channel-toggle">
                          <input
                            type="checkbox"
                            checked={localSettings.notificationSettings?.types?.discord?.enabled || false}
                            onChange={(e) => {
                              setLocalSettings(prev => ({
                                ...prev,
                                notificationSettings: {
                                  ...prev.notificationSettings,
                                  types: {
                                    ...prev.notificationSettings?.types,
                                    discord: { ...prev.notificationSettings?.types?.discord, enabled: e.target.checked }
                                  }
                                }
                              }));
                            }}
                            disabled={!localSettings.notificationSettings?.enabled}
                          />
                        </label>
                      </div>
                      {localSettings.notificationSettings?.types?.discord?.enabled && (
                        <button 
                          className="config-btn"
                          onClick={() => setNotificationConfigModal({ isOpen: true, type: 'discord' })}
                        >
                          <SettingsIcon size={14} />
                          Configure Discord
                        </button>
                      )}
                    </div>

                    {/* Slack */}
                    <div className={`notification-channel-card ${localSettings.notificationSettings?.types?.slack?.enabled ? 'active' : ''}`}>
                      <div className="channel-header">
                        <Hash size={24} />
                        <div className="channel-info">
                          <h5>Slack</h5>
                          <span className="channel-status">
                            {localSettings.notificationSettings?.types?.slack?.enabled ? 'Active' : 'Disabled'}
                          </span>
                        </div>
                        <label className="channel-toggle">
                          <input
                            type="checkbox"
                            checked={localSettings.notificationSettings?.types?.slack?.enabled || false}
                            onChange={(e) => {
                              setLocalSettings(prev => ({
                                ...prev,
                                notificationSettings: {
                                  ...prev.notificationSettings,
                                  types: {
                                    ...prev.notificationSettings?.types,
                                    slack: { ...prev.notificationSettings?.types?.slack, enabled: e.target.checked }
                                  }
                                }
                              }));
                            }}
                            disabled={!localSettings.notificationSettings?.enabled}
                          />
                        </label>
                      </div>
                      {localSettings.notificationSettings?.types?.slack?.enabled && (
                        <button 
                          className="config-btn"
                          onClick={() => setNotificationConfigModal({ isOpen: true, type: 'slack' })}
                        >
                          <SettingsIcon size={14} />
                          Configure Slack
                        </button>
                      )}
                    </div>

                    {/* SMS */}
                    <div className={`notification-channel-card ${localSettings.notificationSettings?.types?.sms?.enabled ? 'active' : ''}`}>
                      <div className="channel-header">
                        <Smartphone size={24} />
                        <div className="channel-info">
                          <h5>SMS</h5>
                          <span className="channel-status">
                            {localSettings.notificationSettings?.types?.sms?.enabled ? 'Active' : 'Disabled'}
                          </span>
                        </div>
                        <label className="channel-toggle">
                          <input
                            type="checkbox"
                            checked={localSettings.notificationSettings?.types?.sms?.enabled || false}
                            onChange={(e) => {
                              setLocalSettings(prev => ({
                                ...prev,
                                notificationSettings: {
                                  ...prev.notificationSettings,
                                  types: {
                                    ...prev.notificationSettings?.types,
                                    sms: { ...prev.notificationSettings?.types?.sms, enabled: e.target.checked }
                                  }
                                }
                              }));
                            }}
                            disabled={!localSettings.notificationSettings?.enabled}
                          />
                        </label>
                      </div>
                      {localSettings.notificationSettings?.types?.sms?.enabled && (
                        <button 
                          className="config-btn"
                          onClick={() => setNotificationConfigModal({ isOpen: true, type: 'sms' })}
                        >
                          <SettingsIcon size={14} />
                          Configure SMS
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Notification Events */}
                <div className="notification-section">
                  <h4>Notification Events</h4>
                  <p className="notification-hint">
                    Select which events trigger notifications across all enabled channels
                  </p>
                  
                  <div className="notification-events-grid">
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={localSettings.notificationSettings?.events?.onSpeedTestComplete}
                        onChange={(e) => {
                          setLocalSettings(prev => ({
                            ...prev,
                            notificationSettings: {
                              ...prev.notificationSettings,
                              events: { ...prev.notificationSettings.events, onSpeedTestComplete: e.target.checked }
                            }
                          }));
                        }}
                        disabled={!localSettings.notificationSettings?.enabled}
                      />
                      <span>Speed Test Complete</span>
                    </label>

                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={localSettings.notificationSettings?.events?.onThresholdBreach}
                        onChange={(e) => {
                          setLocalSettings(prev => ({
                            ...prev,
                            notificationSettings: {
                              ...prev.notificationSettings,
                              events: { ...prev.notificationSettings.events, onThresholdBreach: e.target.checked }
                            }
                          }));
                        }}
                        disabled={!localSettings.notificationSettings?.enabled}
                      />
                      <span>Threshold Breach</span>
                    </label>

                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={localSettings.notificationSettings?.events?.onHostDown}
                        onChange={(e) => {
                          setLocalSettings(prev => ({
                            ...prev,
                            notificationSettings: {
                              ...prev.notificationSettings,
                              events: { ...prev.notificationSettings.events, onHostDown: e.target.checked }
                            }
                          }));
                        }}
                        disabled={!localSettings.notificationSettings?.enabled}
                      />
                      <span>Host Down</span>
                    </label>

                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={localSettings.notificationSettings?.events?.onHostUp}
                        onChange={(e) => {
                          setLocalSettings(prev => ({
                            ...prev,
                            notificationSettings: {
                              ...prev.notificationSettings,
                              events: { ...prev.notificationSettings.events, onHostUp: e.target.checked }
                            }
                          }));
                        }}
                        disabled={!localSettings.notificationSettings?.enabled}
                      />
                      <span>Host Recovered</span>
                    </label>

                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={localSettings.notificationSettings?.events?.onConnectionLost}
                        onChange={(e) => {
                          setLocalSettings(prev => ({
                            ...prev,
                            notificationSettings: {
                              ...prev.notificationSettings,
                              events: { ...prev.notificationSettings.events, onConnectionLost: e.target.checked }
                            }
                          }));
                        }}
                        disabled={!localSettings.notificationSettings?.enabled}
                      />
                      <span>Connection Lost</span>
                    </label>

                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={localSettings.notificationSettings?.events?.onConnectionRestored}
                        onChange={(e) => {
                          setLocalSettings(prev => ({
                            ...prev,
                            notificationSettings: {
                              ...prev.notificationSettings,
                              events: { ...prev.notificationSettings.events, onConnectionRestored: e.target.checked }
                            }
                          }));
                        }}
                        disabled={!localSettings.notificationSettings?.enabled}
                      />
                      <span>Connection Restored</span>
                    </label>

                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={localSettings.notificationSettings?.events?.onHighLatency}
                        onChange={(e) => {
                          setLocalSettings(prev => ({
                            ...prev,
                            notificationSettings: {
                              ...prev.notificationSettings,
                              events: { ...prev.notificationSettings.events, onHighLatency: e.target.checked }
                            }
                          }));
                        }}
                        disabled={!localSettings.notificationSettings?.enabled}
                      />
                      <span>High Latency Detected</span>
                    </label>

                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={localSettings.notificationSettings?.events?.onPacketLoss}
                        onChange={(e) => {
                          setLocalSettings(prev => ({
                            ...prev,
                            notificationSettings: {
                              ...prev.notificationSettings,
                              events: { ...prev.notificationSettings.events, onPacketLoss: e.target.checked }
                            }
                          }));
                        }}
                        disabled={!localSettings.notificationSettings?.enabled}
                      />
                      <span>Packet Loss Detected</span>
                    </label>
                  </div>
                </div>

                {/* Notification Frequency */}
                <div className="notification-section">
                  <h4>Notification Frequency</h4>
                  
                  <div className="input-group">
                    <label htmlFor="notificationSettings.minTimeBetweenNotifications">
                      Minimum Time Between Notifications (minutes)
                    </label>
                    <input
                      type="number"
                      id="notificationSettings.minTimeBetweenNotifications"
                      name="notificationSettings.minTimeBetweenNotifications"
                      value={localSettings.notificationSettings.minTimeBetweenNotifications}
                      onChange={handleChange}
                      min="1"
                      max="60"
                      step="1"
                      disabled={!localSettings.notificationSettings?.enabled}
                    />
                    <p className="notification-hint">
                      Prevent notification spam by setting a cooldown period between similar alerts
                    </p>
                  </div>
                </div>

                {/* Quiet Hours */}
                <div className="notification-section">
                  <h4>Quiet Hours</h4>
                  
                  <div className="input-group">
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        name="notificationSettings.quietHoursEnabled"
                        checked={localSettings.notificationSettings.quietHoursEnabled}
                        onChange={handleChange}
                        disabled={!localSettings.notificationSettings?.enabled}
                      />
                      <span>Enable Quiet Hours</span>
                    </label>
                    <p className="notification-hint">
                      Disable notifications during specific hours (e.g., nighttime)
                    </p>
                  </div>

                  {localSettings.notificationSettings.quietHoursEnabled && (
                    <div className="quiet-hours-time">
                      <div className="input-group">
                        <label htmlFor="notificationSettings.quietHoursStart">
                          Start Time
                        </label>
                        <input
                          type="time"
                          id="notificationSettings.quietHoursStart"
                          name="notificationSettings.quietHoursStart"
                          value={localSettings.notificationSettings.quietHoursStart}
                          onChange={handleChange}
                          disabled={!localSettings.notificationSettings?.enabled}
                        />
                      </div>

                      <div className="input-group">
                        <label htmlFor="notificationSettings.quietHoursEnd">
                          End Time
                        </label>
                        <input
                          type="time"
                          id="notificationSettings.quietHoursEnd"
                          name="notificationSettings.quietHoursEnd"
                          value={localSettings.notificationSettings.quietHoursEnd}
                          onChange={handleChange}
                          disabled={!localSettings.notificationSettings?.enabled}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Test Notification Button */}
                {localSettings.notificationSettings?.enabled && (
                  <div className="notification-section">
                    <button 
                      className="test-notification-btn"
                      onClick={async () => {
                        try {
                          const response = await fetch('http://localhost:8745/api/test-notification', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' }
                          });
                          const result = await response.json();
                          
                          // Show which channels were tested
                          const enabledChannels = Object.entries(result.enabledChannels || {})
                            .filter(([_, enabled]) => enabled)
                            .map(([channel]) => channel.charAt(0).toUpperCase() + channel.slice(1));
                          
                          if (enabledChannels.length > 0) {
                            alert(`✅ Test notification sent to: ${enabledChannels.join(', ')}\n\nCheck each channel to verify.`);
                          } else {
                            alert('⚠️ No notification channels are enabled. Please enable at least one channel in the settings above.');
                          }
                        } catch (error) {
                          console.error('Failed to send test notification:', error);
                          alert('❌ Failed to send test notification. Make sure the backend is running.');
                        }
                      }}
                    >
                      <Bell size={16} />
                      Send Test Notification
                    </button>
                    <p className="notification-hint">
                      Test ALL enabled notification channels (Browser, Discord, Telegram, Slack, etc.)
                    </p>
                  </div>
                )}

                {/* Configuration Modal */}
                {notificationConfigModal.isOpen && (
                  <div className="modal-overlay" onClick={() => setNotificationConfigModal({ isOpen: false, type: null })}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                      <div className="modal-header">
                        <h4>Configure {notificationConfigModal.type.charAt(0).toUpperCase() + notificationConfigModal.type.slice(1)}</h4>
                        <button className="modal-close" onClick={() => setNotificationConfigModal({ isOpen: false, type: null })}>
                          <X size={20} />
                        </button>
                      </div>
                      
                      <div className="modal-body">
                        {/* Email Configuration */}
                        {notificationConfigModal.type === 'email' && (
                          <div className="config-form">
                            <div className="input-group">
                              <label>Recipient Email Address</label>
                              <input
                                type="email"
                                placeholder="your@email.com"
                                value={localSettings.notificationSettings?.types?.email?.address || ""}
                                onChange={(e) => {
                                  setLocalSettings(prev => ({
                                    ...prev,
                                    notificationSettings: {
                                      ...prev.notificationSettings,
                                      types: {
                                        ...prev.notificationSettings?.types,
                                        email: { ...prev.notificationSettings?.types?.email, address: e.target.value }
                                      }
                                    }
                                  }));
                                }}
                              />
                            </div>
                            <div className="input-group">
                              <label>SMTP Host</label>
                              <input
                                type="text"
                                placeholder="smtp.gmail.com"
                                value={localSettings.notificationSettings?.types?.email?.smtp?.host || ""}
                                onChange={(e) => {
                                  setLocalSettings(prev => ({
                                    ...prev,
                                    notificationSettings: {
                                      ...prev.notificationSettings,
                                      types: {
                                        ...prev.notificationSettings?.types,
                                        email: {
                                          ...prev.notificationSettings?.types?.email,
                                          smtp: { ...prev.notificationSettings?.types?.email.smtp, host: e.target.value }
                                        }
                                      }
                                    }
                                  }));
                                }}
                              />
                            </div>
                            <div className="input-group">
                              <label>SMTP Port</label>
                              <input
                                type="number"
                                placeholder="587"
                                value={localSettings.notificationSettings?.types?.email?.smtp?.port || ""}
                                onChange={(e) => {
                                  setLocalSettings(prev => ({
                                    ...prev,
                                    notificationSettings: {
                                      ...prev.notificationSettings,
                                      types: {
                                        ...prev.notificationSettings?.types,
                                        email: {
                                          ...prev.notificationSettings?.types?.email,
                                          smtp: { ...prev.notificationSettings?.types?.email.smtp, port: parseInt(e.target.value) || 587 }
                                        }
                                      }
                                    }
                                  }));
                                }}
                              />
                            </div>
                            <div className="input-group">
                              <label>SMTP Username</label>
                              <input
                                type="text"
                                placeholder="your@email.com"
                                value={localSettings.notificationSettings?.types?.email?.smtp?.user || ""}
                                onChange={(e) => {
                                  setLocalSettings(prev => ({
                                    ...prev,
                                    notificationSettings: {
                                      ...prev.notificationSettings,
                                      types: {
                                        ...prev.notificationSettings?.types,
                                        email: {
                                          ...prev.notificationSettings?.types?.email,
                                          smtp: { ...prev.notificationSettings?.types?.email.smtp, user: e.target.value }
                                        }
                                      }
                                    }
                                  }));
                                }}
                              />
                            </div>
                            <div className="input-group">
                              <label>SMTP Password</label>
                              <input
                                type="password"
                                placeholder="••••••••"
                                value={localSettings.notificationSettings?.types?.email?.smtp?.password || ""}
                                onChange={(e) => {
                                  setLocalSettings(prev => ({
                                    ...prev,
                                    notificationSettings: {
                                      ...prev.notificationSettings,
                                      types: {
                                        ...prev.notificationSettings?.types,
                                        email: {
                                          ...prev.notificationSettings?.types?.email,
                                          smtp: { ...prev.notificationSettings?.types?.email.smtp, password: e.target.value }
                                        }
                                      }
                                    }
                                  }));
                                }}
                              />
                            </div>
                          </div>
                        )}

                        {/* Webhook Configuration */}
                        {notificationConfigModal.type === 'webhook' && (
                          <div className="config-form">
                            <div className="input-group">
                              <label>Webhook URL</label>
                              <input
                                type="url"
                                placeholder="https://your-server.com/webhook"
                                value={localSettings.notificationSettings?.types?.webhook?.url || ""}
                                onChange={(e) => {
                                  setLocalSettings(prev => ({
                                    ...prev,
                                    notificationSettings: {
                                      ...prev.notificationSettings,
                                      types: {
                                        ...prev.notificationSettings?.types,
                                        webhook: { ...prev.notificationSettings?.types?.webhook, url: e.target.value }
                                      }
                                    }
                                  }));
                                }}
                              />
                            </div>
                            <div className="input-group">
                              <label>HTTP Method</label>
                              <select
                                value={localSettings.notificationSettings?.types?.webhook?.method || ""}
                                onChange={(e) => {
                                  setLocalSettings(prev => ({
                                    ...prev,
                                    notificationSettings: {
                                      ...prev.notificationSettings,
                                      types: {
                                        ...prev.notificationSettings?.types,
                                        webhook: { ...prev.notificationSettings?.types?.webhook, method: e.target.value }
                                      }
                                    }
                                  }));
                                }}
                              >
                                <option value="POST">POST</option>
                                <option value="GET">GET</option>
                                <option value="PUT">PUT</option>
                              </select>
                            </div>
                          </div>
                        )}

                        {/* Telegram Configuration */}
                        {notificationConfigModal.type === 'telegram' && (
                          <div className="config-form">
                            <div className="input-group">
                              <label>Bot Token</label>
                              <input
                                type="text"
                                placeholder="123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11"
                                value={localSettings.notificationSettings?.types?.telegram?.botToken || ""}
                                onChange={(e) => {
                                  setLocalSettings(prev => ({
                                    ...prev,
                                    notificationSettings: {
                                      ...prev.notificationSettings,
                                      types: {
                                        ...prev.notificationSettings?.types,
                                        telegram: { ...prev.notificationSettings?.types?.telegram, botToken: e.target.value }
                                      }
                                    }
                                  }));
                                }}
                              />
                              <p className="notification-hint">Get from @BotFather on Telegram</p>
                            </div>
                            <div className="input-group">
                              <label>Chat ID</label>
                              <input
                                type="text"
                                placeholder="123456789"
                                value={localSettings.notificationSettings?.types?.telegram?.chatId || ""}
                                onChange={(e) => {
                                  setLocalSettings(prev => ({
                                    ...prev,
                                    notificationSettings: {
                                      ...prev.notificationSettings,
                                      types: {
                                        ...prev.notificationSettings?.types,
                                        telegram: { ...prev.notificationSettings?.types?.telegram, chatId: e.target.value }
                                      }
                                    }
                                  }));
                                }}
                              />
                              <p className="notification-hint">Your Telegram chat ID</p>
                            </div>
                          </div>
                        )}

                        {/* Discord Configuration */}
                        {notificationConfigModal.type === 'discord' && (
                          <div className="config-form">
                            <div className="input-group">
                              <label>Discord Webhook URL</label>
                              <input
                                type="url"
                                placeholder="https://discord.com/api/webhooks/..."
                                value={localSettings.notificationSettings?.types?.discord?.webhookUrl || ""}
                                onChange={(e) => {
                                  setLocalSettings(prev => ({
                                    ...prev,
                                    notificationSettings: {
                                      ...prev.notificationSettings,
                                      types: {
                                        ...prev.notificationSettings?.types,
                                        discord: { ...prev.notificationSettings?.types?.discord, webhookUrl: e.target.value }
                                      }
                                    }
                                  }));
                                }}
                              />
                              <p className="notification-hint">From Discord Server Settings → Integrations → Webhooks</p>
                            </div>
                          </div>
                        )}

                        {/* Slack Configuration */}
                        {notificationConfigModal.type === 'slack' && (
                          <div className="config-form">
                            <div className="input-group">
                              <label>Slack Webhook URL</label>
                              <input
                                type="url"
                                placeholder="https://hooks.slack.com/services/..."
                                value={localSettings.notificationSettings?.types?.slack?.webhookUrl || ""}
                                onChange={(e) => {
                                  setLocalSettings(prev => ({
                                    ...prev,
                                    notificationSettings: {
                                      ...prev.notificationSettings,
                                      types: {
                                        ...prev.notificationSettings?.types,
                                        slack: { ...prev.notificationSettings?.types?.slack, webhookUrl: e.target.value }
                                      }
                                    }
                                  }));
                                }}
                              />
                              <p className="notification-hint">From Slack App → Incoming Webhooks</p>
                            </div>
                          </div>
                        )}

                        {/* SMS Configuration */}
                        {notificationConfigModal.type === 'sms' && (
                          <div className="config-form">
                            <div className="input-group">
                              <label>SMS Provider</label>
                              <select
                                value={localSettings.notificationSettings?.types?.sms?.provider || ""}
                                onChange={(e) => {
                                  setLocalSettings(prev => ({
                                    ...prev,
                                    notificationSettings: {
                                      ...prev.notificationSettings,
                                      types: {
                                        ...prev.notificationSettings?.types,
                                        sms: { ...prev.notificationSettings?.types?.sms, provider: e.target.value }
                                      }
                                    }
                                  }));
                                }}
                              >
                                <option value="twilio">Twilio</option>
                                <option value="nexmo">Nexmo/Vonage</option>
                              </select>
                            </div>
                            <div className="input-group">
                              <label>Account SID</label>
                              <input
                                type="text"
                                placeholder="ACxxxxxxxxxxxxx"
                                value={localSettings.notificationSettings?.types?.sms?.accountSid || ""}
                                onChange={(e) => {
                                  setLocalSettings(prev => ({
                                    ...prev,
                                    notificationSettings: {
                                      ...prev.notificationSettings,
                                      types: {
                                        ...prev.notificationSettings?.types,
                                        sms: { ...prev.notificationSettings?.types?.sms, accountSid: e.target.value }
                                      }
                                    }
                                  }));
                                }}
                              />
                            </div>
                            <div className="input-group">
                              <label>Auth Token</label>
                              <input
                                type="password"
                                placeholder="••••••••"
                                value={localSettings.notificationSettings?.types?.sms?.authToken || ""}
                                onChange={(e) => {
                                  setLocalSettings(prev => ({
                                    ...prev,
                                    notificationSettings: {
                                      ...prev.notificationSettings,
                                      types: {
                                        ...prev.notificationSettings?.types,
                                        sms: { ...prev.notificationSettings?.types?.sms, authToken: e.target.value }
                                      }
                                    }
                                  }));
                                }}
                              />
                            </div>
                            <div className="input-group">
                              <label>From Number</label>
                              <input
                                type="tel"
                                placeholder="+1234567890"
                                value={localSettings.notificationSettings?.types?.sms?.fromNumber || ""}
                                onChange={(e) => {
                                  setLocalSettings(prev => ({
                                    ...prev,
                                    notificationSettings: {
                                      ...prev.notificationSettings,
                                      types: {
                                        ...prev.notificationSettings?.types,
                                        sms: { ...prev.notificationSettings?.types?.sms, fromNumber: e.target.value }
                                      }
                                    }
                                  }));
                                }}
                              />
                            </div>
                            <div className="input-group">
                              <label>To Number</label>
                              <input
                                type="tel"
                                placeholder="+1234567890"
                                value={localSettings.notificationSettings?.types?.sms?.toNumber || ""}
                                onChange={(e) => {
                                  setLocalSettings(prev => ({
                                    ...prev,
                                    notificationSettings: {
                                      ...prev.notificationSettings,
                                      types: {
                                        ...prev.notificationSettings?.types,
                                        sms: { ...prev.notificationSettings?.types?.sms, toNumber: e.target.value }
                                      }
                                    }
                                  }));
                                }}
                              />
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="modal-footer">
                        <button 
                          className="btn-secondary"
                          onClick={() => setNotificationConfigModal({ isOpen: false, type: null })}
                        >
                          Cancel
                        </button>
                        <button 
                          className="btn-primary"
                          onClick={() => setNotificationConfigModal({ isOpen: false, type: null })}
                        >
                          <Check size={16} />
                          Save Configuration
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Report Tab */}
            {activeTab === 'report' && (
              <div className="settings-section">
                <h3>Speed Test Reports</h3>
                <p className="section-description">
                  View and export historical speed test results
                </p>

                {/* Time Range Selector */}
                <div className="report-controls">
                  <div className="time-range-selector">
                    <label htmlFor="reportTimeRange">Time Range:</label>
                    <select
                      id="reportTimeRange"
                      value={reportTimeRange}
                      onChange={(e) => {
                        setReportTimeRange(e.target.value);
                        setShowCustomDatePicker(e.target.value === 'custom');
                      }}
                    >
                      <option value="1h">Last Hour</option>
                      <option value="6h">Last 6 Hours</option>
                      <option value="24h">Last 24 Hours</option>
                      <option value="7d">Last 7 Days</option>
                      <option value="30d">Last 30 Days</option>
                      <option value="all">All Time</option>
                      <option value="custom">Custom Range</option>
                    </select>
                  </div>

                  {showCustomDatePicker && (
                    <div className="custom-date-picker">
                      <div className="date-input-group">
                        <label htmlFor="startDate">
                          <Calendar size={16} style={{ stroke: '#06b6d4', color: '#06b6d4' }} />
                          Start Date:
                        </label>
                        <input
                          type="date"
                          id="startDate"
                          value={customStartDate}
                          onChange={(e) => setCustomStartDate(e.target.value)}
                        />
                      </div>
                      <div className="date-input-group">
                        <label htmlFor="endDate">
                          <Calendar size={16} style={{ stroke: '#06b6d4', color: '#06b6d4' }} />
                          End Date:
                        </label>
                        <input
                          type="date"
                          id="endDate"
                          value={customEndDate}
                          onChange={(e) => setCustomEndDate(e.target.value)}
                        />
                      </div>
                    </div>
                  )}

                  <button
                    className="btn-export"
                    onClick={exportReportCSV}
                    disabled={reportData.length === 0}
                  >
                    <Download size={20} />
                    Export CSV
                  </button>
                </div>

                {/* Statistics Summary */}
                {!reportLoading && reportData.length > 0 && (
                  <div className="report-stats">
                    <h4>Statistics Summary</h4>
                    <div className="stats-grid">
                      <div className="stat-card">
                        <div className="stat-label">Total Tests</div>
                        <div className="stat-value">{calculateStats().totalTests}</div>
                      </div>
                      <div className="stat-card">
                        <div className="stat-label">Avg Download</div>
                        <div className="stat-value stat-download">{calculateStats().avgDownload} Mbps</div>
                        <div className="stat-range">
                          Min: {calculateStats().minDownload} | Max: {calculateStats().maxDownload}
                        </div>
                      </div>
                      <div className="stat-card">
                        <div className="stat-label">Avg Upload</div>
                        <div className="stat-value stat-upload">{calculateStats().avgUpload} Mbps</div>
                        <div className="stat-range">
                          Min: {calculateStats().minUpload} | Max: {calculateStats().maxUpload}
                        </div>
                      </div>
                      <div className="stat-card">
                        <div className="stat-label">Avg Ping</div>
                        <div className="stat-value stat-ping">{calculateStats().avgPing} ms</div>
                        <div className="stat-range">
                          Min: {calculateStats().minPing} | Max: {calculateStats().maxPing}
                        </div>
                      </div>
                      <div className="stat-card">
                        <div className="stat-label">Average Jitter</div>
                        <div className="stat-value stat-jitter">{calculateStats().avgJitter} ms</div>
                      </div>
                      <div className="stat-card">
                        <div className="stat-label">Avg Download Latency</div>
                        <div className="stat-value stat-latency">{calculateStats().avgDownloadLatency} ms</div>
                      </div>
                      <div className="stat-card">
                        <div className="stat-label">Avg Upload Latency</div>
                        <div className="stat-value stat-latency">{calculateStats().avgUploadLatency} ms</div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Report Table */}
                <div className="report-table-container">
                  {reportLoading ? (
                    <div className="report-loading">Loading report data...</div>
                  ) : reportData.length === 0 ? (
                    <div className="report-empty">No speed test results found for the selected time range.</div>
                  ) : (
                    <table className="report-table">
                      <thead>
                        <tr>
                          <th onClick={() => handleSort('timestamp')} className="sortable">
                            <span className="th-content">
                              Timestamp
                              {renderSortIcon('timestamp')}
                            </span>
                          </th>
                          <th onClick={() => handleSort('download')} className="sortable">
                            <span className="th-content">
                              Download (Mbps)
                              {renderSortIcon('download')}
                            </span>
                          </th>
                          <th onClick={() => handleSort('upload')} className="sortable">
                            <span className="th-content">
                              Upload (Mbps)
                              {renderSortIcon('upload')}
                            </span>
                          </th>
                          <th onClick={() => handleSort('ping')} className="sortable">
                            <span className="th-content">
                              Ping (ms)
                              {renderSortIcon('ping')}
                            </span>
                          </th>
                          <th onClick={() => handleSort('jitter')} className="sortable">
                            <span className="th-content">
                              Jitter (ms)
                              {renderSortIcon('jitter')}
                            </span>
                          </th>
                          <th onClick={() => handleSort('downloadLatency')} className="sortable">
                            <span className="th-content">
                              Download Latency (ms)
                              {renderSortIcon('downloadLatency')}
                            </span>
                          </th>
                          <th onClick={() => handleSort('uploadLatency')} className="sortable">
                            <span className="th-content">
                              Upload Latency (ms)
                              {renderSortIcon('uploadLatency')}
                            </span>
                          </th>
                          <th onClick={() => handleSort('server')} className="sortable">
                            <span className="th-content">
                              Server
                              {renderSortIcon('server')}
                            </span>
                          </th>
                          <th onClick={() => handleSort('isp')} className="sortable">
                            <span className="th-content">
                              ISP
                              {renderSortIcon('isp')}
                            </span>
                          </th>
                          <th onClick={() => handleSort('result_url')} className="sortable">
                            <span className="th-content">
                              Result URL
                              {renderSortIcon('result_url')}
                            </span>
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {getSortedData().map((test, index) => (
                          <tr key={index}>
                            <td>{format(new Date(test.timestamp), 'MMM dd, yyyy HH:mm:ss')}</td>
                            <td className="value-download">{test.download.toFixed(2)}</td>
                            <td className="value-upload">{test.upload.toFixed(2)}</td>
                            <td className="value-ping">{test.ping.toFixed(2)}</td>
                            <td className="value-jitter">{(test.jitter || 0).toFixed(2)}</td>
                            <td className="value-latency">{(test.downloadLatency || 0).toFixed(2)}</td>
                            <td className="value-latency">{(test.uploadLatency || 0).toFixed(2)}</td>
                            <td className="value-server">{test.server || 'N/A'}</td>
                            <td className="value-isp">{test.isp || 'N/A'}</td>
                            <td className="value-result-url">
                              {test.result_url ? (
                                <a href={test.result_url} target="_blank" rel="noopener noreferrer">
                                  View
                                </a>
                              ) : (
                                'N/A'
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            )}

            {/* Console Tab */}
            {activeTab === 'console' && (
              <div className="settings-section">
                <h3>Live Backend Console</h3>
                <p className="section-description">
                  View real-time backend logs and debug information
                </p>

                {/* Console Controls */}
                <div className="console-controls">
                  <div className="console-filters">
                    <label htmlFor="logLevel">Log Level:</label>
                    <select
                      id="logLevel"
                      value={consoleFilter}
                      onChange={(e) => setConsoleFilter(e.target.value)}
                    >
                      <option value="ALL">All Levels</option>
                      <option value="DEBUG">DEBUG</option>
                      <option value="INFO">INFO</option>
                      <option value="SUCCESS">SUCCESS</option>
                      <option value="WARN">WARN</option>
                      <option value="ERROR">ERROR</option>
                    </select>
                  </div>

                  <div className="console-search">
                    <input
                      type="text"
                      placeholder="Search logs..."
                      value={consoleSearch}
                      onChange={(e) => setConsoleSearch(e.target.value)}
                    />
                  </div>

                  <div className="console-options">
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={autoScroll}
                        onChange={(e) => setAutoScroll(e.target.checked)}
                      />
                      Auto-scroll
                    </label>
                    <button
                      className="btn-clear-console"
                      onClick={() => setConsoleLogs([])}
                    >
                      <Trash2 size={16} />
                      Clear
                    </button>
                  </div>
                </div>

                {/* Console Output */}
                <div className="console-output">
                  {consoleLogs.length === 0 ? (
                    <div className="console-empty">
                      <Monitor size={32} />
                      <p>Waiting for backend logs...</p>
                    </div>
                  ) : (
                    <div className="console-logs">
                      {consoleLogs.map((log, idx) => {
                        const matchesFilter = consoleFilter === 'ALL' || log.level === consoleFilter;
                        const matchesSearch = consoleSearch === '' || 
                          log.message.toLowerCase().includes(consoleSearch.toLowerCase());
                        
                        if (!matchesFilter || !matchesSearch) return null;
                        
                        return (
                          <div key={idx} className={`console-line log-${log.level.toLowerCase()}`}>
                            <span className="console-timestamp">{log.timestamp}</span>
                            <span className={`console-level log-level-${log.level.toLowerCase()}`}>
                              [{log.level}]
                            </span>
                            <span className="console-message">{log.message}</span>
                          </div>
                        );
                      })}
                      <div ref={consoleEndRef} />
                    </div>
                  )}
                </div>

                <div className="console-info">
                  <p>Total Logs: {consoleLogs.length} | Filtered: {consoleLogs.filter(log => 
                    (consoleFilter === 'ALL' || log.level === consoleFilter) &&
                    (consoleSearch === '' || log.message.toLowerCase().includes(consoleSearch.toLowerCase()))
                  ).length}</p>
                </div>
              </div>
            )}

            {/* Data Retention Tab */}
            {activeTab === 'retention' && (
              <div className="settings-section">
                <h3>Data Retention & Auto-Cleanup</h3>
                <p className="section-description">
                  Configure how long data is kept and enable automatic cleanup of old records to maintain database performance.
                </p>

                <div className="settings-group">
                  <div className="settings-item">
                    <label>Speed Test Data Retention</label>
                    <div className="input-group">
                      <input
                        type="number"
                        min="1"
                        max="3650"
                        value={localSettings.dataRetention?.speedTestRetentionDays || 90}
                        onChange={(e) => setLocalSettings(prev => ({
                          ...prev,
                          dataRetention: {
                            ...prev.dataRetention,
                            speedTestRetentionDays: parseInt(e.target.value) || 90
                          }
                        }))}
                      />
                      <span className="input-suffix">days</span>
                    </div>
                    <small>Speed test records older than this will be automatically deleted (1-3650 days)</small>
                  </div>

                  <div className="settings-item">
                    <label>Live Monitoring Data Retention</label>
                    <div className="input-group">
                      <input
                        type="number"
                        min="1"
                        max="365"
                        value={localSettings.dataRetention?.liveMonitoringRetentionDays || 7}
                        onChange={(e) => setLocalSettings(prev => ({
                          ...prev,
                          dataRetention: {
                            ...prev.dataRetention,
                            liveMonitoringRetentionDays: parseInt(e.target.value) || 7
                          }
                        }))}
                      />
                      <span className="input-suffix">days</span>
                    </div>
                    <small>Live monitoring history records older than this will be automatically deleted (1-365 days)</small>
                  </div>
                </div>

                <div className="settings-group">
                  <div className="settings-item checkbox-item">
                    <input
                      type="checkbox"
                      id="autoCleanup"
                      checked={localSettings.dataRetention?.autoCleanupEnabled !== false}
                      onChange={(e) => setLocalSettings(prev => ({
                        ...prev,
                        dataRetention: {
                          ...prev.dataRetention,
                          autoCleanupEnabled: e.target.checked
                        }
                      }))}
                    />
                    <label htmlFor="autoCleanup">Enable Automatic Cleanup</label>
                  </div>
                  <small>Automatically delete data older than retention period daily</small>

                  {localSettings.dataRetention?.autoCleanupEnabled !== false && (
                    <div className="settings-item">
                      <label>Cleanup Schedule Time</label>
                      <div className="input-group">
                        <input
                          type="time"
                          value={localSettings.dataRetention?.autoCleanupTime || '00:00'}
                          onChange={(e) => setLocalSettings(prev => ({
                            ...prev,
                            dataRetention: {
                              ...prev.dataRetention,
                              autoCleanupTime: e.target.value
                            }
                          }))}
                        />
                        <span className="input-suffix">🕐 Local Time</span>
                      </div>
                      <small>Time of day to run automatic cleanup (local server time)</small>
                    </div>
                  )}
                </div>

                <div className="settings-info-box">
                  <strong>📊 Retention Summary:</strong>
                  <ul>
                    <li>Speed Tests: Last {localSettings.dataRetention?.speedTestRetentionDays || 90} days</li>
                    <li>Live Monitoring: Last {localSettings.dataRetention?.liveMonitoringRetentionDays || 7} days</li>
                    <li>Cleanup: {localSettings.dataRetention?.autoCleanupEnabled !== false ? `Daily at ${localSettings.dataRetention?.autoCleanupTime || '00:00'}` : 'Disabled'}</li>
                  </ul>
                </div>

                <div className="settings-group">
                  <button
                    className="btn-cleanup"
                    onClick={handleManualCleanup}
                    disabled={isCleaningUp}
                    title="Run data cleanup now to delete records older than retention period"
                  >
                    <RotateCcw size={20} className={isCleaningUp ? 'spinner' : ''} />
                    {isCleaningUp ? 'Cleaning up...' : 'Run Cleanup Now'}
                  </button>
                  {cleanupStatus && (
                    <div className={`cleanup-status ${cleanupStatus.type}`}>
                      {cleanupStatus.message}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Donate Tab */}
            {activeTab === 'donate' && (
              <div className="settings-section">
                <h3>Support Development</h3>
                <p className="section-description">
                  If you find this application useful, please consider supporting its development.
                  Your contribution helps maintain and improve Ezé-U Internet Monitor.
                </p>
                <div className="donate-content">
                  <div className="donate-card">
                    <Heart size={48} className="donate-icon" />
                    <h4>Become a Sponsor</h4>
                    <p>Support ongoing development.</p>
                    <a
                      href="https://github.com/sponsors/Format209"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-donate"
                    >
                      <Heart size={20} />
                      Sponsor on GitHub
                    </a>
                  </div>
                </div>
              </div>
            )}

            {/* Save/Reset Actions - Always visible */}
            <div className="settings-actions">
              <button
                className="btn-reset"
                onClick={handleReset}
              >
                <RotateCcw size={20} />
                Reset
              </button>
              <button
                className="btn-save"
                onClick={handleSave}
                disabled={isSaving}
              >
                <Save size={20} />
                {isSaving ? 'Saving...' : 'Save Settings'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Settings;




