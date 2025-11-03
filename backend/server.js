const express = require('express');
const cors = require('cors');
const WebSocket = require('ws');
const http = require('http');
const { exec } = require('child_process');
const util = require('util');
const fs = require('fs');
const ping = require('ping');
const schedule = require('node-schedule');
const Database = require('better-sqlite3'); // Phase 2: Using better-sqlite3 for 5x performance
const path = require('path');
const axios = require('axios');
const logger = require('./logger');
const compression = require('compression'); // Phase 3: HTTP response compression
const NodeCache = require('node-cache'); // Phase 3: Query result caching
require('dotenv').config();

const execPromise = util.promisify(exec);

const app = express();
const server = http.createServer(app);

// Phase 3: WebSocket with compression enabled
const wss = new WebSocket.Server({ 
  server,
  perMessageDeflate: {
    zlibDeflateOptions: {
      chunkSize: 1024,
      memLevel: 7,
      level: 3  // Balance between speed and compression ratio
    },
    zlibInflateOptions: {
      chunkSize: 10 * 1024
    },
    clientNoContextTakeover: true,
    serverNoContextTakeover: true,
    serverMaxWindowBits: 10,
    concurrencyLimit: 10,
    threshold: 1024  // Only compress messages larger than 1KB
  }
});

// Phase 3: Query result cache
const queryCache = new NodeCache({
  stdTTL: 60,  // 60 second default TTL
  checkperiod: 120,  // Check for expired keys every 2 minutes
  useClones: false  // Don't clone objects for better performance
});

logger.info('✓ Query cache initialized (60s TTL)');

app.use(cors());
app.use(express.json());

// Phase 3: HTTP response compression
app.use(compression({
  level: 6,  // zlib compression level (0-9)
  threshold: 1024,  // Only compress responses larger than 1KB
  filter: (req, res) => {
    // Don't compress if client explicitly disables it
    if (req.headers['x-no-compression']) {
      return false;
    }
    // Use compression middleware's default filter
    return compression.filter(req, res);
  }
}));

logger.info('✓ HTTP compression enabled (gzip/deflate)');

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

// Phase 2: Initialize better-sqlite3 (synchronous, faster)
const db = new Database(dbPath);
db.pragma('journal_mode = WAL'); // Write-Ahead Logging for better concurrency
db.pragma('synchronous = NORMAL'); // Faster writes, still safe
db.pragma('cache_size = -64000'); // 64MB cache

logger.info('✓ Database initialized with better-sqlite3');

// Phase 2: Async wrappers for better-sqlite3 (maintains compatibility with async/await code)
const dbRun = async (sql, params = []) => {
  try {
    const stmt = db.prepare(sql);
    const result = stmt.run(...params);
    return { lastID: result.lastInsertRowid, changes: result.changes };
  } catch (err) {
    logger.error('dbRun error:', err.message);
    throw err;
  }
};

const dbGet = async (sql, params = []) => {
  try {
    const stmt = db.prepare(sql);
    return stmt.get(...params);
  } catch (err) {
    logger.error('dbGet error:', err.message);
    throw err;
  }
};

const dbAll = async (sql, params = []) => {
  try {
    const stmt = db.prepare(sql);
    return stmt.all(...params);
  } catch (err) {
    logger.error('dbAll error:', err.message);
    throw err;
  }
};

// Phase 3: Cached query wrapper for performance
async function cachedQuery(cacheKey, ttl, queryFn) {
  // Check cache first
  const cached = queryCache.get(cacheKey);
  if (cached !== undefined) {
    logger.debug(`[CACHE HIT] ${cacheKey}`);
    return cached;
  }
  
  // Cache miss - execute query
  logger.debug(`[CACHE MISS] ${cacheKey}`);
  const result = await queryFn();
  
  // Store in cache with TTL
  queryCache.set(cacheKey, result, ttl);
  return result;
}

// Phase 3: Cache invalidation helpers
function invalidateHistoryCache() {
  const keys = queryCache.keys().filter(k => k.startsWith('history:'));
  keys.forEach(key => queryCache.del(key));
  if (keys.length > 0) {
    logger.debug(`[CACHE] Invalidated ${keys.length} history cache entries`);
  }
}

function invalidateSettingsCache() {
  queryCache.del('settings');
  logger.debug('[CACHE] Invalidated settings cache');
}

function invalidateMonitoringCache() {
  const keys = queryCache.keys().filter(k => k.startsWith('monitoring:'));
  keys.forEach(key => queryCache.del(key));
  if (keys.length > 0) {
    logger.debug(`[CACHE] Invalidated ${keys.length} monitoring cache entries`);
  }
}

// Create tables (better-sqlite3 uses synchronous exec())
(() => {
  // Create speed_tests table
  db.exec(`
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

  // Add columns if they don't exist (migration for existing databases)
  try {
    db.exec(`ALTER TABLE speed_tests ADD COLUMN server TEXT`);
  } catch (err) {
    if (!err.message.includes('duplicate column')) {
      logger.error('Error adding server column:', err.message);
    }
  }
  
  try {
    db.exec(`ALTER TABLE speed_tests ADD COLUMN isp TEXT`);
  } catch (err) {
    if (!err.message.includes('duplicate column')) {
      logger.error('Error adding isp column:', err.message);
    }
  }
  
  try {
    db.exec(`ALTER TABLE speed_tests ADD COLUMN result_url TEXT`);
  } catch (err) {
    if (!err.message.includes('duplicate column')) {
      logger.error('Error adding result_url column:', err.message);
    }
  }

  // Create settings table
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      testInterval INTEGER NOT NULL,
      monitorInterval INTEGER DEFAULT 5,
      pingHost TEXT NOT NULL,
      monitoringHosts TEXT NOT NULL,
      autoStart INTEGER NOT NULL,
      notifications INTEGER NOT NULL,
      minDownload REAL NOT NULL,
      minUpload REAL NOT NULL,
      maxPing REAL NOT NULL,
      notificationSettings TEXT
    )
  `);

  // Add notificationSettings column if it doesn't exist (migration)
  try {
    db.exec(`ALTER TABLE settings ADD COLUMN notificationSettings TEXT`);
  } catch (err) {
    if (!err.message.includes('duplicate column')) {
      logger.error('Error adding notificationSettings column:', err.message);
    }
  }

  // Add monitorInterval column if it doesn't exist (migration)
  try {
    db.exec(`ALTER TABLE settings ADD COLUMN monitorInterval INTEGER DEFAULT 5`);
  } catch (err) {
    if (!err.message.includes('duplicate column')) {
      logger.error('Error adding monitorInterval column:', err.message);
    }
  }

  // Add logLevel column if it doesn't exist (migration)
  try {
    db.exec(`ALTER TABLE settings ADD COLUMN logLevel TEXT DEFAULT 'INFO'`);
  } catch (err) {
    if (!err.message.includes('duplicate column')) {
      logger.error('Error adding logLevel column:', err.message);
    }
  }

  // Add downloadBytes and uploadBytes columns if they don't exist (migration)
  try {
    db.exec(`ALTER TABLE speed_tests ADD COLUMN downloadBytes INTEGER`);
  } catch (err) {
    if (!err.message.includes('duplicate column')) {
      logger.error('Error adding downloadBytes column:', err.message);
    }
  }

  try {
    db.exec(`ALTER TABLE speed_tests ADD COLUMN uploadBytes INTEGER`);
  } catch (err) {
    if (!err.message.includes('duplicate column')) {
      logger.error('Error adding uploadBytes column:', err.message);
    }
  }

  // Add monthlyDataCap column to settings if it doesn't exist (migration)
  try {
    db.exec(`ALTER TABLE settings ADD COLUMN monthlyDataCap TEXT DEFAULT NULL`);
  } catch (err) {
    if (!err.message.includes('duplicate column')) {
      logger.error('Error adding monthlyDataCap column:', err.message);
    }
  }

  // Create live_monitoring table
  db.exec(`
    CREATE TABLE IF NOT EXISTS live_monitoring (
      address TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      ping REAL NOT NULL,
      timestamp TEXT NOT NULL
    )
  `);

  // Create live_monitoring_history table
  db.exec(`
    CREATE TABLE IF NOT EXISTS live_monitoring_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      address TEXT NOT NULL,
      name TEXT NOT NULL,
      ping REAL NOT NULL,
      timestamp TEXT NOT NULL
    )
  `);

  // Create indexes for faster queries (Phase 1 Optimization)
  try {
    db.exec(`CREATE INDEX IF NOT EXISTS idx_speed_tests_timestamp ON speed_tests(timestamp DESC)`);
    logger.debug('✓ Index created: idx_speed_tests_timestamp');
  } catch (err) {
    // Index already exists
  }

  try {
    db.exec(`CREATE INDEX IF NOT EXISTS idx_live_monitoring_address ON live_monitoring(address)`);
    logger.debug('✓ Index created: idx_live_monitoring_address');
  } catch (err) {
    // Index already exists
  }

  try {
    db.exec(`CREATE INDEX IF NOT EXISTS idx_monitoring_history_address_timestamp ON live_monitoring_history(address, timestamp DESC)`);
    logger.debug('✓ Index created: idx_monitoring_history_address_timestamp');
  } catch (err) {
    // Index already exists
  }

  try {
    db.exec(`CREATE INDEX IF NOT EXISTS idx_monitoring_history_timestamp ON live_monitoring_history(timestamp)`);
    logger.debug('✓ Index created: idx_monitoring_history_timestamp');
  } catch (err) {
    // Index already exists
  }

  // Initialize settings if not exists
  const defaultHosts = JSON.stringify([
    { address: '8.8.8.8', name: 'Google DNS', enabled: true },
    { address: '1.1.1.1', name: 'Cloudflare DNS', enabled: true },
    { address: '208.67.222.222', name: 'OpenDNS', enabled: false }
  ]);

  try {
    const stmt = db.prepare(`
      INSERT OR IGNORE INTO settings (id, testInterval, pingHost, monitoringHosts, autoStart, notifications, minDownload, minUpload, maxPing)
      VALUES (1, 30, '8.8.8.8', ?, 0, 1, 50, 10, 100)
    `);
    stmt.run(defaultHosts);
  } catch (err) {
    logger.error('Error initializing settings:', err.message);
  }
})();

// Settings cache (Phase 1 Optimization)
const settingsCache = {
  data: null,
  timestamp: 0,
  TTL: 60000 // Cache for 60 seconds
};

// Invalidate settings cache
function invalidateSettingsCache() {
  settingsCache.data = null;
  settingsCache.timestamp = 0;
  logger.debug('✓ Settings cache invalidated');
}

// Load settings from database with caching
async function loadSettings(forceRefresh = false) {
  const now = Date.now();
  
  // Return cached settings if fresh and not forcing refresh
  if (!forceRefresh && settingsCache.data && (now - settingsCache.timestamp) < settingsCache.TTL) {
    logger.debug('✓ Using cached settings');
    return settingsCache.data;
  }
  
  const row = await dbGet('SELECT * FROM settings WHERE id = 1');
  
  const defaultNotificationSettings = {
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
      onHostUp: true,
      onConnectionLost: true,
      onConnectionRestored: true,
      onHighLatency: false,
      onPacketLoss: false
    },
    minTimeBetweenNotifications: 5,
    quietHoursEnabled: false,
    quietHoursStart: '22:00',
    quietHoursEnd: '08:00'
  };
  
  if (!row) {
    return {
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
      notificationSettings: defaultNotificationSettings,
      thresholds: {
        minDownload: 50,
        minUpload: 10,
        maxPing: 100
      },
      logLevel: 'DEBUG',  // Default log level (DEBUG shows all monitoring logs)
      monthlyDataCap: null  // No cap by default (e.g., "5 GB" or "1 TB")
    };
  }
  
  let notificationSettings = defaultNotificationSettings;
  if (row.notificationSettings) {
    try {
      notificationSettings = JSON.parse(row.notificationSettings);
    } catch (e) {
      logger.error('Error parsing notificationSettings:', e);
    }
  }
  
  const loadedSettings = {
    testInterval: row.testInterval,
    monitorInterval: row.monitorInterval || 5,
    pingHost: row.pingHost,
    monitoringHosts: JSON.parse(row.monitoringHosts),
    autoStart: row.autoStart === 1,
    notifications: row.notifications === 1,
    notificationSettings: notificationSettings,
    thresholds: {
      minDownload: row.minDownload,
      minUpload: row.minUpload,
      maxPing: row.maxPing
    },
    logLevel: row.logLevel || 'DEBUG',
    monthlyDataCap: row.monthlyDataCap || null
  };
  
  // Update cache
  settingsCache.data = loadedSettings;
  settingsCache.timestamp = now;
  logger.debug('✓ Settings loaded and cached');
  
  return loadedSettings;
}

// Save settings to database
async function saveSettings(settings) {
  // Invalidate cache when settings are saved
  invalidateSettingsCache();
  await dbRun(`
    UPDATE settings 
    SET testInterval = ?, 
        monitorInterval = ?,
        pingHost = ?, 
        monitoringHosts = ?,
        autoStart = ?,
        notifications = ?,
        notificationSettings = ?,
        minDownload = ?,
        minUpload = ?,
        maxPing = ?,
        logLevel = ?,
        monthlyDataCap = ?
    WHERE id = 1
  `, [
    settings.testInterval,
    settings.monitorInterval || 5,
    settings.pingHost,
    JSON.stringify(settings.monitoringHosts),
    settings.autoStart ? 1 : 0,
    settings.notifications ? 1 : 0,
    JSON.stringify(settings.notificationSettings || {}),
    settings.thresholds.minDownload,
    settings.thresholds.minUpload,
    settings.thresholds.maxPing,
    settings.logLevel || 'INFO',
    settings.monthlyDataCap || null
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

// Parse data cap string (e.g., "5 GB", "1 TB") to bytes
function parseDataCapToBytes(capString) {
  if (!capString) return null;
  
  const match = capString.trim().match(/^(\d+(?:\.\d+)?)\s*(KB|MB|GB|TB|PB)$/i);
  if (!match) return null;
  
  const value = parseFloat(match[1]);
  const unit = match[2].toUpperCase();
  
  const multipliers = {
    'KB': 1024,
    'MB': 1024 * 1024,
    'GB': 1024 * 1024 * 1024,
    'TB': 1024 * 1024 * 1024 * 1024,
    'PB': 1024 * 1024 * 1024 * 1024 * 1024
  };
  
  return value * multipliers[unit];
}

// Check if monthly data cap has been reached
async function isMonthlyDataCapReached() {
  const settings = await loadSettings();
  if (!settings.monthlyDataCap) return false;
  
  const capInBytes = parseDataCapToBytes(settings.monthlyDataCap);
  if (!capInBytes) return false;
  
  // Get first and last day of current month
  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  
  // Query total bytes used this month
  const result = await dbGet(`
    SELECT 
      COALESCE(SUM(downloadBytes), 0) + COALESCE(SUM(uploadBytes), 0) as totalBytes
    FROM speed_tests
    WHERE timestamp >= ? AND timestamp <= ?
  `, [firstDay.toISOString(), lastDay.toISOString()]);
  
  const usedBytes = result.totalBytes || 0;
  logger.debug(`Monthly data usage: ${usedBytes} / ${capInBytes} bytes`);
  
  return usedBytes >= capInBytes;
}

// Save speed test to database
async function saveSpeedTest(result) {
  await dbRun(`
    INSERT INTO speed_tests (timestamp, download, upload, ping, jitter, downloadLatency, uploadLatency, server, isp, result_url, downloadBytes, uploadBytes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
    result.resultUrl || null,
    result.downloadBytes || null,
    result.uploadBytes || null
  ]);
  
  // Phase 3: Invalidate history cache when new test added
  invalidateHistoryCache();
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

// Notification state tracking
const notificationState = {
  hostStatus: {}, // Track previous status of each host { 'address': { isDown: bool, lastNotificationTime: timestamp } }
  lastThresholdBreach: null,
  lastConnectionLost: null,
  lastHighLatency: null,
  lastPacketLoss: null
};

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
  
  // Apply log level from settings
  if (monitoringData.settings.logLevel) {
    logger.setLevel(monitoringData.settings.logLevel);
  }
  
  monitoringData.history = await loadHistory(1000);
  monitoringData.liveMonitoring = await loadLiveMonitoring();
  logger.success('Database loaded successfully');
}

let monitoringInterval = null;
let scheduledJob = null;

// WebSocket connections
const clients = new Set();

// Register logger listener for WebSocket broadcasting
logger.setWebSocketListener((logEntry) => {
  // Broadcast log to all connected WebSocket clients
  clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      try {
        client.send(JSON.stringify({
          type: 'console_log',
          log: logEntry
        }));
      } catch (error) {
        logger.error('Error sending console log to client:', error.message);
      }
    }
  });
});

wss.on('connection', (ws) => {
  logger.debug('Client connected');
  clients.add(ws);
  
  // Send current data to new client
  ws.send(JSON.stringify({
    type: 'initial',
    data: monitoringData
  }));

  // Send log buffer on connection
  const logBuffer = logger.getLogBuffer();
  if (logBuffer.length > 0) {
    ws.send(JSON.stringify({
      type: 'console_buffer',
      logs: logBuffer
    }));
  }

  ws.on('close', () => {
    logger.debug('Client disconnected');
    clients.delete(ws);
  });
});

// Broadcast to all connected clients
// Phase 2: WebSocket message batching for better performance
let messageQueue = [];
let batchTimer = null;
const BATCH_INTERVAL = 100; // milliseconds
const BATCH_SIZE_LIMIT = 50; // max messages per batch

function queueMessage(data) {
  // Don't batch initial data or critical updates
  const noBatchTypes = ['initial', 'status', 'settings'];
  if (noBatchTypes.includes(data.type)) {
    return broadcastImmediate(data);
  }
  
  messageQueue.push(data);
  
  // Flush if queue is full
  if (messageQueue.length >= BATCH_SIZE_LIMIT) {
    flushMessageQueue();
    return;
  }
  
  // Schedule batch send
  if (!batchTimer) {
    batchTimer = setTimeout(flushMessageQueue, BATCH_INTERVAL);
  }
}

function flushMessageQueue() {
  if (batchTimer) {
    clearTimeout(batchTimer);
    batchTimer = null;
  }
  
  if (messageQueue.length === 0) return;
  
  if (messageQueue.length === 1) {
    // Single message - send directly
    broadcastImmediate(messageQueue[0]);
  } else {
    // Multiple messages - send as batch
    broadcastImmediate({
      type: 'batch',
      messages: messageQueue,
      count: messageQueue.length
    });
    logger.debug(`✓ Batched ${messageQueue.length} messages`);
  }
  
  messageQueue = [];
}

function broadcastImmediate(data) {
  logger.debug(`Broadcasting to ${clients.size} connected clients: ${data.type}`);
  let sentCount = 0;
  clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(data));
      sentCount++;
    }
  });
  logger.debug(`Sent to ${sentCount} clients`);
  if (sentCount === 0) {
    logger.warn('No WebSocket clients connected!');
  }
}

// Main broadcast function - uses batching for performance
function broadcast(data) {
  queueMessage(data);
}

// Check if enough time has passed since last notification (cooldown)
function checkNotificationCooldown(lastTime, minMinutes = 5) {
  if (!lastTime) return true;
  const now = Date.now();
  const diff = (now - lastTime) / 1000 / 60; // minutes
  return diff >= minMinutes;
}

// Check if we're in quiet hours
function isInQuietHours(settings) {
  if (!settings?.notificationSettings?.quietHoursEnabled) return false;
  
  const now = new Date();
  const currentTime = now.getHours() * 60 + now.getMinutes();
  
  const [startHour, startMin] = settings.notificationSettings.quietHoursStart.split(':').map(Number);
  const [endHour, endMin] = settings.notificationSettings.quietHoursEnd.split(':').map(Number);
  
  const startTime = startHour * 60 + startMin;
  const endTime = endHour * 60 + endMin;
  
  // Handle overnight ranges (e.g., 22:00 to 08:00)
  if (startTime > endTime) {
    return currentTime >= startTime || currentTime <= endTime;
  }
  
  return currentTime >= startTime && currentTime <= endTime;
}

// Trigger notification event to frontend
function triggerNotification(eventType, data) {
  const settings = monitoringData.settings;
  
  logger.info(`Notification trigger attempt: ${eventType}`);
  logger.debug('Notification settings:', JSON.stringify(settings?.notificationSettings, null, 2));
  
  // Check if notifications are enabled
  if (!settings?.notificationSettings?.enabled) {
    logger.warn(`Notifications disabled in settings`);
    return;
  }
  
  // Check if this specific event is enabled
  if (!settings?.notificationSettings?.events?.[eventType]) {
    logger.warn(`Event ${eventType} is disabled`);
    return;
  }
  
  // Check quiet hours
  if (isInQuietHours(settings)) {
    logger.info(`Notification suppressed (quiet hours)`);
    return;
  }
  
  // Check cooldown
  const minTime = settings?.notificationSettings?.minTimeBetweenNotifications || 5;
  
  logger.success(`SENDING NOTIFICATION: ${eventType}`, data);
  
  // Format notification message
  const message = formatNotificationMessage(eventType, data);
  logger.info(`Formatted message: ${message}`);
  
  // Send to enabled notification channels (Discord, Telegram, Slack, Webhook, Email)
  sendToNotificationChannels(settings.notificationSettings, message, eventType, data);
  
  // ALWAYS broadcast to browser via WebSocket (browser decides whether to show based on its settings)
  logger.debug(`Broadcasting to browser clients...`);
  broadcast({
    type: 'notification',
    event: eventType,
    data: data,
    timestamp: new Date().toISOString()
  });
  logger.success(`Notification flow complete`);
}

// Format notification message based on event type
function formatNotificationMessage(eventType, data) {
  const emoji = {
    onHostDown: '🔴',
    onHostUp: '🟢',
    onConnectionLost: '⚠️',
    onConnectionRestored: '✅',
    onHighLatency: '🐌',
    onPacketLoss: '📉',
    onSpeedTestComplete: '✅',
    onThresholdBreach: '⚠️'
  };
  
  const messages = {
    onHostDown: `${emoji[eventType]} Host Down: ${data.host} (${data.address}) is unreachable`,
    onHostUp: `${emoji[eventType]} Host Up: ${data.host} (${data.address}) is back online`,
    onConnectionLost: `${emoji[eventType]} Connection Lost: ${data.host} (${data.address}) - ${data.lostPackets} packets lost`,
    onConnectionRestored: `${emoji[eventType]} Connection Restored: ${data.host} (${data.address}) is stable again`,
    onHighLatency: `${emoji[eventType]} High Latency: ${data.host} (${data.address}) - ${data.ping}ms (threshold: ${data.threshold}ms)`,
    onPacketLoss: `${emoji[eventType]} Packet Loss: ${data.host} (${data.address}) - ${data.lossPercentage}% packet loss`,
    onSpeedTestComplete: `${emoji[eventType]} Speed Test Complete: ↓${data.download} Mbps / ↑${data.upload} Mbps / ${data.ping}ms ping`,
    onThresholdBreach: `${emoji[eventType]} Threshold Breach: Download ${data.download} Mbps (min: ${data.thresholds?.minDownload || 'N/A'}), Upload ${data.upload} Mbps (min: ${data.thresholds?.minUpload || 'N/A'}), Ping ${data.ping}ms (max: ${data.thresholds?.maxPing || 'N/A'})`
  };
  
  return messages[eventType] || `Notification: ${eventType}`;
}

// Send notifications to enabled channels (Phase 1 Optimization: Parallel sending)
async function sendToNotificationChannels(notificationSettings, message, eventType, data) {
  const types = notificationSettings?.types || {};
  const promises = [];
  
  // Discord
  if (types.discord?.enabled && types.discord?.webhookUrl) {
    promises.push(
      sendDiscordNotification(types.discord.webhookUrl, message, eventType, data)
        .catch(err => logger.error('Discord notification failed:', err.message))
    );
  }
  
  // Telegram
  if (types.telegram?.enabled && types.telegram?.botToken && types.telegram?.chatId) {
    promises.push(
      sendTelegramNotification(types.telegram, message)
        .catch(err => logger.error('Telegram notification failed:', err.message))
    );
  }
  
  // Slack
  if (types.slack?.enabled && types.slack?.webhookUrl) {
    promises.push(
      sendSlackNotification(types.slack.webhookUrl, message)
        .catch(err => logger.error('Slack notification failed:', err.message))
    );
  }
  
  // Custom Webhook
  if (types.webhook?.enabled && types.webhook?.url) {
    promises.push(
      sendWebhookNotification(types.webhook, message, eventType, data)
        .catch(err => logger.error('Webhook notification failed:', err.message))
    );
  }
  
  // Email
  if (types.email?.enabled && types.email?.address && types.email?.smtp?.host) {
    promises.push(
      sendEmailNotification(types.email, message, eventType)
        .catch(err => logger.error('Email notification failed:', err.message))
    );
  }
  
  // Send all notifications simultaneously
  if (promises.length > 0) {
    const startTime = Date.now();
    await Promise.allSettled(promises);
    const duration = Date.now() - startTime;
    logger.debug(`✓ Sent ${promises.length} notifications in ${duration}ms (parallel)`);
  }
}

// Send Discord webhook notification
async function sendDiscordNotification(webhookUrl, message, eventType, data) {
  try {
    const color = eventType.includes('Down') || eventType.includes('Lost') || eventType.includes('Breach') ? 0xFF0000 : 0x00FF00;
    
    await axios.post(webhookUrl, {
      embeds: [{
        title: 'Internet Monitor Alert',
        description: message,
        color: color,
        timestamp: new Date().toISOString(),
        footer: { text: 'Ezé-U Internet Monitor' }
      }]
    });
    logger.success('Discord notification sent');
  } catch (error) {
    logger.error('Discord notification failed:', error.message);
  }
}

// Send Telegram notification
async function sendTelegramNotification(telegramConfig, message) {
  try {
    const url = `https://api.telegram.org/bot${telegramConfig.botToken}/sendMessage`;
    await axios.post(url, {
      chat_id: telegramConfig.chatId,
      text: message,
      parse_mode: 'HTML'
    });
    logger.success('Telegram notification sent');
  } catch (error) {
    logger.error('Telegram notification failed:', error.message);
  }
}

// Send Slack webhook notification
async function sendSlackNotification(webhookUrl, message) {
  try {
    await axios.post(webhookUrl, {
      text: message
    });
    logger.success('Slack notification sent');
  } catch (error) {
    logger.error('Slack notification failed:', error.message);
  }
}

// Send custom webhook notification
async function sendWebhookNotification(webhookConfig, message, eventType, data) {
  try {
    const method = webhookConfig.method || 'POST';
    const headers = webhookConfig.headers || {};
    
    await axios({
      method: method,
      url: webhookConfig.url,
      headers: headers,
      data: {
        event: eventType,
        message: message,
        data: data,
        timestamp: new Date().toISOString()
      }
    });
    logger.success('Webhook notification sent');
  } catch (error) {
    logger.error('Webhook notification failed:', error.message);
  }
}

// Send email notification (requires nodemailer)
async function sendEmailNotification(emailConfig, message, eventType) {
  try {
    // Note: This requires nodemailer to be installed
    // For now, just log that email would be sent
    logger.info('Email notification (requires nodemailer):', emailConfig.address);
    // TODO: Implement with nodemailer if needed
  } catch (error) {
    logger.error('Email notification failed:', error.message);
  }
}

// Perform ping test
// Fast ping for high-frequency monitoring (1-5 second intervals)
async function performPing(host = '8.8.8.8') {
  try {
    // Detect OS for proper ping flags
    // Windows uses -n, Linux/Mac uses -c
    const isWindows = process.platform === 'win32';
    const pingArgs = isWindows ? ['-n', '1'] : ['-c', '1'];
    
    // For high-frequency monitoring, use a single fast ping with reasonable timeout
    const res = await ping.promise.probe(host, {
      timeout: 2,  // 2 second timeout (fast enough for 1-sec intervals)
      min_reply: 1,
      extra: pingArgs
    });
    
    logger.debug(`Ping ${host}: alive=${res.alive}, time=${res.time}`);
    
    if (res.alive && res.time !== 'unknown') {
      const pingTime = parseFloat(res.time);
      return isNaN(pingTime) ? -1 : pingTime;
    }
    return -1;
  } catch (error) {
    logger.error(`Ping error for ${host}:`, error.message);
    return -1;
  }
}

// Perform speed test with timeout and retry using Ookla CLI
async function performSpeedTest(retryCount = 0) {
  const MAX_RETRIES = 3;
  const TIMEOUT = 90000; // 90 seconds timeout
  const RETRY_DELAY = 10000; // 10 seconds between retries
  
  // Check if monthly data cap has been reached
  const capReached = await isMonthlyDataCapReached();
  if (capReached) {
    const settings = await loadSettings();
    logger.warn(`⚠️  Monthly data cap of ${settings.monthlyDataCap} has been reached. Speed test blocked.`);
    throw new Error(`Monthly data cap of ${settings.monthlyDataCap} reached. Speed tests will resume next month.`);
  }
  
  try {
    logger.info(`Starting Ookla CLI speed test... (attempt ${retryCount + 1}/${MAX_RETRIES + 1})`);
    
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
      logger.warn('Speed test stderr:', stderr);
    }
    
    // Parse JSON output
    const result = JSON.parse(stdout);
    
    // Log full result structure for debugging
    logger.debug('Full Ookla CLI result structure:', JSON.stringify(result, null, 2));
    
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
      resultUrl: result.result?.url || null,
      downloadBytes: result.download?.bytes || null,
      uploadBytes: result.upload?.bytes || null
    };
    
    logger.debug('Speed test details:', {
      ping: testResult.ping,
      jitter: testResult.jitter,
      downloadLatency: testResult.downloadLatency,
      uploadLatency: testResult.uploadLatency,
      downloadLatencyFull: result.download?.latency,
      uploadLatencyFull: result.upload?.latency,
      note: downloadLatency === 0 && uploadLatency === 0 ? 
        'NOTE: Latency values are 0 - Ookla server may not provide detailed latency metrics' : 
        'Detailed latency data retrieved successfully'
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

    // Check thresholds and trigger notifications
    const thresholds = monitoringData.settings.thresholds || {};
    let thresholdBreach = false;
    const breaches = [];
    
    if (thresholds.minDownload && testResult.download < thresholds.minDownload) {
      breaches.push(`Download: ${testResult.download} Mbps (min: ${thresholds.minDownload})`);
      thresholdBreach = true;
    }
    
    if (thresholds.minUpload && testResult.upload < thresholds.minUpload) {
      breaches.push(`Upload: ${testResult.upload} Mbps (min: ${thresholds.minUpload})`);
      thresholdBreach = true;
    }
    
    if (thresholds.maxPing && testResult.ping > thresholds.maxPing) {
      breaches.push(`Ping: ${testResult.ping} ms (max: ${thresholds.maxPing})`);
      thresholdBreach = true;
    }
    
    // Trigger notifications
    if (thresholdBreach) {
      if (checkNotificationCooldown(notificationState.lastThresholdBreach)) {
        triggerNotification('onThresholdBreach', {
          download: testResult.download,
          upload: testResult.upload,
          ping: testResult.ping,
          thresholds: thresholds,
          breaches: breaches,
          timestamp: testResult.timestamp
        });
        notificationState.lastThresholdBreach = Date.now();
        logger.warn('⚠️  Threshold breach detected:', breaches.join(', '));
      }
    }
    
    // Always trigger speed test complete notification
    triggerNotification('onSpeedTestComplete', {
      download: testResult.download,
      upload: testResult.upload,
      ping: testResult.ping,
      timestamp: testResult.timestamp
    });

    // Broadcast speed test result
    broadcast({ type: 'speedtest', data: testResult });
    
    // Broadcast updated history immediately (fixes refresh issue with cache)
    const updatedHistory = await loadHistory(100);
    broadcast({ type: 'history', data: updatedHistory });
    
    logger.success('Speed test completed successfully:', testResult);
    return testResult;
    
  } catch (error) {
    const errorType = error.message.includes('timeout') ? 'Timeout' : 
                     error.message.includes('write') || error.message.includes('socket') ? 'Network Connection' :
                     error.message.includes('ENOTFOUND') ? 'DNS Resolution' : 'Unknown';
    
    logger.error(`Speed test error (attempt ${retryCount + 1}/${MAX_RETRIES + 1}) [${errorType}]:`, error.message);
    
    // Retry if we haven't exceeded max retries
    if (retryCount < MAX_RETRIES) {
      const delay = RETRY_DELAY * (retryCount + 1); // Progressive delay: 10s, 20s, 30s
      logger.info(`Retrying speed test in ${delay / 1000} seconds...`);
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
    
    logger.warn('⚠️  All speed test attempts failed. Network issues or Speedtest servers may be unavailable.');
    logger.info('💡 Tip: Check your internet connection and firewall settings.');
    
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
    logger.warn('No enabled hosts for monitoring');
    return [];
  }
  
  logger.debug(`Monitoring ${enabledHosts.length} hosts...`);
  
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
  
  // Log ping results for each host at the interval
  logger.debug(`📊 Live Monitoring Ping Results [Interval: ${monitoringData.settings.monitorInterval}s]:`);
  results.forEach(result => {
    const statusIcon = result.ping === -1 ? '❌' : '✓';
    const pingStatus = result.ping === -1 ? 'TIMEOUT' : `${result.ping}ms`;
    logger.debug(`  ${statusIcon} ${result.name} (${result.address}): ${pingStatus}`);
  });
  
  // Update live monitoring data and check for status changes
  results.forEach(result => {
    const isDown = result.ping === -1;
    const prevState = notificationState.hostStatus[result.address];
    
    // Initialize state if first time seeing this host
    if (!prevState) {
      notificationState.hostStatus[result.address] = {
        isDown: false,  // Start optimistic (assume host is up)
        lastNotificationTime: null,
        failureCount: 0,  // Track consecutive failures
        successCount: 0   // Track consecutive successes
      };
    }
    
    const state = notificationState.hostStatus[result.address];
    const wasDown = state.isDown;
    
    // Update failure/success counters
    if (isDown) {
      state.failureCount++;
      state.successCount = 0;
    } else {
      state.successCount++;
      state.failureCount = 0;
    }
    
    // Require 3 consecutive failures before marking host as DOWN (prevents false positives)
    // For 1-second monitoring, this means 3 seconds of failures
    const FAILURE_THRESHOLD = 3;
    const SUCCESS_THRESHOLD = 2;
    
    // Host went DOWN (after 3 consecutive failures)
    if (!wasDown && state.failureCount >= FAILURE_THRESHOLD) {
      if (checkNotificationCooldown(state.lastNotificationTime)) {
        triggerNotification('onHostDown', {
          host: result.name,
          address: result.address,
          timestamp: result.timestamp
        });
        state.lastNotificationTime = Date.now();
      }
      state.isDown = true;
      logger.error(`🔴 HOST DOWN: ${result.name} (${result.address}) - ${FAILURE_THRESHOLD} consecutive failures`);
    }
    
    // Host came BACK UP (after 2 consecutive successes)
    if (wasDown && state.successCount >= SUCCESS_THRESHOLD) {
      if (checkNotificationCooldown(state.lastNotificationTime)) {
        triggerNotification('onHostUp', {
          host: result.name,
          address: result.address,
          ping: result.ping,
          timestamp: result.timestamp
        });
        state.lastNotificationTime = Date.now();
      }
      state.isDown = false;
      logger.success(`🟢 HOST RECOVERED: ${result.name} (${result.address}) - ${result.ping}ms`);
    }
    
    // Check for high latency (only for hosts that are UP)
    if (!isDown && result.ping > (monitoringData.settings.thresholds?.maxPing || 100)) {
      if (checkNotificationCooldown(notificationState.lastHighLatency)) {
        triggerNotification('onHighLatency', {
          host: result.name,
          address: result.address,
          ping: result.ping,
          threshold: monitoringData.settings.thresholds?.maxPing || 100,
          timestamp: result.timestamp
        });
        notificationState.lastHighLatency = Date.now();
      }
    }
    
    monitoringData.liveMonitoring[result.address] = result;
    saveLiveMonitoring(result.address, result);
  });
  
  // Check for connection lost (all hosts down)
  const allDown = results.every(r => r.ping === -1);
  if (allDown && results.length > 0) {
    if (checkNotificationCooldown(notificationState.lastConnectionLost)) {
      triggerNotification('onConnectionLost', {
        timestamp: new Date().toISOString()
      });
      notificationState.lastConnectionLost = Date.now();
      logger.error('🔴 CONNECTION LOST: All hosts unreachable');
    }
  } else if (notificationState.lastConnectionLost) {
    // Connection restored
    const anyUp = results.some(r => r.ping !== -1);
    if (anyUp) {
      if (checkNotificationCooldown(notificationState.lastConnectionLost, 1)) { // Shorter cooldown for restore
        triggerNotification('onConnectionRestored', {
          timestamp: new Date().toISOString()
        });
        logger.success('🟢 CONNECTION RESTORED');
      }
      notificationState.lastConnectionLost = null;
    }
  }
  
  // Use the primary host for current speed
  const primaryPing = results[0]?.ping || -1;
  monitoringData.currentSpeed.ping = primaryPing;
  
  broadcast({ type: 'liveMonitoring', data: monitoringData.liveMonitoring });
  return results;
}

// Start monitoring (always runs)
async function startMonitoring() {
  logger.info('=== Monitoring started ===');

  logger.info('Enabled hosts:', monitoringData.settings.monitoringHosts.filter(h => h.enabled).map(h => h.name));

  // Run first ping immediately
  await performQuickMonitor();

  // Quick ping at configured interval (in seconds)
  const checkInterval = (monitoringData.settings.monitorInterval || 5) * 1000;
  if (monitoringInterval) {
    clearInterval(monitoringInterval);
  }
  
  monitoringInterval = setInterval(async () => {
    try {
      await performQuickMonitor();
    } catch (error) {
      logger.error('Quick monitor error:', error.message);
      // Continue monitoring even if one cycle fails
    }
  }, checkInterval);

  // Schedule full speed tests
  const interval = monitoringData.settings.testInterval;
  
  if (scheduledJob) {
    scheduledJob.cancel();
  }
  
  scheduledJob = schedule.scheduleJob(`*/${interval} * * * *`, async () => {
    try {
      logger.info('🔄 Running scheduled speed test...');
      const result = await performSpeedTest();
      if (result.error) {
        logger.warn('⚠️  Scheduled speed test completed with errors. Will retry on next schedule.');
      } else {
        logger.success('✅ Scheduled speed test completed successfully.');
      }
    } catch (error) {
      logger.error('❌ Scheduled speed test failed:', error.message);
      // Don't crash the monitoring, just log the error
    }
  });

  logger.info(`Scheduled speed tests every ${interval} minutes`);
  broadcast({ type: 'status', isMonitoring: true });
}

// Restart monitoring (used when settings change)
async function restartMonitoring() {
  logger.info('Restarting monitoring with new settings...');
  
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
// Phase 3: History endpoint with caching and pagination
app.get('/api/history', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 50, 1000);
    const offset = parseInt(req.query.offset) || 0;
    
    // Create cache key based on parameters
    const cacheKey = `history:${limit}:${offset}`;
    
    // Use cached query (30 second TTL for history)
    const results = await cachedQuery(cacheKey, 30, async () => {
      return await dbAll(
        'SELECT * FROM speed_tests ORDER BY timestamp DESC LIMIT ? OFFSET ?',
        [limit, offset]
      );
    });
    
    // If pagination requested, include metadata
    if (req.query.offset !== undefined || req.query.paginated === 'true') {
      const totalCountKey = 'history:total';
      const total = await cachedQuery(totalCountKey, 60, async () => {
        const result = await dbGet('SELECT COUNT(*) as count FROM speed_tests');
        return result.count;
      });
      
      res.json({
        results,
        pagination: {
          offset,
          limit,
          total,
          hasMore: offset + limit < total
        }
      });
    } else {
      // Legacy response format (for backward compatibility)
      res.json(results);
    }
  } catch (error) {
    logger.error('History endpoint error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get monthly data usage
app.get('/api/monthly-usage', async (req, res) => {
  try {
    const settings = await loadSettings();
    
    // Get first and last day of current month
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    
    // Query total bytes used this month
    const result = await dbGet(`
      SELECT 
        COALESCE(SUM(downloadBytes), 0) as downloadBytes,
        COALESCE(SUM(uploadBytes), 0) as uploadBytes
      FROM speed_tests
      WHERE timestamp >= ? AND timestamp <= ?
    `, [firstDay.toISOString(), lastDay.toISOString()]);
    
    const totalBytes = (result.downloadBytes || 0) + (result.uploadBytes || 0);
    const capInBytes = parseDataCapToBytes(settings.monthlyDataCap);
    
    res.json({
      downloadBytes: result.downloadBytes || 0,
      uploadBytes: result.uploadBytes || 0,
      totalBytes,
      monthlyDataCap: settings.monthlyDataCap,
      capInBytes,
      capReached: capInBytes ? totalBytes >= capInBytes : false,
      percentageUsed: capInBytes ? Math.min(100, (totalBytes / capInBytes) * 100) : 0
    });
  } catch (error) {
    logger.error('Monthly usage endpoint error:', error);
    res.status(500).json({ error: error.message });
  }
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

// Phase 3: Get settings with caching
app.get('/api/settings', async (req, res) => {
  try {
    const settings = await cachedQuery('settings', 60, async () => {
      return monitoringData.settings;
    });
    res.json(settings);
  } catch (error) {
    logger.error('Settings endpoint error:', error);
    res.status(500).json({ error: error.message });
  }
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
    logger.error('Error getting live monitoring history:', error);
    res.status(500).json({ error: 'Failed to get monitoring history' });
  }
});

// Update settings
app.post('/api/settings', async (req, res) => {
  monitoringData.settings = { ...monitoringData.settings, ...req.body };
  await saveSettings(monitoringData.settings);
  
  // Phase 3: Invalidate settings cache
  invalidateSettingsCache();
  
  // Reload settings to update cache and get fresh data
  monitoringData.settings = await loadSettings(true); // Force refresh
  
  // Apply log level if changed
  if (monitoringData.settings.logLevel) {
    logger.setLevel(monitoringData.settings.logLevel);
  }
  
  // Restart monitoring with new settings
  await restartMonitoring();
  
  broadcast({ type: 'settings', data: monitoringData.settings });
  res.json(monitoringData.settings);
});

// Clear history
app.delete('/api/history', async (req, res) => {
  // Clear speed test history
  await dbRun('DELETE FROM speed_tests');
  monitoringData.history = [];
  
  // Clear live monitoring data
  await dbRun('DELETE FROM live_monitoring');
  await dbRun('DELETE FROM live_monitoring_history');
  monitoringData.liveMonitoring = {};
  
  // Clear notification state
  notificationState.hostStatus = {};
  
  // Phase 3: Invalidate all caches
  invalidateHistoryCache();
  invalidateMonitoringCache();
  
  broadcast({ type: 'historyCleared' });
  res.json({ message: 'All history and monitoring data cleared' });
});

// Test notification - sends to ALL enabled notification channels
app.post('/api/test-notification', (req, res) => {
  logger.info('Test notification requested');
  
  // Trigger a test notification that will be sent to all enabled channels
  triggerNotification('onSpeedTestComplete', {
    download: 95.5,
    upload: 11.2,
    ping: 15,
    timestamp: new Date().toISOString()
  });
  
  res.json({ 
    message: 'Test notification sent to all enabled channels',
    enabledChannels: {
      browser: monitoringData.settings?.notificationSettings?.types?.browser?.enabled || false,
      discord: monitoringData.settings?.notificationSettings?.types?.discord?.enabled || false,
      telegram: monitoringData.settings?.notificationSettings?.types?.telegram?.enabled || false,
      slack: monitoringData.settings?.notificationSettings?.types?.slack?.enabled || false,
      webhook: monitoringData.settings?.notificationSettings?.types?.webhook?.enabled || false,
      email: monitoringData.settings?.notificationSettings?.types?.email?.enabled || false
    }
  });
});

// Serve static frontend files if build exists
// This works in production (Docker) or when user runs "npm start" after building frontend
const frontendBuildPath = path.join(__dirname, '../frontend/build');

if (fs.existsSync(frontendBuildPath)) {
  // Serve static files from the React build folder
  app.use(express.static(frontendBuildPath));
  
  // Handle React routing - return index.html for all non-API routes
  app.get('*', (req, res) => {
    res.sendFile(path.join(frontendBuildPath, 'index.html'));
  });
  
  logger.info('✓ Serving static frontend from:', frontendBuildPath);
  logger.info('✓ Access application at: http://localhost:' + (process.env.PORT || 8745));
} else {
  logger.info('ℹ Frontend build folder not found at:', frontendBuildPath);
  logger.info('ℹ Running in API-only mode (frontend should run separately on port 4280)');
  logger.info('ℹ To serve frontend statically: cd frontend && npm run build');
}

const PORT = process.env.PORT || 8745;

server.listen(PORT, async () => {
  logger.success(`Server running on port ${PORT}`);
  logger.success('WebSocket server ready');
  logger.info('Database initialized at:', dbPath);
  
  // Load data from database
  await initializeData();
  
  // Always start monitoring
  logger.info('Starting monitoring automatically...');
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
    logger.info('Cleaned up old monitoring history');
  } catch (error) {
    logger.error('Error cleaning up monitoring history:', error);
  }
}

// Schedule cleanup to run daily at 3 AM
schedule.scheduleJob('0 3 * * *', cleanupOldMonitoringHistory);

// Graceful shutdown
process.on('SIGINT', () => {
  logger.warn('Shutting down gracefully...');
  db.close();
  process.exit(0);
});
