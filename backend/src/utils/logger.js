const { env } = require('../config/env');
const { saveSystemLog } = require('../repositories/systemLogRepository');

const LEVELS = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40
};

function getCurrentLevelValue() {
  return LEVELS[env.LOG_LEVEL] || LEVELS.info;
}

function shouldLog(level) {
  return (LEVELS[level] || LEVELS.info) >= getCurrentLevelValue();
}

function serializeError(error) {
  if (!error) return undefined;

  return {
    message: error.message,
    stack: error.stack,
    name: error.name
  };
}

function safeMeta(meta) {
  if (!meta || typeof meta !== 'object') {
    return {};
  }

  const output = { ...meta };

  if (output.error instanceof Error) {
    output.error = serializeError(output.error);
  }

  return output;
}

function extractService(meta) {
  if (!meta || typeof meta !== 'object') return null;
  return meta.service || null;
}

function extractUserId(meta) {
  if (!meta || typeof meta !== 'object') return null;
  return meta.userId || meta.user_id || null;
}

function formatLine(level, message, meta = {}) {
  const payload = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...safeMeta(meta)
  };

  return JSON.stringify(payload);
}

function persistToDatabase(level, message, meta = {}) {
  if (!['warn', 'error'].includes(level)) {
    return;
  }

  const safe = safeMeta(meta);

  saveSystemLog({
    level,
    message,
    service: extractService(safe),
    userId: extractUserId(safe),
    context: safe
  }).catch(() => {
    // silencioso: o próprio repository já faz fallback em console.error
  });
}

function write(level, message, meta = {}) {
  if (!shouldLog(level)) {
    return;
  }

  const line = formatLine(level, message, meta);

  if (level === 'error') {
    console.error(line);
    persistToDatabase(level, message, meta);
    return;
  }

  if (level === 'warn') {
    console.warn(line);
    persistToDatabase(level, message, meta);
    return;
  }

  console.log(line);
}

module.exports = {
  debug(message, meta) {
    write('debug', message, meta);
  },

  info(message, meta) {
    write('info', message, meta);
  },

  warn(message, meta) {
    write('warn', message, meta);
  },

  error(message, meta) {
    write('error', message, meta);
  }
};