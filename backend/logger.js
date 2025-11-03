// Logger utility with timestamps and log levels
const logLevels = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
  SUCCESS: 1  // Same priority as INFO
};

const logLevelNames = {
  DEBUG: 'DEBUG',
  INFO: 'INFO',
  WARN: 'WARN',
  ERROR: 'ERROR',
  SUCCESS: 'SUCCESS'
};

// ANSI color codes
const colors = {
  DEBUG: '\x1b[36m',    // Cyan
  INFO: '\x1b[34m',     // Blue
  WARN: '\x1b[33m',     // Yellow
  ERROR: '\x1b[31m',    // Red
  SUCCESS: '\x1b[32m',  // Green
  RESET: '\x1b[0m',     // Reset
  DIM: '\x1b[2m'        // Dim
};

// Current log level (default: DEBUG = show everything)
let currentLogLevel = logLevels.DEBUG;

// WebSocket listener for broadcasting logs
let wsListener = null;
const logBuffer = []; // Buffer to store recent logs
const MAX_LOG_BUFFER = 200;

function formatTimestamp() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  const ms = String(now.getMilliseconds()).padStart(3, '0');
  
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}.${ms}`;
}

function log(level, message, ...args) {
  // Skip if log level is below current threshold
  if (logLevels[level] < currentLogLevel) {
    return;
  }
  
  const timestamp = formatTimestamp();
  const color = colors[level] || colors.INFO;
  const levelStr = level.padEnd(7);
  
  console.log(
    `${colors.DIM}${timestamp}${colors.RESET} ${color}[${levelStr}]${colors.RESET} - ${message}`,
    ...args
  );

  // Create log entry for WebSocket broadcasting
  const logEntry = {
    timestamp: timestamp,
    level: level,
    message: message,
    args: args
  };

  // Add to buffer
  logBuffer.push(logEntry);
  if (logBuffer.length > MAX_LOG_BUFFER) {
    logBuffer.shift();
  }

  // Broadcast to WebSocket listeners if available
  if (wsListener && typeof wsListener === 'function') {
    try {
      wsListener(logEntry);
    } catch (error) {
      // Silently fail if listener has issues
    }
  }
}

const logger = {
  debug: (message, ...args) => log(logLevelNames.DEBUG, message, ...args),
  info: (message, ...args) => log(logLevelNames.INFO, message, ...args),
  warn: (message, ...args) => log(logLevelNames.WARN, message, ...args),
  error: (message, ...args) => log(logLevelNames.ERROR, message, ...args),
  success: (message, ...args) => log(logLevelNames.SUCCESS, message, ...args),
  
  // Register WebSocket listener for log broadcasting
  setWebSocketListener: (listener) => {
    wsListener = listener;
  },
  
  // Get log buffer
  getLogBuffer: () => [...logBuffer],
  
  // Set log level
  setLevel: (level) => {
    const levelUpper = level.toUpperCase();
    if (logLevels[levelUpper] !== undefined) {
      currentLogLevel = logLevels[levelUpper];
      console.log(`${colors.INFO}[INFO   ]${colors.RESET} - Log level set to: ${levelUpper}`);
    } else {
      console.log(`${colors.WARN}[WARN   ]${colors.RESET} - Invalid log level: ${level}. Using DEBUG.`);
      currentLogLevel = logLevels.DEBUG;
    }
  },
  
  // Get current log level
  getLevel: () => {
    return Object.keys(logLevels).find(key => logLevels[key] === currentLogLevel) || 'DEBUG';
  }
};

module.exports = logger;

