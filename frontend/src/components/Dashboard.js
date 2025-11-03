import React, { useState, useEffect } from 'react';
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { format } from 'date-fns';
import { Activity, Zap, Upload, Download, Trash2, Clock, Radio, X, TrendingUp, RefreshCw, AlertTriangle } from 'lucide-react';
import './Dashboard.css';

// Dynamic backend URL configuration
// Frontend connects to backend on the same IP/hostname it's running on
const getBackendUrl = () => {
  const protocol = window.location.protocol;
  const hostname = window.location.hostname;
  
  // Backend is always on port 8745
  return `${protocol}//${hostname}:8745`;
};

const BACKEND_URL = getBackendUrl();

function Dashboard({ currentSpeed, history, isMonitoring, liveMonitoring, toggleMonitoring, runSpeedTest, clearHistory, settings }) {
  const [timeRange, setTimeRange] = useState('1h');
  const [isTestRunning, setIsTestRunning] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [externalIP, setExternalIP] = useState('Loading...');
  const [nextTestTime, setNextTestTime] = useState(null);
  const [selectedHost, setSelectedHost] = useState(null);
  const [hostTimeRange, setHostTimeRange] = useState('1h');
  const [hostHistory, setHostHistory] = useState([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [monthlyUsage, setMonthlyUsage] = useState(null);

  const handleRunTest = async () => {
    setIsTestRunning(true);
    try {
      await runSpeedTest();
    } catch (error) {
      setErrorMessage('Speed test failed. Please try again.');
      setTimeout(() => setErrorMessage(null), 5000);
    }
    setTimeout(() => setIsTestRunning(false), 5000);
  };

  // Fetch external IP on mount
  useEffect(() => {
    const fetchExternalIP = async () => {
      try {
        const response = await fetch('https://api.ipify.org?format=json');
        const data = await response.json();
        setExternalIP(data.ip);
      } catch (error) {
        setExternalIP('Unable to fetch');
      }
    };
    
    fetchExternalIP();
  }, []);

  // Fetch next scheduled test time
  useEffect(() => {
    const fetchNextTest = async () => {
      try {
        const response = await fetch(`${BACKEND_URL}/api/next-test`);
        const data = await response.json();
        if (data.nextRun) {
          setNextTestTime(new Date(data.nextRun));
        } else {
          setNextTestTime(null);
        }
      } catch (error) {
        console.error('Failed to fetch next test time:', error);
      }
    };

    fetchNextTest();
    // Refresh every 30 seconds
    const interval = setInterval(fetchNextTest, 30000);
    return () => clearInterval(interval);
  }, [isMonitoring, history]);

  // Fetch host monitoring history when modal opens or time range changes
  useEffect(() => {
    const fetchHostHistory = async () => {
      if (!selectedHost) {
        setHostHistory([]);
        return;
      }

      setIsLoadingHistory(true);
      try {
        const response = await fetch(
          `${BACKEND_URL}/api/live-monitoring-history/${encodeURIComponent(selectedHost.address)}?timeRange=${hostTimeRange}`
        );
        const data = await response.json();
        
        if (data.history) {
          // Format time based on range
          const formattedHistory = data.history.map(item => {
            const date = new Date(item.timestamp);
            let timeLabel;
            switch(hostTimeRange) {
              case '15m':
              case '30m':
              case '1h':
              case '6h':
                timeLabel = format(date, 'HH:mm');
                break;
              case '24h':
                timeLabel = format(date, 'HH:mm');
                break;
              case '7d':
                timeLabel = format(date, 'MM/dd HH:mm');
                break;
              default:
                timeLabel = format(date, 'HH:mm');
            }
            return {
              time: timeLabel,
              ping: item.ping,
              fullTime: format(date, 'MMM dd, yyyy HH:mm:ss')
            };
          });
          setHostHistory(formattedHistory);
        }
      } catch (error) {
        console.error('Error fetching host history:', error);
        setHostHistory([]);
      } finally {
        setIsLoadingHistory(false);
      }
    };

    fetchHostHistory();
  }, [selectedHost, hostTimeRange]);

  // Fetch monthly usage
  useEffect(() => {
    const fetchMonthlyUsage = async () => {
      try {
        const response = await fetch(`${BACKEND_URL}/api/monthly-usage`);
        const data = await response.json();
        setMonthlyUsage(data);
      } catch (error) {
        console.error('Error fetching monthly usage:', error);
      }
    };

    fetchMonthlyUsage();
    // Refresh every 30 seconds
    const interval = setInterval(fetchMonthlyUsage, 30000);
    return () => clearInterval(interval);
  }, [history]); // Refresh when history updates

  // Check for errors in last history entry
  useEffect(() => {
    if (history.length > 0) {
      const lastEntry = history[history.length - 1];
      if (lastEntry.error) {
        setErrorMessage(lastEntry.error);
        setTimeout(() => setErrorMessage(null), 8000);
      }
    }
  }, [history]);

  const filterHistoryByTimeRange = () => {
    const now = new Date();
    let cutoffTime;

    switch (timeRange) {
      case '1h':
        cutoffTime = new Date(now.getTime() - 60 * 60 * 1000);
        break;
      case '6h':
        cutoffTime = new Date(now.getTime() - 6 * 60 * 60 * 1000);
        break;
      case '24h':
        cutoffTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case '7d':
        cutoffTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'all':
      default:
        return history;
    }

    const filtered = history.filter(item => new Date(item.timestamp) >= cutoffTime);
    
    // Debug logging
    console.log(`Time Range: ${timeRange}`);
    console.log(`Cutoff Time: ${cutoffTime.toISOString()}`);
    console.log(`Current Time: ${now.toISOString()}`);
    console.log(`Total History Items: ${history.length}`);
    console.log(`Filtered Items: ${filtered.length}`);
    if (history.length > 0) {
      console.log(`Oldest Item: ${history[0]?.timestamp}`);
      console.log(`Newest Item: ${history[history.length - 1]?.timestamp}`);
    }
    
    return filtered;
  };

  const filteredHistory = filterHistoryByTimeRange();

  // Format time based on time range selection
  const formatTimeLabel = (timestamp) => {
    const date = new Date(timestamp);
    switch (timeRange) {
      case '1h':
      case '6h':
        return format(date, 'HH:mm');
      case '24h':
        return format(date, 'HH:mm');
      case '7d':
        return format(date, 'MM/dd HH:mm');
      case 'all':
      default:
        return format(date, 'MM/dd');
    }
  };

  // Ensure data is in chronological order (oldest to newest) for proper graph display
  const chronologicalHistory = [...filteredHistory].sort((a, b) => 
    new Date(a.timestamp) - new Date(b.timestamp)
  );

  const chartData = chronologicalHistory.map(item => ({
    time: formatTimeLabel(item.timestamp),
    fullTime: format(new Date(item.timestamp), 'MMM dd, yyyy HH:mm:ss'),
    download: item.download,
    upload: item.upload,
    ping: item.ping,
    jitter: item.jitter || 0,
    downloadLatency: item.downloadLatency || item.ping,
    uploadLatency: item.uploadLatency || item.ping
  }));

  console.log(`📊 Chart Data Length: ${chartData.length}`);
  console.log(`📊 Sample Chart Data:`, chartData.slice(0, 2));

  // Generate ticks to display on X-axis
  const generateXAxisTicks = () => {
    const dataLength = chartData.length;
    if (dataLength === 0) return [];
    if (dataLength <= 30) {
      // Show all ticks
      return chartData.map(d => d.time);
    }
    
    // For larger datasets, pick evenly spaced ticks
    const tickCount = Math.min(15, dataLength);
    const step = Math.floor(dataLength / tickCount);
    const ticks = [];
    for (let i = 0; i < dataLength; i += step) {
      ticks.push(chartData[i].time);
    }
    // Always include the last point
    if (ticks[ticks.length - 1] !== chartData[dataLength - 1].time) {
      ticks.push(chartData[dataLength - 1].time);
    }
    return ticks;
  };

  const xAxisTicks = generateXAxisTicks();

  // Calculate statistics for charts
  const calculateStats = (data, key) => {
    if (data.length === 0) return { min: 0, max: 0, avg: 0 };
    const values = data.map(item => item[key] || 0);
    return {
      min: Math.min(...values),
      max: Math.max(...values),
      avg: values.reduce((a, b) => a + b, 0) / values.length
    };
  };

  // Calculate percentage change from previous result
  const calculatePercentChange = (current, previous) => {
    if (!previous || previous === 0) return 0; // Return 0% instead of null when no previous data
    const change = ((current - previous) / previous) * 100;
    return change;
  };

  // Get previous values for percentage calculation
  const getPreviousValue = (key) => {
    if (history.length < 2) return 0; // Return 0 instead of null when insufficient history
    return history[history.length - 2][key];
  };

  // Get the latest speed values - use currentSpeed if available, otherwise use latest from history
  const getLatestSpeed = () => {
    // If currentSpeed has actual values (not initial 0,0,0), use it
    if (currentSpeed.download > 0 || currentSpeed.upload > 0 || currentSpeed.ping > 0) {
      return currentSpeed;
    }
    // Otherwise, get the most recent test from history
    if (history.length > 0) {
      const latest = history[history.length - 1];
      return {
        download: latest.download || 0,
        upload: latest.upload || 0,
        ping: latest.ping || 0
      };
    }
    // No data at all
    return { download: 0, upload: 0, ping: 0 };
  };

  const latestSpeed = getLatestSpeed();

  const downloadChange = calculatePercentChange(latestSpeed.download, getPreviousValue('download'));
  const uploadChange = calculatePercentChange(latestSpeed.upload, getPreviousValue('upload'));
  const pingChange = calculatePercentChange(latestSpeed.ping, getPreviousValue('ping'));

  // Stats for each metric
  const downloadStats = calculateStats(chartData, 'download');
  const uploadStats = calculateStats(chartData, 'upload');
  const pingStats = calculateStats(chartData, 'ping');
  const jitterStats = calculateStats(chartData, 'jitter');
  const downloadLatencyStats = calculateStats(chartData, 'downloadLatency');
  const uploadLatencyStats = calculateStats(chartData, 'uploadLatency');

  // Helper function to convert bytes to appropriate unit (KB, MB, GB, TB, PB) - auto-adapting
  const formatBytes = (bytes) => {
    if (bytes === 0) return { value: '0', unit: 'MB' };
    
    const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
    const k = 1024;
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    const value = bytes / Math.pow(k, i);
    
    // Format with appropriate decimal places
    const formattedValue = value >= 100 ? value.toFixed(1) : value.toFixed(2);
    
    return { 
      value: formattedValue, 
      unit: units[i] 
    };
  };

  // Calculate total data usage for the selected time range
  const calculateDataUsage = () => {
    const totalDownloadBytes = filteredHistory.reduce((sum, item) => sum + (item.downloadBytes || 0), 0);
    const totalUploadBytes = filteredHistory.reduce((sum, item) => sum + (item.uploadBytes || 0), 0);
    const totalBytes = totalDownloadBytes + totalUploadBytes;
    
    return {
      download: formatBytes(totalDownloadBytes),
      upload: formatBytes(totalUploadBytes),
      total: formatBytes(totalBytes),
      testCount: filteredHistory.length
    };
  };

  const dataUsage = calculateDataUsage();

  const getSpeedStatus = (speed, threshold, isReverse = false) => {
    if (speed === 0) return 'inactive';
    if (isReverse) {
      return speed < threshold ? 'good' : 'warning';
    }
    return speed >= threshold ? 'good' : 'warning';
  };

  const downloadStatus = getSpeedStatus(latestSpeed.download, settings.thresholds.minDownload);
  const uploadStatus = getSpeedStatus(latestSpeed.upload, settings.thresholds.minUpload);
  const pingStatus = getSpeedStatus(latestSpeed.ping, settings.thresholds.maxPing, true);

  return (
    <div className="dashboard">
      {/* Error Notification */}
      {errorMessage && (
        <div className="error-notification">
          <div className="error-content">
            <span className="error-icon">⚠️</span>
            <p>{errorMessage}</p>
            <button onClick={() => setErrorMessage(null)} className="close-error">×</button>
          </div>
        </div>
      )}

      {/* Monthly Data Cap Warning */}
      {monthlyUsage && monthlyUsage.monthlyDataCap && (
        <div className={`data-cap-warning ${monthlyUsage.capReached ? 'critical' : monthlyUsage.percentageUsed >= 80 ? 'warning' : 'info'}`}>
          <div className="cap-warning-content">
            <AlertTriangle size={24} className="cap-warning-icon" />
            <div className="cap-warning-details">
              <h4>
                {monthlyUsage.capReached 
                  ? '🚫 Monthly SpeedTest Cap Reached!' 
                  : monthlyUsage.percentageUsed >= 80 
                    ? '⚠️ Approaching SpeedTest Cap' 
                    : '📊 Monthly SpeedTest Usage'}
              </h4>
              <p>
                {formatBytes(monthlyUsage.totalBytes).value} {formatBytes(monthlyUsage.totalBytes).unit} of {monthlyUsage.monthlyDataCap} used this month ({monthlyUsage.percentageUsed.toFixed(1)}%)
                {monthlyUsage.capReached && ' - Speed tests are disabled until next month'}
              </p>
              <div className="cap-progress-bar">
                <div 
                  className="cap-progress-fill" 
                  style={{ width: `${Math.min(100, monthlyUsage.percentageUsed)}%` }}
                ></div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Live Monitoring Block */}
      {isMonitoring && settings.monitoringHosts && settings.monitoringHosts.length > 0 && (
        <div className="live-monitoring-block">
          <div className="live-monitoring-header">
            <div className="live-monitoring-title">
              <Radio size={24} className="pulse-icon" />
              <h2>Live Monitoring</h2>
            </div>
            <span className="monitoring-badge">Active</span>
          </div>
          <p className="monitoring-hint">Click on a host for more information</p>
          <div className="monitoring-hosts">
            {settings.monitoringHosts
              .filter(host => host.enabled)
              .map((host, index) => {
                const liveData = liveMonitoring[host.address];
                const ping = liveData?.ping || -1;
                const isOnline = ping > 0;
                const status = !isOnline ? 'offline' : ping < 50 ? 'excellent' : ping < 100 ? 'good' : 'poor';
                
                return (
                  <div 
                    key={index} 
                    className={`monitoring-host-card ${status} clickable`}
                    onClick={() => setSelectedHost(host)}
                  >
                    <div className="host-info">
                      <h4>{host.name}</h4>
                      <p className="host-address">{host.address}</p>
                    </div>
                    <div className="host-ping">
                      <div className={`ping-indicator ${status}`}></div>
                      <div className="ping-value">
                        {isOnline ? (
                          <>
                            <span className="ping-number">{ping.toFixed(0)}</span>
                            <span className="ping-unit">ms</span>
                          </>
                        ) : (
                          <span className="ping-offline">Offline</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* Control Panel */}
      <div className="control-panel">
        <button
          className="control-btn test"
          onClick={handleRunTest}
          disabled={isTestRunning}
        >
          <Zap size={20} />
          {isTestRunning ? 'Testing...' : 'Run Speed Test'}
        </button>
        <button
          className="control-btn danger"
          onClick={clearHistory}
        >
          <Trash2 size={20} />
          Clear All Data
        </button>
      </div>

      {/* External IP Info */}
      <div className="external-ip-banner">
        <div className="ip-info">
          <span className="ip-label">External IP:</span>
          <span className="ip-value">{externalIP}</span>
        </div>
        {nextTestTime && isMonitoring && (
          <div className="next-test-info">
            <Clock size={16} />
            <span className="next-test-label">Next test:</span>
            <span className="next-test-time">{format(nextTestTime, 'MMM dd, yyyy HH:mm:ss')}</span>
          </div>
        )}
      </div>

      {/* Current Speed Cards */}
      <div className="speed-cards">
        <div className={`speed-card ${downloadStatus}`}>
          <div className="card-icon">
            <Download size={32} />
          </div>
          <div className="card-content">
            <h3>Download</h3>
            <div className="speed-value">
              {latestSpeed.download.toFixed(2)} <span>Mbps</span>
            </div>
            <div className={`percentage-change ${downloadChange >= 0 ? 'positive' : 'negative'}`}>
              {downloadChange >= 0 ? '↑' : '↓'} {Math.abs(downloadChange).toFixed(1)}%
            </div>
          </div>
        </div>

        <div className={`speed-card ${uploadStatus}`}>
          <div className="card-icon">
            <Upload size={32} />
          </div>
          <div className="card-content">
            <h3>Upload</h3>
            <div className="speed-value">
              {latestSpeed.upload.toFixed(2)} <span>Mbps</span>
            </div>
            <div className={`percentage-change ${uploadChange >= 0 ? 'positive' : 'negative'}`}>
              {uploadChange >= 0 ? '↑' : '↓'} {Math.abs(uploadChange).toFixed(1)}%
            </div>
          </div>
        </div>

        <div className={`speed-card ${pingStatus}`}>
          <div className="card-icon">
            <Activity size={32} />
          </div>
          <div className="card-content">
            <h3>Ping</h3>
            <div className="speed-value">
              {latestSpeed.ping >= 0 ? latestSpeed.ping.toFixed(0) : '-'} <span>ms</span>
            </div>
            {latestSpeed.ping >= 0 && (
              <div className={`percentage-change ${pingChange <= 0 ? 'positive' : 'negative'}`}>
                {pingChange <= 0 ? '↓' : '↑'} {Math.abs(pingChange).toFixed(1)}%
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Chart Section */}
      <div className="chart-section">
        <div className="chart-header">
          <h2>Performance History</h2>
          <div className="time-range-selector">
            <button
              className={timeRange === '1h' ? 'active' : ''}
              onClick={() => setTimeRange('1h')}
            >
              1H
            </button>
            <button
              className={timeRange === '6h' ? 'active' : ''}
              onClick={() => setTimeRange('6h')}
            >
              6H
            </button>
            <button
              className={timeRange === '24h' ? 'active' : ''}
              onClick={() => setTimeRange('24h')}
            >
              24H
            </button>
            <button
              className={timeRange === '7d' ? 'active' : ''}
              onClick={() => setTimeRange('7d')}
            >
              7D
            </button>
            <button
              className={timeRange === 'all' ? 'active' : ''}
              onClick={() => setTimeRange('all')}
            >
              All
            </button>
          </div>
        </div>

        {/* Data Usage Summary Box */}
        {chartData.length > 0 && (
          <div className="data-usage-summary">
            <div className="data-usage-title">
              <Activity size={18} />
              <span>Speedtest Data Usage ({timeRange.toUpperCase()})</span>
            </div>
            <div className="data-usage-stats">
              <div className="usage-stat">
                <Download size={16} />
                <div className="usage-details">
                  <span className="usage-label">Download</span>
                  <span className="usage-value">{dataUsage.download.value} {dataUsage.download.unit}</span>
                </div>
              </div>
              <div className="usage-stat">
                <Upload size={16} />
                <div className="usage-details">
                  <span className="usage-label">Upload</span>
                  <span className="usage-value">{dataUsage.upload.value} {dataUsage.upload.unit}</span>
                </div>
              </div>
              <div className="usage-stat total">
                <Activity size={16} />
                <div className="usage-details">
                  <span className="usage-label">Total Data</span>
                  <span className="usage-value">{dataUsage.total.value} {dataUsage.total.unit}</span>
                </div>
              </div>
              <div className="usage-stat">
                <Zap size={16} />
                <div className="usage-details">
                  <span className="usage-label">Tests Run</span>
                  <span className="usage-value">{dataUsage.testCount}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {chartData.length > 0 ? (
          <div className="charts-grid">
            {/* Download Speed Chart */}
            <div className="chart-item">
              <div className="chart-title-row">
                <h3 className="chart-title">
                  <Download size={18} />
                  Download Speed
                </h3>
                <div className="chart-stats">
                  <span className="stat-badge min">Min: {downloadStats.min.toFixed(2)}</span>
                  <span className="stat-badge avg">Avg: {downloadStats.avg.toFixed(2)}</span>
                  <span className="stat-badge max">Max: {downloadStats.max.toFixed(2)}</span>
                  <span className="stat-unit">Mbps</span>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.1)" />
                  <XAxis 
                    dataKey="time" 
                    stroke="#94a3b8" 
                    style={{ fontSize: '12px' }} 
                    ticks={xAxisTicks}
                    angle={-45}
                    textAnchor="end"
                    height={60}
                  />
                  <YAxis stroke="#94a3b8" style={{ fontSize: '12px' }} />
                  <Tooltip
                    contentStyle={{
                      background: 'rgba(0, 0, 0, 0.95)',
                      border: '1px solid rgba(6, 182, 212, 0.3)',
                      borderRadius: '10px',
                      color: '#e2e8f0'
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="download"
                    stroke="#06b6d4"
                    strokeWidth={2}
                    dot={{ fill: '#06b6d4', strokeWidth: 2, r: 4 }}
                    activeDot={{ r: 6 }}
                    name="Download (Mbps)"
                    connectNulls={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Upload Speed Chart */}
            <div className="chart-item">
              <div className="chart-title-row">
                <h3 className="chart-title">
                  <Upload size={18} />
                  Upload Speed
                </h3>
                <div className="chart-stats">
                  <span className="stat-badge min">Min: {uploadStats.min.toFixed(2)}</span>
                  <span className="stat-badge avg">Avg: {uploadStats.avg.toFixed(2)}</span>
                  <span className="stat-badge max">Max: {uploadStats.max.toFixed(2)}</span>
                  <span className="stat-unit">Mbps</span>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.1)" />
                  <XAxis 
                    dataKey="time" 
                    stroke="#94a3b8" 
                    style={{ fontSize: '12px' }} 
                    ticks={xAxisTicks}
                    angle={-45}
                    textAnchor="end"
                    height={60}
                  />
                  <YAxis stroke="#94a3b8" style={{ fontSize: '12px' }} />
                  <Tooltip
                    contentStyle={{
                      background: 'rgba(0, 0, 0, 0.95)',
                      border: '1px solid rgba(16, 185, 129, 0.3)',
                      borderRadius: '10px',
                      color: '#e2e8f0'
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="upload"
                    stroke="#10b981"
                    strokeWidth={2}
                    dot={{ fill: '#10b981', strokeWidth: 2, r: 4 }}
                    activeDot={{ r: 6 }}
                    name="Upload (Mbps)"
                    connectNulls={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Ping Chart */}
            <div className="chart-item">
              <div className="chart-title-row">
                <h3 className="chart-title">
                  <Activity size={18} />
                  Ping Latency
                </h3>
                <div className="chart-stats">
                  <span className="stat-badge min">Min: {pingStats.min.toFixed(0)}</span>
                  <span className="stat-badge avg">Avg: {pingStats.avg.toFixed(0)}</span>
                  <span className="stat-badge max">Max: {pingStats.max.toFixed(0)}</span>
                  <span className="stat-unit">ms</span>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.1)" />
                  <XAxis 
                    dataKey="time" 
                    stroke="#94a3b8" 
                    style={{ fontSize: '12px' }} 
                    ticks={xAxisTicks}
                    angle={-45}
                    textAnchor="end"
                    height={60}
                  />
                  <YAxis stroke="#94a3b8" style={{ fontSize: '12px' }} />
                  <Tooltip
                    contentStyle={{
                      background: 'rgba(0, 0, 0, 0.95)',
                      border: '1px solid rgba(245, 158, 11, 0.3)',
                      borderRadius: '10px',
                      color: '#e2e8f0'
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="ping"
                    stroke="#f59e0b"
                    strokeWidth={2}
                    dot={{ fill: '#f59e0b', strokeWidth: 2, r: 4 }}
                    activeDot={{ r: 6 }}
                    name="Ping (ms)"
                    connectNulls={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Jitter Chart */}
            <div className="chart-item">
              <div className="chart-title-row">
                <h3 className="chart-title">
                  <Activity size={18} />
                  Jitter
                </h3>
                <div className="chart-stats">
                  <span className="stat-badge min">Min: {jitterStats.min.toFixed(2)}</span>
                  <span className="stat-badge avg">Avg: {jitterStats.avg.toFixed(2)}</span>
                  <span className="stat-badge max">Max: {jitterStats.max.toFixed(2)}</span>
                  <span className="stat-unit">ms</span>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.1)" />
                  <XAxis 
                    dataKey="time" 
                    stroke="#94a3b8" 
                    style={{ fontSize: '12px' }} 
                    ticks={xAxisTicks}
                    angle={-45}
                    textAnchor="end"
                    height={60}
                  />
                  <YAxis stroke="#94a3b8" style={{ fontSize: '12px' }} />
                  <Tooltip
                    contentStyle={{
                      background: 'rgba(0, 0, 0, 0.95)',
                      border: '1px solid rgba(139, 92, 246, 0.3)',
                      borderRadius: '10px',
                      color: '#e2e8f0'
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="jitter"
                    stroke="#8b5cf6"
                    strokeWidth={2}
                    dot={{ fill: '#8b5cf6', strokeWidth: 2, r: 4 }}
                    activeDot={{ r: 6 }}
                    name="Jitter (ms)"
                    connectNulls={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Download Latency Chart */}
            <div className="chart-item">
              <div className="chart-title-row">
                <h3 className="chart-title">
                  <Clock size={18} />
                  Download Latency
                </h3>
                <div className="chart-stats">
                  <span className="stat-badge min">Min: {downloadLatencyStats.min.toFixed(0)}</span>
                  <span className="stat-badge avg">Avg: {downloadLatencyStats.avg.toFixed(0)}</span>
                  <span className="stat-badge max">Max: {downloadLatencyStats.max.toFixed(0)}</span>
                  <span className="stat-unit">ms</span>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.1)" />
                  <XAxis 
                    dataKey="time" 
                    stroke="#94a3b8" 
                    style={{ fontSize: '12px' }} 
                    ticks={xAxisTicks}
                    angle={-45}
                    textAnchor="end"
                    height={60}
                  />
                  <YAxis stroke="#94a3b8" style={{ fontSize: '12px' }} />
                  <Tooltip
                    contentStyle={{
                      background: 'rgba(0, 0, 0, 0.95)',
                      border: '1px solid rgba(6, 182, 212, 0.3)',
                      borderRadius: '10px',
                      color: '#e2e8f0'
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="downloadLatency"
                    stroke="#06b6d4"
                    strokeWidth={2}
                    dot={{ fill: '#06b6d4', strokeWidth: 2, r: 4 }}
                    activeDot={{ r: 6 }}
                    name="Download Latency (ms)"
                    connectNulls={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Upload Latency Chart */}
            <div className="chart-item">
              <div className="chart-title-row">
                <h3 className="chart-title">
                  <Clock size={18} />
                  Upload Latency
                </h3>
                <div className="chart-stats">
                  <span className="stat-badge min">Min: {uploadLatencyStats.min.toFixed(0)}</span>
                  <span className="stat-badge avg">Avg: {uploadLatencyStats.avg.toFixed(0)}</span>
                  <span className="stat-badge max">Max: {uploadLatencyStats.max.toFixed(0)}</span>
                  <span className="stat-unit">ms</span>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.1)" />
                  <XAxis 
                    dataKey="time" 
                    stroke="#94a3b8" 
                    style={{ fontSize: '12px' }} 
                    ticks={xAxisTicks}
                    angle={-45}
                    textAnchor="end"
                    height={60}
                  />
                  <YAxis stroke="#94a3b8" style={{ fontSize: '12px' }} />
                  <Tooltip
                    contentStyle={{
                      background: 'rgba(0, 0, 0, 0.95)',
                      border: '1px solid rgba(236, 72, 153, 0.3)',
                      borderRadius: '10px',
                      color: '#e2e8f0'
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="uploadLatency"
                    stroke="#ec4899"
                    strokeWidth={2}
                    dot={{ fill: '#ec4899', strokeWidth: 2, r: 4 }}
                    activeDot={{ r: 6 }}
                    name="Upload Latency (ms)"
                    connectNulls={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        ) : (
          <div className="no-data">
            <Activity size={48} />
            <p>No data available for {timeRange === '1h' ? 'the last hour' : timeRange === '6h' ? 'the last 6 hours' : timeRange === '24h' ? 'the last 24 hours' : timeRange === '7d' ? 'the last 7 days' : 'this time range'}</p>
            <p className="subtitle">
              {history.length === 0 
                ? 'Run a speed test or start monitoring to see results' 
                : `Try selecting a longer time range (${history.length} total results available)`}
            </p>
          </div>
        )}
      </div>

      {/* Statistics removed - now shown in charts */}

      {/* Host Details Modal */}
      {selectedHost && (
        <div className="modal-overlay" onClick={() => setSelectedHost(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">
                <TrendingUp size={24} />
                <h2>{selectedHost.name}</h2>
              </div>
              <div className="modal-actions">
                <button 
                  className="modal-refresh" 
                  onClick={() => {
                    setHostHistory([]);
                    setIsLoadingHistory(true);
                    // Trigger re-fetch by updating a timestamp
                    const fetchHostHistory = async () => {
                      try {
                        const response = await fetch(
                          `${BACKEND_URL}/api/live-monitoring-history/${encodeURIComponent(selectedHost.address)}?timeRange=${hostTimeRange}`
                        );
                        const data = await response.json();
                        if (data.history) {
                          const formattedHistory = data.history.map(item => {
                            const date = new Date(item.timestamp);
                            let timeLabel;
                            switch(hostTimeRange) {
                              case '15m':
                              case '30m':
                              case '1h':
                              case '6h':
                                timeLabel = format(date, 'HH:mm');
                                break;
                              case '24h':
                                timeLabel = format(date, 'HH:mm');
                                break;
                              case '7d':
                                timeLabel = format(date, 'MM/dd HH:mm');
                                break;
                              default:
                                timeLabel = format(date, 'HH:mm');
                            }
                            return {
              time: timeLabel,
                              ping: item.ping,
                              fullTime: format(date, 'MMM dd, yyyy HH:mm:ss')
                            };
                          });
                          setHostHistory(formattedHistory);
                        }
                      } catch (error) {
                        console.error('Error fetching host history:', error);
                        setHostHistory([]);
                      } finally {
                        setIsLoadingHistory(false);
                      }
                    };
                    fetchHostHistory();
                  }}
                  title="Refresh data"
                  disabled={isLoadingHistory}
                >
                  <RefreshCw size={20} className={isLoadingHistory ? 'spin' : ''} />
                </button>
                <button className="modal-close" onClick={() => setSelectedHost(null)}>
                  <X size={24} />
                </button>
              </div>
            </div>
            
            <div className="modal-body">
              <div className="host-details">
                <div className="detail-item">
                  <span className="detail-label">Address:</span>
                  <span className="detail-value">{selectedHost.address}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Current Ping:</span>
                  <span className="detail-value">
                    {liveMonitoring[selectedHost.address]?.ping > 0 
                      ? `${liveMonitoring[selectedHost.address].ping.toFixed(0)} ms` 
                      : 'Offline'}
                  </span>
                </div>
              </div>

              <div className="modal-chart-section">
                <div className="modal-chart-header">
                  <h3>Ping History</h3>
                  <div className="time-range-selector">
                    <button
                      className={hostTimeRange === '15m' ? 'active' : ''}
                      onClick={() => setHostTimeRange('15m')}
                    >
                      15M
                    </button>
                    <button
                      className={hostTimeRange === '30m' ? 'active' : ''}
                      onClick={() => setHostTimeRange('30m')}
                    >
                      30M
                    </button>
                    <button
                      className={hostTimeRange === '1h' ? 'active' : ''}
                      onClick={() => setHostTimeRange('1h')}
                    >
                      1H
                    </button>
                    <button
                      className={hostTimeRange === '6h' ? 'active' : ''}
                      onClick={() => setHostTimeRange('6h')}
                    >
                      6H
                    </button>
                    <button
                      className={hostTimeRange === '24h' ? 'active' : ''}
                      onClick={() => setHostTimeRange('24h')}
                    >
                      24H
                    </button>
                    <button
                      className={hostTimeRange === '7d' ? 'active' : ''}
                      onClick={() => setHostTimeRange('7d')}
                    >
                      7D
                    </button>
                  </div>
                </div>

                {(() => {
                  const hostStats = hostHistory.length > 0 ? {
                    min: Math.min(...hostHistory.map(h => h.ping)),
                    max: Math.max(...hostHistory.map(h => h.ping)),
                    avg: hostHistory.reduce((sum, h) => sum + h.ping, 0) / hostHistory.length
                  } : { min: 0, max: 0, avg: 0 };

                  // Calculate Y-axis domain: always start at -1 (offline), end at max ping or 100 (whichever is higher)
                  const yAxisDomain = [-1, Math.max(hostStats.max, 100)];

                  // Generate ticks for host history chart - ensure unique values
                  const generateHostXAxisTicks = () => {
                    const dataLength = hostHistory.length;
                    if (dataLength === 0) return [];
                    if (dataLength <= 30) {
                      return hostHistory.map((d, idx) => d.time);
                    }
                    const tickCount = Math.min(15, dataLength);
                    const step = Math.floor(dataLength / tickCount);
                    const ticks = [];
                    const indices = new Set(); // Track used indices to avoid duplicates
                    
                    for (let i = 0; i < dataLength; i += step) {
                      if (!indices.has(i)) {
                        indices.add(i);
                        ticks.push(hostHistory[i].time);
                      }
                    }
                    
                    // Add last point if not already included
                    const lastIndex = dataLength - 1;
                    if (!indices.has(lastIndex)) {
                      ticks.push(hostHistory[lastIndex].time);
                    }
                    
                    return ticks;
                  };

                  const hostXAxisTicks = generateHostXAxisTicks();

                  return (
                    <>
                      {hostHistory.length > 0 && (
                        <div className="chart-stats-row">
                          <span className="stat-badge min">Min: {hostStats.min.toFixed(0)} ms</span>
                          <span className="stat-badge avg">Avg: {hostStats.avg.toFixed(0)} ms</span>
                          <span className="stat-badge max">Max: {hostStats.max.toFixed(0)} ms</span>
                        </div>
                      )}
                      
                      <ResponsiveContainer width="100%" height={350}>
                        {isLoadingHistory ? (
                          <div className="no-data">
                            <Activity size={48} className="pulse-icon" />
                            <p>Loading history...</p>
                          </div>
                        ) : hostHistory.length > 0 ? (
                          <AreaChart data={hostHistory}>
                            <defs>
                              <linearGradient id="colorHostPing" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.8}/>
                                <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.1}/>
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.1)" />
                            <XAxis 
                              dataKey="time" 
                              stroke="#94a3b8" 
                              style={{ fontSize: '12px' }}
                              ticks={hostXAxisTicks}
                              angle={-45}
                              textAnchor="end"
                              height={60}
                            />
                            <YAxis 
                              stroke="#94a3b8" 
                              style={{ fontSize: '12px' }}
                              label={{ value: 'Ping (ms)', angle: -90, position: 'insideLeft', style: { fill: '#94a3b8' } }}
                              domain={yAxisDomain}
                            />
                            <Tooltip
                              contentStyle={{
                                background: 'rgba(0, 0, 0, 0.95)',
                                border: '1px solid rgba(6, 182, 212, 0.3)',
                                borderRadius: '10px',
                                color: '#e2e8f0'
                              }}
                            />
                            <Area
                              type="monotone"
                              dataKey="ping"
                              stroke="#06b6d4"
                              strokeWidth={3}
                              fillOpacity={1}
                              fill="url(#colorHostPing)"
                              name="Ping (ms)"
                            />
                          </AreaChart>
                        ) : (
                          <div className="no-data">
                            <Activity size={48} />
                            <p>No historical data available</p>
                            <p className="subtitle">Data will appear as monitoring continues</p>
                          </div>
                        )}
                      </ResponsiveContainer>
                    </>
                  );
                })()}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Dashboard;
