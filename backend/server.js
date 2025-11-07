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
db.pragma('temp_store = MEMORY'); // Use memory for temp operations (faster)
db.pragma('mmap_size = 30000000'); // Memory-mapped I/O for 30MB (faster reads)
db.pragma('page_size = 4096'); // Standard page size

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
      monitorInterval INTEGER DEFAULT 60,
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
    db.exec(`ALTER TABLE settings ADD COLUMN monitorInterval INTEGER DEFAULT 60`);
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

  // Add liveMonitoringInterval column if it doesn't exist (migration)
  try {
    db.exec(`ALTER TABLE settings ADD COLUMN liveMonitoringInterval INTEGER DEFAULT 10`);
  } catch (err) {
    if (!err.message.includes('duplicate column')) {
      logger.error('Error adding liveMonitoringInterval column:', err.message);
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

  // Add dataRetention column to settings if it doesn't exist (migration)
  try {
    db.exec(`ALTER TABLE settings ADD COLUMN dataRetention TEXT DEFAULT NULL`);
  } catch (err) {
    if (!err.message.includes('duplicate column')) {
      logger.error('Error adding dataRetention column:', err.message);
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
      monitorInterval: 60,
      liveMonitoringInterval: 10,
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
        minDownload: 10,
        minUpload: 10,
        maxPing: 500
      },
      logLevel: 'INFO',  // Default log level (INFO for standard logging)
      monthlyDataCap: null,  // No cap by default (e.g., "5 GB" or "1 TB")
      dataRetention: {
        speedTestRetentionDays: 90,
        liveMonitoringRetentionDays: 7,
        autoCleanupEnabled: true,
        autoCleanupTime: '00:00'
      }
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
  
  let dataRetention = {
    speedTestRetentionDays: 90,
    liveMonitoringRetentionDays: 30,
    autoCleanupEnabled: true,
    autoCleanupTime: '00:00'
  };
  if (row.dataRetention) {
    try {
      dataRetention = JSON.parse(row.dataRetention);
    } catch (e) {
      logger.error('Error parsing dataRetention:', e);
    }
  }
  
  const loadedSettings = {
    testInterval: row.testInterval,
    monitorInterval: row.monitorInterval || 60,
    liveMonitoringInterval: row.liveMonitoringInterval || 10,
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
    logLevel: row.logLevel || 'INFO',
    monthlyDataCap: row.monthlyDataCap || null,
    dataRetention: dataRetention
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
        liveMonitoringInterval = ?,
        pingHost = ?, 
        monitoringHosts = ?,
        autoStart = ?,
        notifications = ?,
        notificationSettings = ?,
        minDownload = ?,
        minUpload = ?,
        maxPing = ?,
        logLevel = ?,
        monthlyDataCap = ?,
        dataRetention = ?
    WHERE id = 1
  `, [
    settings.testInterval,
    settings.monitorInterval || 60,
    settings.liveMonitoringInterval || 10,
    settings.pingHost,
    JSON.stringify(settings.monitoringHosts),
    settings.autoStart ? 1 : 0,
    settings.notifications ? 1 : 0,
    JSON.stringify(settings.notificationSettings || {}),
    settings.thresholds.minDownload,
    settings.thresholds.minUpload,
    settings.thresholds.maxPing,
    settings.logLevel || 'INFO',
    settings.monthlyDataCap || null,
    JSON.stringify(settings.dataRetention || {
      speedTestRetentionDays: 90,
      liveMonitoringRetentionDays: 30,
      autoCleanupEnabled: true,
      autoCleanupTime: '00:00'
    })
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

// Automatic data cleanup function - follows same 8-phase pattern as Clear Data but with time-based filtering
async function cleanupOldData() {
  try {
    logger.info('═══════════════════════════════════════════════════════');
    logger.info('🧹 CLEANUP OLD DATA OPERATION STARTED');
    logger.info('═══════════════════════════════════════════════════════');
    
    // Load retention settings
    logger.debug('  📋 Loading retention settings...');
    const settings = await loadSettings();
    const retention = settings.dataRetention || {};
    
    if (!retention.autoCleanupEnabled) {
      logger.debug('  ℹ️  Cleanup is disabled - exiting');
      return;
    }
    
    const speedTestRetentionDays = retention.speedTestRetentionDays || 90;
    const liveMonitoringRetentionDays = retention.liveMonitoringRetentionDays || 30;
    
    // Calculate cutoff dates
    const now = new Date();
    const speedTestCutoff = new Date(now.getTime() - (speedTestRetentionDays * 24 * 60 * 60 * 1000));
    const liveMonitoringCutoff = new Date(now.getTime() - (liveMonitoringRetentionDays * 24 * 60 * 60 * 1000));
    
    logger.info(`📊 Retention: speedTest=${speedTestRetentionDays}d, liveMonitoring=${liveMonitoringRetentionDays}d`);
    logger.debug(`  Speed test cutoff: ${speedTestCutoff.toISOString()}`);
    logger.debug(`  Live monitoring cutoff: ${liveMonitoringCutoff.toISOString()}`);
    
    // PHASE 1: CHECKPOINT WAL
    logger.info('📍 PHASE 1: Checkpointing WAL to merge pending writes...');
    
    try {
      logger.debug('  📌 Running WAL checkpoint...');
      db.exec('PRAGMA wal_checkpoint(RESTART)');
      logger.info('  ✅ WAL checkpoint complete');
    } catch (err) {
      logger.warn(`  ⚠️  WAL checkpoint warning: ${err.message}`);
    }
    
    // Use separate transactions for each table to prevent index corruption cascade
    // PHASE 2: Delete old speed test records
    logger.info('📍 PHASE 2: Deleting old speed test records...');
    try {
      const speedTestCount = await dbGet('SELECT COUNT(*) as count FROM speed_tests WHERE datetime(timestamp) < datetime(?)', [speedTestCutoff.toISOString()]);
      
      if (speedTestCount.count > 0) {
        logger.debug(`  📌 Found ${speedTestCount.count} records to delete`);
        
        try {
          db.exec('PRAGMA synchronous = OFF');
          logger.debug('  ✓ Synchronous writes disabled (for speed)');
        } catch (e) {
          logger.warn('  ⚠️  Could not disable synchronous:', e.message);
        }
        
        logger.debug('  🔪 Executing DELETE FROM speed_tests...');
        const deleteStmt = db.prepare('DELETE FROM speed_tests WHERE datetime(timestamp) < datetime(?)');
        deleteStmt.run(speedTestCutoff.toISOString());
        
        logger.info(`  ✅ Deleted ${speedTestCount.count} old speed test records`);
        
        try {
          db.exec('PRAGMA synchronous = NORMAL');
          logger.debug('  ✓ Synchronous writes re-enabled');
        } catch (e) {
          logger.warn('  ⚠️  Could not re-enable synchronous:', e.message);
        }
        
        try {
          logger.debug('  📌 Checkpointing WAL after deletion...');
          db.exec('PRAGMA wal_checkpoint(RESTART)');
          logger.debug('  ✓ WAL checkpoint complete');
        } catch (checkErr) {
          logger.warn(`  ⚠️  Post-deletion checkpoint failed: ${checkErr.message}`);
        }
        
        invalidateHistoryCache();
      } else {
        logger.info('ℹ️  No old speed test records to delete');
      }
    } catch (speedTestError) {
      try {
        db.exec('PRAGMA synchronous = NORMAL');
      } catch (e) {
        logger.warn('  ⚠️  Could not re-enable synchronous on error:', e.message);
      }
      logger.error('❌ PHASE 2 FAILED:', speedTestError.message);
      throw speedTestError;
    }
    
    // PHASE 3: Delete old live monitoring history (DROP corrupt indexes, delete safely, RECREATE indexes)
    logger.info('📍 PHASE 3: Deleting old live monitoring history...');
    try {
      logger.debug('  🔍 [3.0] Dropping corrupt indexes to enable safe deletion...');
      try {
        logger.debug('    [3.0.1] Dropping idx_monitoring_history_timestamp...');
        db.exec('DROP INDEX IF EXISTS idx_monitoring_history_timestamp');
        logger.debug('    ✓ [3.0.2] Index dropped');
      } catch (e) {
        logger.warn('    ⚠️  [3.0.2] Could not drop idx_monitoring_history_timestamp:', e.message);
      }
      
      try {
        logger.debug('    [3.0.3] Dropping idx_monitoring_history_address_timestamp...');
        db.exec('DROP INDEX IF EXISTS idx_monitoring_history_address_timestamp');
        logger.debug('    ✓ [3.0.4] Index dropped');
      } catch (e) {
        logger.warn('    ⚠️  [3.0.4] Could not drop idx_monitoring_history_address_timestamp:', e.message);
      }
      
      logger.debug('  🔍 [3.1] Getting count of records to delete...');
      const liveMonitoringCount = await dbGet('SELECT COUNT(*) as count FROM live_monitoring_history WHERE datetime(timestamp) < datetime(?)', [liveMonitoringCutoff.toISOString()]);
      logger.info(`  📊 [3.2] Found ${liveMonitoringCount.count} records to delete`);
      
      if (liveMonitoringCount.count > 0) {
        logger.debug(`  📌 [3.3] Record count verified: ${liveMonitoringCount.count}`);
        
        // Delete using simple WHERE clause with reasonable chunks (no indexes to maintain)
        const CHUNK_SIZE = 10000;
        let totalDeleted = 0;
        let chunkNum = 0;
        
        logger.debug('  [3.4] Attempting to disable PRAGMA synchronous...');
        try {
          db.exec('PRAGMA synchronous = OFF');
          logger.debug('  ✓ [3.5] Synchronous writes disabled (for speed)');
        } catch (e) {
          logger.warn('  ⚠️  [3.5] Could not disable synchronous:', e.message);
        }
        
        logger.debug('  [3.6] Starting chunked deletion loop (no indexes to maintain)...');
        while (totalDeleted < liveMonitoringCount.count) {
          chunkNum++;
          logger.debug(`  [3.7-${chunkNum}] Starting chunk ${chunkNum}...`);
          
          try {
            logger.debug(`    [3.7-${chunkNum}.a] Preparing DELETE statement...`);
            const deleteStmt = db.prepare('DELETE FROM live_monitoring_history WHERE datetime(timestamp) < datetime(?) LIMIT ?');
            logger.debug(`    [3.7-${chunkNum}.b] DELETE statement prepared successfully`);
            
            logger.debug(`    [3.7-${chunkNum}.c] Executing DELETE for chunk ${chunkNum} (CHUNK_SIZE=${CHUNK_SIZE})...`);
            const result = deleteStmt.run(liveMonitoringCutoff.toISOString(), CHUNK_SIZE);
            logger.debug(`    [3.7-${chunkNum}.d] DELETE execution complete, changes: ${result.changes}`);
            
            totalDeleted += result.changes;
            logger.info(`  ✓ [3.7-${chunkNum}] Chunk ${chunkNum} deleted ${result.changes} records (total: ${totalDeleted}/${liveMonitoringCount.count})`);
            
            if (result.changes === 0) {
              logger.debug(`    [3.7-${chunkNum}.e] No more records to delete (result.changes === 0), breaking loop`);
              break;
            }
            
            // WAL checkpoint after each chunk
            logger.debug(`    [3.7-${chunkNum}.f] Attempting WAL checkpoint after chunk ${chunkNum}...`);
            try {
              logger.debug(`    [3.7-${chunkNum}.g] Calling PRAGMA wal_checkpoint(RESTART)...`);
              db.exec('PRAGMA wal_checkpoint(RESTART)');
              logger.debug(`    ✓ [3.7-${chunkNum}.h] WAL checkpoint complete for chunk ${chunkNum}`);
            } catch (checkErr) {
              logger.error(`    ❌ [3.7-${chunkNum}.h] WAL checkpoint FAILED: ${checkErr.message}`);
              logger.error(`       Error details:`, checkErr);
              throw checkErr;
            }
          } catch (chunkError) {
            logger.error(`  ❌ [3.7-${chunkNum}] Chunk ${chunkNum} FAILED:`, chunkError.message);
            logger.error(`     Error type: ${chunkError.constructor.name}`);
            logger.error(`     Error code: ${chunkError.code}`);
            logger.error(`     Chunk details: deleted so far=${totalDeleted}, chunk_size=${CHUNK_SIZE}`);
            throw chunkError;
          }
        }
        
        logger.info(`  ✅ [3.8] All chunks completed - Deleted ${totalDeleted} old live monitoring records (in ${chunkNum} chunks)`);
        
        logger.debug('  [3.9] Attempting to re-enable PRAGMA synchronous...');
        try {
          db.exec('PRAGMA synchronous = NORMAL');
          logger.debug('  ✓ [3.10] Synchronous writes re-enabled');
        } catch (e) {
          logger.warn('  ⚠️  [3.10] Could not re-enable synchronous:', e.message);
        }
        
        logger.debug('  [3.11] Recreating indexes on cleaned table...');
        try {
          logger.debug('    [3.11.1] Creating idx_monitoring_history_timestamp...');
          db.exec('CREATE INDEX IF NOT EXISTS idx_monitoring_history_timestamp ON live_monitoring_history(timestamp)');
          logger.debug('    ✓ [3.11.2] Index created');
        } catch (e) {
          logger.error('    ❌ [3.11.2] Could not create idx_monitoring_history_timestamp:', e.message);
        }
        
        try {
          logger.debug('    [3.11.3] Creating idx_monitoring_history_address_timestamp...');
          db.exec('CREATE INDEX IF NOT EXISTS idx_monitoring_history_address_timestamp ON live_monitoring_history(address, timestamp DESC)');
          logger.debug('    ✓ [3.11.4] Index created');
        } catch (e) {
          logger.error('    ❌ [3.11.4] Could not create idx_monitoring_history_address_timestamp:', e.message);
        }
        
        logger.debug('  [3.12] Invalidating monitoring cache...');
        invalidateMonitoringCache();
        logger.debug('  ✓ [3.13] Monitoring cache invalidated');
      } else {
        logger.info('ℹ️  [3.14] No old live monitoring records to delete');
      }
    } catch (liveMonitoringError) {
      logger.error('  ❌ [3.99] PHASE 3 ERROR HANDLING TRIGGERED');
      logger.error(`     Error message: ${liveMonitoringError.message}`);
      logger.error(`     Error type: ${liveMonitoringError.constructor.name}`);
      logger.error(`     Error code: ${liveMonitoringError.code}`);
      logger.error(`     Stack: ${liveMonitoringError.stack}`);
      
      logger.debug('  [3.100] Attempting to re-enable PRAGMA synchronous in error handler...');
      try {
        db.exec('PRAGMA synchronous = NORMAL');
        logger.debug('  ✓ [3.101] Synchronous writes re-enabled in error handler');
      } catch (e) {
        logger.error('  ❌ [3.101] Could not re-enable synchronous on error:', e.message);
      }
      
      logger.debug('  [3.102] Attempting to recreate indexes in error handler...');
      try {
        logger.debug('    [3.102.1] Recreating idx_monitoring_history_timestamp...');
        db.exec('CREATE INDEX IF NOT EXISTS idx_monitoring_history_timestamp ON live_monitoring_history(timestamp)');
        logger.debug('    ✓ [3.102.2] Index recreated');
      } catch (e) {
        logger.warn('    ⚠️  [3.102.2] Could not recreate idx_monitoring_history_timestamp:', e.message);
      }
      
      try {
        logger.debug('    [3.102.3] Recreating idx_monitoring_history_address_timestamp...');
        db.exec('CREATE INDEX IF NOT EXISTS idx_monitoring_history_address_timestamp ON live_monitoring_history(address, timestamp DESC)');
        logger.debug('    ✓ [3.102.4] Index recreated');
      } catch (e) {
        logger.warn('    ⚠️  [3.102.4] Could not recreate idx_monitoring_history_address_timestamp:', e.message);
      }
      
      logger.error('❌ PHASE 3 FAILED:', liveMonitoringError.message);
      throw liveMonitoringError;
    }
    
    // PHASE 4: Invalidate caches
    logger.info('📍 PHASE 4: Invalidating caches...');
    try {
      invalidateHistoryCache();
      invalidateMonitoringCache();
      invalidateSettingsCache();
      queryCache.flushAll();
      logger.info('✅ Caches invalidated');
    } catch (cacheError) {
      logger.warn('⚠️  Cache invalidation warning:', cacheError.message);
    }
    
    // PHASE 5: Schedule async optimization
    logger.info('📍 PHASE 5: Scheduling async optimization...');
    
    // Capture current size before optimization
    let sizeBefore = 0;
    try {
      sizeBefore = fs.statSync(dbPath).size;
      logger.debug(`  📊 Database size BEFORE optimization: ${(sizeBefore / 1024 / 1024).toFixed(2)} MB`);
    } catch (e) {
      logger.warn('  ⚠️  Could not get database size before optimization:', e.message);
    }
    
    setImmediate(() => {
      setTimeout(() => {
        try {
          logger.debug('  🔧 Running PRAGMA wal_checkpoint(RESTART)...');
          db.exec('PRAGMA wal_checkpoint(RESTART)');
          logger.debug('  ✓ WAL checkpoint complete');
          
          logger.debug('  🧹 Running VACUUM (for space reclamation)...');
          db.exec('VACUUM');
          logger.debug('  ✓ VACUUM complete');
          
          logger.debug('  📌 Final PRAGMA wal_checkpoint(TRUNCATE)...');
          db.exec('PRAGMA wal_checkpoint(TRUNCATE)');
          logger.debug('  ✓ Final checkpoint complete');
          
          // Get size after optimization
          try {
            const sizeAfter = fs.statSync(dbPath).size;
            const spaceSaved = sizeBefore - sizeAfter;
            const percentReclaimed = sizeBefore > 0 ? ((spaceSaved / sizeBefore) * 100).toFixed(1) : 0;
            
            logger.info(`✅ Database optimized`);
            logger.info(`  📊 Size AFTER optimization: ${(sizeAfter / 1024 / 1024).toFixed(2)} MB`);
            if (spaceSaved > 0) {
              logger.info(`  💾 Space reclaimed: ${(spaceSaved / 1024 / 1024).toFixed(2)} MB (${percentReclaimed}%)`);
            } else {
              logger.info(`  ℹ️  Database size stable (already optimized)`);
            }
          } catch (e) {
            logger.warn('  ⚠️  Could not calculate space reclaimed:', e.message);
            logger.info(`✅ Database optimized`);
          }
        } catch (optimizeError) {
          logger.warn('⚠️  Async optimization warning:', optimizeError.message);
        }
      }, 50);
    });
    
    logger.info('✅ Cleanup completed successfully');
    
  } catch (error) {
    logger.error('❌ Cleanup FAILED:', error.message);
    throw error;
  }
}

// Cleanup scheduler variable
let cleanupJob = null;

// Schedule data cleanup
async function scheduleDataCleanup() {
  try {
    const settings = await loadSettings();
    const retention = settings.dataRetention || {};
    
    if (!retention.autoCleanupEnabled) {
      logger.debug('Data cleanup scheduling: disabled');
      if (cleanupJob) {
        cleanupJob.cancel();
        cleanupJob = null;
      }
      return;
    }
    
    const cleanupTime = retention.autoCleanupTime || '00:00';
    const [hours, minutes] = cleanupTime.split(':').map(Number);
    
    logger.info(`📅 Scheduling data cleanup daily at ${cleanupTime}`);
    
    // Cancel existing job if any
    if (cleanupJob) {
      cleanupJob.cancel();
    }
    
    // Schedule cleanup at specified time daily
    cleanupJob = schedule.scheduleJob(`${minutes} ${hours} * * *`, async () => {
      logger.info(`⏰ Running scheduled data cleanup at ${new Date().toLocaleString()}`);
      await cleanupOldData();
    });
    
    logger.debug(`✓ Data cleanup scheduled for ${cleanupTime} daily`);
  } catch (error) {
    logger.error('Failed to schedule data cleanup:', error.message);
  }
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
  
  // Schedule data cleanup
  await scheduleDataCleanup();
  
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
    const limit = Math.min(parseInt(req.query.limit) || 50, 1000000);
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
  try {
    logger.info('═══════════════════════════════════════════════════════');
    logger.info('🗑️  CLEAR DATA OPERATION STARTED');
    logger.info('═══════════════════════════════════════════════════════');
    
    // PHASE 1: STOP ALL EVENTS
    logger.info('📍 PHASE 1: Stopping all background events...');
    broadcast({ type: 'clearProgress', message: '📍 PHASE 1/8: Stopping background events', phase: 1, percent: 12 });
    
    // Stop speed test scheduler
    if (scheduledJob) {
      logger.info('  ⏹️  Canceling scheduled speed test job');
      scheduledJob.cancel();
      scheduledJob = null;
    } else {
      logger.info('  ⏸️  Speed test job not running');
    }
    
    // Stop live monitoring interval
    if (monitoringInterval) {
      logger.info('  ⏹️  Clearing live monitoring interval');
      clearInterval(monitoringInterval);
      monitoringInterval = null;
    } else {
      logger.info('  ⏸️  Live monitoring interval not running');
    }
    
    logger.info('✅ All background events stopped');
    
    // PHASE 2: CHECKPOINT AND MERGE WAL
    logger.info('📍 PHASE 2: Checkpointing WAL to merge pending writes...');
    broadcast({ type: 'clearProgress', message: '📍 PHASE 2/8: Checkpointing WAL', phase: 2, percent: 25 });
    
    try {
      logger.debug('  📌 Running WAL checkpoint...');
      db.exec('PRAGMA wal_checkpoint(RESTART)');
      logger.info('  ✅ WAL checkpoint complete - all writes merged to main database');
    } catch (err) {
      logger.warn(`  ⚠️  WAL checkpoint failed (non-critical): ${err.message}`);
    }
    
    // PHASE 3: CLEAR DATABASE IN CHUNKS (OPTIMIZED WITH BULK DELETION)
    logger.info('📍 PHASE 3: Clearing database tables (optimized bulk deletion)...');
    broadcast({ type: 'clearProgress', message: '📍 PHASE 3/8: Deleting records', phase: 3, percent: 37 });
    
    try {
      // Count records before deletion
      const speedTestResult = await dbGet('SELECT COUNT(*) as count FROM speed_tests');
      const speedTestCount = speedTestResult.count;
      logger.info(`  📊 Found ${speedTestCount} speed test records to delete`);
      
      if (speedTestCount > 0) {
        logger.info('  ⏳ Using optimized bulk deletion with ROWID ranges...');
        
        // Get min and max ROWID for efficient range-based deletion
        const rowIdResult = await dbGet('SELECT MIN(ROWID) as minId, MAX(ROWID) as maxId FROM speed_tests');
        const minId = rowIdResult.minId || 0;
        const maxId = rowIdResult.maxId || 0;
        const BATCH_SIZE = 50000; // Larger batches = faster deletion
        let batchNum = 0;
        
        for (let currentId = minId; currentId <= maxId; currentId += BATCH_SIZE) {
          const nextId = Math.min(currentId + BATCH_SIZE, maxId + 1);
          
          // Delete using ROWID range (much faster than LIMIT)
          await dbRun(
            'DELETE FROM speed_tests WHERE ROWID >= ? AND ROWID < ?',
            [currentId, nextId]
          );
          
          batchNum++;
          
          // Show progress
          const percentComplete = Math.min(100, Math.round(((currentId - minId) / (maxId - minId + 1)) * 100));
          const progressBar = '█'.repeat(Math.floor(percentComplete / 5)) + '░'.repeat(20 - Math.floor(percentComplete / 5));
          const progressMsg = `    ⏱️  Progress: [${progressBar}] ${percentComplete}% (batch ${batchNum})`;
          logger.info(progressMsg);
          
          // Broadcast progress to frontend
          broadcast({ type: 'clearProgress', message: progressMsg, phase: 3, percent: percentComplete });
          
          // Checkpoint WAL every 3 batches
          if (batchNum % 3 === 0) {
            try {
              db.exec('PRAGMA wal_checkpoint(RESTART)');
            } catch (e) {
              logger.warn(`    ⚠️  WAL checkpoint warning: ${e.message}`);
            }
          }
          
          await new Promise(resolve => setImmediate(resolve));
        }
        logger.info(`  ✅ Deleted ${speedTestCount} speed test records`);
      }
    } catch (err) {
      logger.error(`Error clearing speed_tests: ${err.message}`);
      throw err;
    }
    
    try {
      // Count live monitoring records
      const liveMonResult = await dbGet('SELECT COUNT(*) as count FROM live_monitoring');
      const liveMonCount = liveMonResult.count;
      logger.info(`  📊 Found ${liveMonCount} live monitoring records to delete`);
      
      if (liveMonCount > 0) {
        // For small tables, just delete all at once
        logger.info('  ⏳ Deleting live_monitoring (small table)...');
        await dbRun('DELETE FROM live_monitoring');
        logger.info(`  ✅ Deleted ${liveMonCount} live monitoring records`);
      }
    } catch (err) {
      logger.error(`Error clearing live_monitoring: ${err.message}`);
      throw err;
    }
    
    try {
      // Count live monitoring history records
      const liveMonHistResult = await dbGet('SELECT COUNT(*) as count FROM live_monitoring_history');
      const liveMonHistCount = liveMonHistResult.count;
      logger.info(`  📊 Found ${liveMonHistCount} live monitoring history records to delete`);
      
      if (liveMonHistCount > 0) {
        logger.info('  ⏳ Using single DELETE with optimal pragmas (fastest, safest method)...');
        
        try {
          // CRITICAL: Use optimal pragmas for bulk deletion
          logger.debug('  � Setting pragmas for optimal deletion...');
          
          // Disable synchronous writes temporarily for speed
          try {
            db.exec('PRAGMA synchronous = OFF');
            logger.debug('  ℹ️  Synchronous writes disabled (enabling after deletion)');
          } catch (e) {
            logger.warn('  ⚠️  Could not disable synchronous:', e.message);
          }
          
          // Delete all records at once (much safer than batching!)
          logger.debug('  🔪 Executing DELETE FROM live_monitoring_history (all records)...');
          const deleteStmt = db.prepare('DELETE FROM live_monitoring_history');
          deleteStmt.run();
          
          logger.info(`  ✅ Deleted ${liveMonHistCount} live monitoring history records`);
          
          // Re-enable synchronous writes
          try {
            db.exec('PRAGMA synchronous = NORMAL');
            logger.debug('  ✓ Synchronous writes re-enabled');
          } catch (e) {
            logger.warn('  ⚠️  Could not re-enable synchronous:', e.message);
          }
          
          // Immediate checkpoint to sync WAL
          try {
            logger.debug('  📌 Checkpointing WAL after deletion...');
            db.exec('PRAGMA wal_checkpoint(RESTART)');
            logger.debug('  ✓ WAL checkpoint complete');
          } catch (checkErr) {
            logger.warn(`  ⚠️  Post-deletion checkpoint failed: ${checkErr.message}`);
          }
        } catch (deleteErr) {
          // Re-enable synchronous on error
          try {
            db.exec('PRAGMA synchronous = NORMAL');
          } catch (e) {
            logger.warn('  ⚠️  Could not re-enable synchronous on error:', e.message);
          }
          
          logger.error(`Error deleting records: ${deleteErr.message}`);
          throw deleteErr;
        }
      }
    } catch (err) {
      logger.error(`Error clearing live_monitoring_history: ${err.message}`);
      
      // Attempt database recovery if corruption detected
      if (err.message.includes('malformed') || err.message.includes('corrupt')) {
        logger.error('🔨 Database corruption detected! Attempting recovery...');
        try {
          logger.info('  🔧 Running PRAGMA integrity_check...');
          const integrity = db.prepare('PRAGMA integrity_check').all();
          if (integrity[0]?.integrity_check !== 'ok') {
            logger.error('  ❌ Database integrity check failed');
            logger.info('  💾 Database file may need manual recovery or reset');
          }
        } catch (integrityErr) {
          logger.error('  ❌ Could not run integrity check:', integrityErr.message);
        }
      }
      
      throw err;
    }
    
    logger.info('✅ Database tables cleared');
    
    // PHASE 4: CLEAR IN-MEMORY DATA
    logger.info('📍 PHASE 4: Clearing in-memory data structures...');
    broadcast({ type: 'clearProgress', message: '📍 PHASE 4/8: Clearing memory', phase: 4, percent: 50 });
    
    logger.info('  🧹 Clearing monitoringData.history');
    monitoringData.history = [];
    
    logger.info('  🧹 Clearing monitoringData.liveMonitoring');
    monitoringData.liveMonitoring = {};
    
    logger.info('  🧹 Clearing notificationState.hostStatus');
    notificationState.hostStatus = {};
    
    logger.info('✅ In-memory data cleared');
    
    // PHASE 5: INVALIDATE CACHES
    logger.info('📍 PHASE 5: Invalidating caches...');
    broadcast({ type: 'clearProgress', message: '📍 PHASE 5/8: Invalidating caches', phase: 5, percent: 62 });
    
    logger.info('  🔄 Invalidating history cache');
    invalidateHistoryCache();
    
    logger.info('  🔄 Invalidating monitoring cache');
    invalidateMonitoringCache();
    
    logger.info('✅ Caches invalidated');
    
    // PHASE 6: Schedule VACUUM to run after response sent
    // (VACUUM must run after all queries complete and connection is released)
    logger.info('📍 PHASE 6: Scheduling database space reclamation...');
    broadcast({ type: 'clearProgress', message: '📍 PHASE 6/8: Preparing VACUUM', phase: 6, percent: 75 });
    
    // Run VACUUM asynchronously AFTER response is sent
    const vacuumAfterResponse = () => {
      setImmediate(() => {
        try {
          logger.info('  🧹 Running VACUUM (after response sent)...');
          const startSize = fs.statSync(dbPath).size;
          
          // Add small delay to ensure all connections are released
          setTimeout(() => {
            try {
              // CRITICAL: First, checkpoint the WAL to merge all writes into main file
              logger.debug('  📌 WAL checkpoint before VACUUM...');
              db.exec('PRAGMA wal_checkpoint(RESTART)');
              logger.debug('  ✅ WAL merged to main database');
              
              // CRITICAL: Ensure NO transactions are active before VACUUM
              logger.debug('  📌 Ensuring no active transactions...');
              try {
                db.exec('ROLLBACK');
              } catch (e) {
                logger.debug('  ℹ️  No active transaction to rollback');
              }
              
              // Now run VACUUM on the clean main file
              logger.debug('  📌 Executing VACUUM...');
              db.exec('VACUUM');
              logger.debug('  📌 Running PRAGMA optimize...');
              db.exec('PRAGMA optimize');
              
              // Give OS time to update file size
              setTimeout(() => {
                const endSize = fs.statSync(dbPath).size;
                const shrinkage = startSize - endSize;
                const shrinkPercent = shrinkage > 0 ? ((shrinkage / startSize) * 100).toFixed(1) : '0.0';
                
                if (shrinkage > 0) {
                  logger.info(`  ✅ VACUUM complete: ${(startSize / 1024 / 1024).toFixed(2)}MB → ${(endSize / 1024 / 1024).toFixed(2)}MB (${shrinkPercent}% reclaimed)`);
                  broadcast({ type: 'clearProgress', message: `✅ Database shrunk: ${(startSize / 1024 / 1024).toFixed(0)}MB → ${(endSize / 1024 / 1024).toFixed(0)}MB`, phase: 6, percent: 100 });
                } else {
                  logger.info(`  ℹ️  VACUUM complete: File size stable at ${(endSize / 1024 / 1024).toFixed(2)}MB (database already optimized)`);
                }
              }, 100);
            } catch (err) {
              logger.warn(`  ⚠️  VACUUM failed (non-critical): ${err.message}`);
            }
          }, 50);
        } catch (err) {
          logger.warn(`  ⚠️  VACUUM scheduling failed: ${err.message}`);
        }
      });
    };
    
    logger.info('✅ Database space reclamation scheduled for after response');
    
    // PHASE 7: BROADCAST UPDATE
    logger.info('📍 PHASE 7: Notifying clients...');
    broadcast({ type: 'clearProgress', message: '📍 PHASE 7/8: Notifying clients', phase: 7, percent: 87 });
    
    broadcast({ type: 'historyCleared' });
    logger.info('✅ Clients notified of data clear');
    
    logger.info('═══════════════════════════════════════════════════════');
    logger.info('🎉 CLEAR DATA OPERATION COMPLETED SUCCESSFULLY');
    logger.info('═══════════════════════════════════════════════════════');
    
    // PHASE 8: RESTART MONITORING
    logger.info('📍 PHASE 8: Restarting monitoring and speed tests...');
    broadcast({ type: 'clearProgress', message: '📍 PHASE 8/8: Restarting monitoring', phase: 8, percent: 100 });
    
    try {
      await startMonitoring();
      logger.info('✅ Monitoring and speed tests restarted');
    } catch (err) {
      logger.error('⚠️  Failed to restart monitoring:', err.message);
    }
    
    // Send response and schedule VACUUM for after
    res.json({ 
      message: 'All history and monitoring data cleared successfully',
      cleared: {
        speedTests: 'All records cleared',
        liveMonitoring: 'All records cleared',
        cache: 'All cache invalidated',
        monitoringRestarted: true
      }
    });
    
    // Now run VACUUM after response is sent
    vacuumAfterResponse();
    
  } catch (error) {
    logger.error('═══════════════════════════════════════════════════════');
    logger.error('❌ ERROR DURING CLEAR DATA OPERATION');
    logger.error(`Error: ${error.message}`);
    logger.error('Stack:', error.stack);
    logger.error('═══════════════════════════════════════════════════════');
    
    // Handle database corruption
    if (error.message.includes('malformed') || error.message.includes('corrupt')) {
      logger.error('🔨 DATABASE CORRUPTION DETECTED!');
      logger.error('  Possible causes:');
      logger.error('    • Sudden power loss or system crash during operation');
      logger.error('    • Disk I/O errors');
      logger.error('    • WAL file corruption');
      logger.error('');
      logger.error('  Recovery steps:');
      logger.error('    1. Stop the application');
      logger.error('    2. Delete the monitoring.db, monitoring.db-wal, and monitoring.db-shm files');
      logger.error('    3. Restart the application (new database will be created)');
      logger.error('');
      logger.error(`  Files to delete from: ${path.dirname(dbPath)}`);
      logger.error('    - monitoring.db');
      logger.error('    - monitoring.db-wal');
      logger.error('    - monitoring.db-shm');
    }
    
    res.status(500).json({ 
      error: 'Failed to clear data',
      message: error.message,
      suggestion: error.message.includes('malformed') ? 'Database corruption detected. Try deleting monitoring.db* files and restarting.' : undefined
    });
  }
});

// Manual data cleanup endpoint
app.post('/api/cleanup', async (req, res) => {
  try {
    logger.info('🧹 Manual data cleanup requested');
    await cleanupOldData();
    
    // Clear all server-side caches after successful cleanup
    logger.debug('🗑️  Clearing all server-side caches...');
    invalidateHistoryCache();
    invalidateMonitoringCache();
    invalidateSettingsCache();
    queryCache.flushAll();
    logger.debug('✓ Server caches cleared');
    
    // Restart monitoring after cleanup
    logger.info('🔄 Restarting monitoring after cleanup...');
    if (scheduledJob) {
      scheduledJob.cancel();
      logger.debug('  ✓ Previous scheduled job cancelled');
    }
    
    // Re-schedule the monitoring using current settings
    const interval = monitoringData.settings.testInterval || 30;
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
      }
    });
    logger.info(`✓ Monitoring restarted (speed tests every ${interval} minutes)`);
    
    // Broadcast cache clear event to frontend
    broadcast({
      type: 'cache_clear',
      message: 'Database cleanup completed - caches cleared',
      timestamp: new Date().toISOString()
    });
    
    logger.info('✓ Cache clear broadcast sent to clients');
    
    res.json({ 
      success: true, 
      message: 'Data cleanup completed successfully',
      cacheCleared: true,
      monitoringRestarted: true
    });
  } catch (error) {
    logger.error('Data cleanup failed:', error.message);
    res.status(500).json({ 
      error: 'Data cleanup failed',
      message: error.message
    });
  }
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
  
  // Cancel scheduled jobs
  if (scheduledJob) {
    scheduledJob.cancel();
    scheduledJob = null;
  }
  if (cleanupJob) {
    cleanupJob.cancel();
    cleanupJob = null;
  }
  
  db.close();
  process.exit(0);
});
