// Logger utility with timestamps and log levels
const logLevels = {
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
  const timestamp = formatTimestamp();
  const color = colors[level] || colors.INFO;
  const levelStr = level.padEnd(7);
  
  console.log(
    `${colors.DIM}${timestamp}${colors.RESET} ${color}[${levelStr}]${colors.RESET} - ${message}`,
    ...args
  );
}

const logger = {
  debug: (message, ...args) => log(logLevels.DEBUG, message, ...args),
  info: (message, ...args) => log(logLevels.INFO, message, ...args),
  warn: (message, ...args) => log(logLevels.WARN, message, ...args),
  error: (message, ...args) => log(logLevels.ERROR, message, ...args),
  success: (message, ...args) => log(logLevels.SUCCESS, message, ...args)
};

module.exports = logger;
