const express = require('express');
const cors = require('cors');
const WebSocket = require('ws');
const http = require('http');
const { exec } = require('child_process');
const util = require('util');
const fs = require('fs');
const ping = require('ping');
const schedule = require('node-schedule');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
require('dotenv').config();

const execPromise = util.promisify(exec);

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(cors());
app.use(express.json());

// Initialize SQLite database
// Check if running in Docker (data directory exists) or local development
const isDocker = process.env.NODE_ENV === 'production' || process.env.DOCKER_ENV === 'true';
const dbPath = isDocker && fs.existsSync(path.join(__dirname, 'data')) 
  ? path.join(__dirname, 'data', 'monitoring.db')
  : path.join(__dirname, 'monitoring.db');

// Create data directory if it doesn't exist (for Docker)
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new sqlite3.Database(dbPath);

// Promisify database operations
const dbRun = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
};

const dbGet = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

const dbAll = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

// Create tables
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS speed_tests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp TEXT NOT NULL,
      download REAL NOT NULL,
      upload REAL NOT NULL,
      ping REAL NOT NULL,
      jitter REAL,
      downloadLatency REAL,
      uploadLatency REAL,
      server TEXT,
      isp TEXT,
      result_url TEXT
    )
  `);

  // Add server and isp columns if they don't exist (migration for existing databases)
  db.run(`ALTER TABLE speed_tests ADD COLUMN server TEXT`, (err) => {
    if (err && !err.message.includes('duplicate column')) {
      console.error('Error adding server column:', err.message);
    }
  });
  
  db.run(`ALTER TABLE speed_tests ADD COLUMN isp TEXT`, (err) => {
    if (err && !err.message.includes('duplicate column')) {
      console.error('Error adding isp column:', err.message);
    }
  });
  
  db.run(`ALTER TABLE speed_tests ADD COLUMN result_url TEXT`, (err) => {
    if (err && !err.message.includes('duplicate column')) {
      console.error('Error adding result_url column:', err.message);
    }
  });

  db.run(`
    CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      testInterval INTEGER NOT NULL,
      pingHost TEXT NOT NULL,
      monitoringHosts TEXT NOT NULL,
      autoStart INTEGER NOT NULL,
      notifications INTEGER NOT NULL,
      minDownload REAL NOT NULL,
      minUpload REAL NOT NULL,
      maxPing REAL NOT NULL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS live_monitoring (
      address TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      ping REAL NOT NULL,
      timestamp TEXT NOT NULL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS live_monitoring_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      address TEXT NOT NULL,
      name TEXT NOT NULL,
      ping REAL NOT NULL,
      timestamp TEXT NOT NULL
    )
  `);

  // Create index for faster queries
  db.run(`
    CREATE INDEX IF NOT EXISTS idx_monitoring_history_address_timestamp 
    ON live_monitoring_history(address, timestamp)
  `);

  // Initialize settings if not exists
  const defaultHosts = JSON.stringify([
    { address: '8.8.8.8', name: 'Google DNS', enabled: true },
    { address: '1.1.1.1', name: 'Cloudflare DNS', enabled: true },
    { address: '208.67.222.222', name: 'OpenDNS', enabled: false }
  ]);

  db.run(`
    INSERT OR IGNORE INTO settings (id, testInterval, pingHost, monitoringHosts, autoStart, notifications, minDownload, minUpload, maxPing)
    VALUES (1, 30, '8.8.8.8', ?, 0, 1, 50, 10, 100)
  `, [defaultHosts]);
});

// Load settings from database
async function loadSettings() {
  const row = await dbGet('SELECT * FROM settings WHERE id = 1');
  if (!row) {
    return {
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
    };
  }
  
  return {
    testInterval: row.testInterval,
    pingHost: row.pingHost,
    monitoringHosts: JSON.parse(row.monitoringHosts),
    autoStart: row.autoStart === 1,
    notifications: row.notifications === 1,
    thresholds: {
      minDownload: row.minDownload,
      minUpload: row.minUpload,
      maxPing: row.maxPing
    }
  };
}

// Save settings to database
async function saveSettings(settings) {
  await dbRun(`
    UPDATE settings 
    SET testInterval = ?, 
        pingHost = ?, 
        monitoringHosts = ?,
        autoStart = ?,
        notifications = ?,
        minDownload = ?,
        minUpload = ?,
        maxPing = ?
    WHERE id = 1
  `, [
    settings.testInterval,
    settings.pingHost,
    JSON.stringify(settings.monitoringHosts),
    settings.autoStart ? 1 : 0,
    settings.notifications ? 1 : 0,
    settings.thresholds.minDownload,
    settings.thresholds.minUpload,
    settings.thresholds.maxPing
  ]);
}

// Load history from database
async function loadHistory(limit = 100) {
  const rows = await dbAll(`
    SELECT * FROM speed_tests 
    ORDER BY timestamp DESC 
    LIMIT ?
  `, [limit]);
  
  return rows.reverse();
}

// Save speed test to database
async function saveSpeedTest(result) {
  await dbRun(`
    INSERT INTO speed_tests (timestamp, download, upload, ping, jitter, downloadLatency, uploadLatency, server, isp, result_url)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    result.timestamp,
    result.download,
    result.upload,
    result.ping,
    result.jitter || null,
    result.downloadLatency || null,
    result.uploadLatency || null,
    result.server || null,
    result.isp || null,
    result.resultUrl || null
  ]);
}

// Save live monitoring to database
async function saveLiveMonitoring(address, data) {
  // Update current state
  await dbRun(`
    INSERT OR REPLACE INTO live_monitoring (address, name, ping, timestamp)
    VALUES (?, ?, ?, ?)
  `, [address, data.name, data.ping, data.timestamp]);
  
  // Save to history
  await dbRun(`
    INSERT INTO live_monitoring_history (address, name, ping, timestamp)
    VALUES (?, ?, ?, ?)
  `, [address, data.name, data.ping, data.timestamp]);
}

// Load live monitoring from database
async function loadLiveMonitoring() {
  const rows = await dbAll('SELECT * FROM live_monitoring');
  
  const liveMonitoring = {};
  rows.forEach(row => {
    liveMonitoring[row.address] = {
      address: row.address,
      name: row.name,
      ping: row.ping,
      timestamp: row.timestamp
    };
  });
  
  return liveMonitoring;
}

// Store monitoring data (in-memory for current state)
let monitoringData = {
  currentSpeed: { download: 0, upload: 0, ping: 0 },
  history: [],
  isMonitoring: true, // Always monitoring
  liveMonitoring: {},
  settings: {
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
  }
};

// Initialize data from database
async function initializeData() {
  monitoringData.settings = await loadSettings();
  monitoringData.history = await loadHistory(100);
  monitoringData.liveMonitoring = await loadLiveMonitoring();
  console.log('Database loaded successfully');
}

let monitoringInterval = null;
let scheduledJob = null;

// WebSocket connections
const clients = new Set();

wss.on('connection', (ws) => {
  console.log('Client connected');
  clients.add(ws);
  
  // Send current data to new client
  ws.send(JSON.stringify({
    type: 'initial',
    data: monitoringData
  }));

  ws.on('close', () => {
    console.log('Client disconnected');
    clients.delete(ws);
  });
});

// Broadcast to all connected clients
function broadcast(data) {
  clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(data));
    }
  });
}

// Perform ping test
async function performPing(host = '8.8.8.8') {
  try {
    const res = await ping.promise.probe(host, {
      timeout: 10,
      min_reply: 1,
      extra: ['-n', '1'] // Windows-specific: send only 1 packet
    });
    
    console.log(`Ping ${host}: alive=${res.alive}, time=${res.time}`);
    
    if (res.alive && res.time !== 'unknown') {
      const pingTime = parseFloat(res.time);
      return isNaN(pingTime) ? -1 : pingTime;
    }
    return -1;
  } catch (error) {
    console.error(`Ping error for ${host}:`, error.message);
    return -1;
  }
}

// Perform speed test with timeout and retry using Ookla CLI
async function performSpeedTest(retryCount = 0) {
  const MAX_RETRIES = 3;
  const TIMEOUT = 90000; // 90 seconds timeout
  const RETRY_DELAY = 10000; // 10 seconds between retries
  
  try {
    console.log(`Starting Ookla CLI speed test... (attempt ${retryCount + 1}/${MAX_RETRIES + 1})`);
    
    // Create a promise that rejects after timeout
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Speed test timeout after 90 seconds')), TIMEOUT);
    });
    
    // Run Ookla Speedtest CLI with JSON output
    const speedtestCommand = process.platform === 'win32' 
      ? 'speedtest --accept-license --accept-gdpr --format=json'
      : 'speedtest --accept-license --accept-gdpr --format=json';
    
    const { stdout, stderr } = await Promise.race([
      execPromise(speedtestCommand),
      timeoutPromise
    ]);
    
    if (stderr && !stderr.includes('Speedtest')) {
      console.warn('Speed test stderr:', stderr);
    }
    
    // Parse JSON output
    const result = JSON.parse(stdout);
    
    // Log full result structure for debugging
    console.log('Full Ookla CLI result structure:', JSON.stringify(result, null, 2));
    
    // Extract latency values from Ookla CLI JSON
    // Ookla CLI provides: download.latency.iqm, download.latency.low, download.latency.high, download.latency.jitter
    let downloadLatency = 0;
    if (result.download?.latency) {
      downloadLatency = result.download.latency.iqm || 
                       result.download.latency.high || 
                       result.download.latency.low || 
                       0;
    }
    
    let uploadLatency = 0;
    if (result.upload?.latency) {
      uploadLatency = result.upload.latency.iqm || 
                     result.upload.latency.high || 
                     result.upload.latency.low || 
                     0;
    }
    
    // Extract jitter from download or ping
    const jitter = result.download?.latency?.jitter || 
                   result.ping?.jitter || 
                   0;
    
    const testResult = {
      timestamp: new Date().toISOString(),
      download: parseFloat((result.download.bandwidth / 125000).toFixed(2)), // Convert to Mbps (bits/s to Mbps)
      upload: parseFloat((result.upload.bandwidth / 125000).toFixed(2)),
      ping: parseFloat(result.ping.latency.toFixed(2)),
      jitter: parseFloat(jitter.toFixed(2)),
      downloadLatency: parseFloat(downloadLatency.toFixed(2)),
      uploadLatency: parseFloat(uploadLatency.toFixed(2)),
      server: result.server?.name || 'Unknown',
      isp: result.isp || 'Unknown',
      resultUrl: result.result?.url || null
    };
    
    console.log('✅ Speed test details:', {
      ping: testResult.ping,
      jitter: testResult.jitter,
      downloadLatency: testResult.downloadLatency,
      uploadLatency: testResult.uploadLatency,
      downloadLatencyFull: result.download?.latency,
      uploadLatencyFull: result.upload?.latency,
      note: downloadLatency === 0 && uploadLatency === 0 ? 
        '⚠️  NOTE: Latency values are 0 - Ookla server may not provide detailed latency metrics' : 
        '✅ Detailed latency data retrieved successfully'
    });

    // Save to database
    await saveSpeedTest(testResult);
    
    // Update in-memory data
    monitoringData.currentSpeed = {
      download: testResult.download,
      upload: testResult.upload,
      ping: testResult.ping
    };
    
    monitoringData.history.push(testResult);
    
    // Keep only last 100 records in memory
    if (monitoringData.history.length > 100) {
      monitoringData.history.shift();
    }

    broadcast({ type: 'speedtest', data: testResult });
    console.log('✅ Speed test completed successfully:', testResult);
    return testResult;
    
  } catch (error) {
    const errorType = error.message.includes('timeout') ? 'Timeout' : 
                     error.message.includes('write') || error.message.includes('socket') ? 'Network Connection' :
                     error.message.includes('ENOTFOUND') ? 'DNS Resolution' : 'Unknown';
    
    console.error(`Speed test error (attempt ${retryCount + 1}/${MAX_RETRIES + 1}) [${errorType}]:`, error.message);
    
    // Retry if we haven't exceeded max retries
    if (retryCount < MAX_RETRIES) {
      const delay = RETRY_DELAY * (retryCount + 1); // Progressive delay: 10s, 20s, 30s
      console.log(`Retrying speed test in ${delay / 1000} seconds...`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return performSpeedTest(retryCount + 1);
    }
    
    // If all retries failed, return error result
    const errorResult = {
      timestamp: new Date().toISOString(),
      download: 0,
      upload: 0,
      ping: 0,
      jitter: 0,
      downloadLatency: 0,
      uploadLatency: 0,
      error: `Speed test failed after ${MAX_RETRIES + 1} attempts (${errorType}): ${error.message.substring(0, 100)}`
    };
    
    console.log('⚠️  All speed test attempts failed. Network issues or Speedtest servers may be unavailable.');
    console.log('💡 Tip: Check your internet connection and firewall settings.');
    
    // Save failed test to database for tracking
    await saveSpeedTest(errorResult);
    broadcast({ type: 'speedtest', data: errorResult });
    
    return errorResult;
  }
}

// Perform quick ping monitoring
async function performQuickMonitor() {
  const hosts = monitoringData.settings.monitoringHosts || [];
  const enabledHosts = hosts.filter(h => h.enabled);
  
  if (enabledHosts.length === 0) {
    console.log('No enabled hosts for monitoring');
    return [];
  }
  
  console.log(`Monitoring ${enabledHosts.length} hosts...`);
  
  // Ping all enabled hosts
  const pingPromises = enabledHosts.map(async (host) => {
    const pingResult = await performPing(host.address);
    return {
      address: host.address,
      name: host.name,
      ping: pingResult,
      timestamp: new Date().toISOString()
    };
  });
  
  const results = await Promise.all(pingPromises);
  
  // Update live monitoring data
  results.forEach(result => {
    monitoringData.liveMonitoring[result.address] = result;
    saveLiveMonitoring(result.address, result);
    console.log(`Updated ${result.name} (${result.address}): ${result.ping}ms`);
  });
  
  // Use the primary host for current speed
  const primaryPing = results[0]?.ping || -1;
  monitoringData.currentSpeed.ping = primaryPing;
  
  broadcast({ type: 'liveMonitoring', data: monitoringData.liveMonitoring });
  return results;
}

// Start monitoring (always runs)
async function startMonitoring() {
  console.log('=== Monitoring started ===');

  console.log('Enabled hosts:', monitoringData.settings.monitoringHosts.filter(h => h.enabled).map(h => h.name));

  // Run first ping immediately
  await performQuickMonitor();

  // Quick ping every 5 seconds
  if (monitoringInterval) {
    clearInterval(monitoringInterval);
  }
  
  monitoringInterval = setInterval(async () => {
    try {
      await performQuickMonitor();
    } catch (error) {
      console.error('Quick monitor error:', error.message);
      // Continue monitoring even if one cycle fails
    }
  }, 5000);

  // Schedule full speed tests
  const interval = monitoringData.settings.testInterval;
  
  if (scheduledJob) {
    scheduledJob.cancel();
  }
  
  scheduledJob = schedule.scheduleJob(`*/${interval} * * * *`, async () => {
    try {
      console.log('\n🔄 Running scheduled speed test...');
      const result = await performSpeedTest();
      if (result.error) {
        console.log('⚠️  Scheduled speed test completed with errors. Will retry on next schedule.');
      } else {
        console.log('✅ Scheduled speed test completed successfully.');
      }
    } catch (error) {
      console.error('❌ Scheduled speed test failed:', error.message);
      // Don't crash the monitoring, just log the error
    }
  });

  console.log(`Scheduled speed tests every ${interval} minutes`);
  broadcast({ type: 'status', isMonitoring: true });
}

// Restart monitoring (used when settings change)
async function restartMonitoring() {
  console.log('Restarting monitoring with new settings...');
  
  if (monitoringInterval) {
    clearInterval(monitoringInterval);
    monitoringInterval = null;
  }
  
  if (scheduledJob) {
    scheduledJob.cancel();
    scheduledJob = null;
  }
  
  await startMonitoring();
}

// API Routes

// Get current status
app.get('/api/status', (req, res) => {
  res.json({
    isMonitoring: monitoringData.isMonitoring,
    currentSpeed: monitoringData.currentSpeed,
    historyCount: monitoringData.history.length,
    liveMonitoring: monitoringData.liveMonitoring
  });
});

// Get history
app.get('/api/history', async (req, res) => {
  const limit = parseInt(req.query.limit) || 100;
  const history = await loadHistory(limit);
  res.json(history);
});

// Run immediate speed test
app.post('/api/test', async (req, res) => {
  try {
    const result = await performSpeedTest();
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Run immediate ping test
app.post('/api/ping', async (req, res) => {
  try {
    const { host } = req.body;
    const result = await performPing(host || monitoringData.settings.pingHost);
    res.json({ ping: result, timestamp: new Date().toISOString() });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get settings
app.get('/api/settings', (req, res) => {
  res.json(monitoringData.settings);
});

// Get next scheduled test time
app.get('/api/next-test', (req, res) => {
  if (!scheduledJob || !monitoringData.isMonitoring) {
    return res.json({ nextRun: null, interval: monitoringData.settings.testInterval });
  }
  
  const nextInvocation = scheduledJob.nextInvocation();
  res.json({ 
    nextRun: nextInvocation ? nextInvocation.toISOString() : null,
    interval: monitoringData.settings.testInterval
  });
});

// Get live monitoring history for a specific host
app.get('/api/live-monitoring-history/:address', async (req, res) => {
  try {
    const { address } = req.params;
    const { timeRange = '1h' } = req.query;
    
    // Calculate cutoff time based on range
    const now = new Date();
    let cutoffTime;
    switch (timeRange) {
      case '15m':
        cutoffTime = new Date(now.getTime() - 15 * 60 * 1000);
        break;
      case '30m':
        cutoffTime = new Date(now.getTime() - 30 * 60 * 1000);
        break;
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
      default:
        cutoffTime = new Date(now.getTime() - 60 * 60 * 1000);
    }
    
    const rows = await dbAll(`
      SELECT address, name, ping, timestamp 
      FROM live_monitoring_history 
      WHERE address = ? AND datetime(timestamp) >= datetime(?)
      ORDER BY timestamp ASC
    `, [address, cutoffTime.toISOString()]);
    
    res.json({ history: rows });
  } catch (error) {
    console.error('Error getting live monitoring history:', error);
    res.status(500).json({ error: 'Failed to get monitoring history' });
  }
});

// Update settings
app.post('/api/settings', async (req, res) => {
  monitoringData.settings = { ...monitoringData.settings, ...req.body };
  saveSettings(monitoringData.settings);
  
  // Restart monitoring with new settings
  await restartMonitoring();
  
  broadcast({ type: 'settings', data: monitoringData.settings });
  res.json(monitoringData.settings);
});

// Clear history
app.delete('/api/history', async (req, res) => {
  await dbRun('DELETE FROM speed_tests');
  monitoringData.history = [];
  broadcast({ type: 'historyCleared' });
  res.json({ message: 'History cleared' });
});

const PORT = process.env.PORT || 5000;

server.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);
  console.log('WebSocket server ready');
  console.log('Database initialized at:', dbPath);
  
  // Load data from database
  await initializeData();
  
  // Always start monitoring
  console.log('Starting monitoring automatically...');
  await startMonitoring();
});

// Clean up old live monitoring history (keep last 7 days)
async function cleanupOldMonitoringHistory() {
  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    await dbRun(`
      DELETE FROM live_monitoring_history 
      WHERE datetime(timestamp) < datetime(?)
    `, [sevenDaysAgo]);
    console.log('Cleaned up old monitoring history');
  } catch (error) {
    console.error('Error cleaning up monitoring history:', error);
  }
}

// Schedule cleanup to run daily at 3 AM
schedule.scheduleJob('0 3 * * *', cleanupOldMonitoringHistory);

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('Shutting down gracefully...');
  db.close();
  process.exit(0);
});
