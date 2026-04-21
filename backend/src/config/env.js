function requireEnv(name, options = {}) {
  const value = process.env[name];

  if (value === undefined || value === null || String(value).trim() === '') {
    if (options.defaultValue !== undefined) {
      return options.defaultValue;
    }

    throw new Error(`Variável de ambiente obrigatória não definida: ${name}`);
  }

  return String(value).trim();
}

function getNumberEnv(name, defaultValue) {
  const raw = process.env[name];

  if (raw === undefined || raw === null || String(raw).trim() === '') {
    return defaultValue;
  }

  const parsed = Number(raw);

  if (Number.isNaN(parsed)) {
    throw new Error(`Variável de ambiente inválida (número esperado): ${name}`);
  }

  return parsed;
}

const nodeEnv = process.env.NODE_ENV || 'development';
const isProduction = nodeEnv === 'production';

const env = {
  NODE_ENV: nodeEnv,
  IS_PRODUCTION: isProduction,
  PORT: getNumberEnv('PORT', 3000),

  JWT_SECRET: requireEnv('JWT_SECRET'),

  DB_HOST: requireEnv('DB_HOST', { defaultValue: 'localhost' }),
  DB_PORT: getNumberEnv('DB_PORT', 3306),
  DB_USER: requireEnv('DB_USER'),
  DB_PASSWORD: requireEnv('DB_PASSWORD'),
  DB_NAME: requireEnv('DB_NAME'),

  APP_BASE_URL: requireEnv('APP_BASE_URL', { defaultValue: 'http://localhost:3000' }),
  INBOUND_DOMAIN: requireEnv('INBOUND_DOMAIN', { defaultValue: 'inbound.seudominio.com' }),

  RESEND_API_KEY: process.env.RESEND_API_KEY || '',
  EMAIL_FROM: process.env.EMAIL_FROM ? String(process.env.EMAIL_FROM).trim() : '',

  LOG_LEVEL: (process.env.LOG_LEVEL || 'info').toLowerCase(),

  REDIS_URL: process.env.REDIS_URL ? String(process.env.REDIS_URL).trim() : '',
  REDIS_HOST: requireEnv('REDIS_HOST', { defaultValue: '127.0.0.1' }),
  REDIS_PORT: getNumberEnv('REDIS_PORT', 6379),
  REDIS_PASSWORD: process.env.REDIS_PASSWORD ? String(process.env.REDIS_PASSWORD).trim() : '',
  REDIS_DB: getNumberEnv('REDIS_DB', 0),

  QUEUE_PREFIX: requireEnv('QUEUE_PREFIX', { defaultValue: 'stayflow' }),
  WEBHOOK_SECRET: isProduction
    ? requireEnv('WEBHOOK_SECRET')
    : (process.env.WEBHOOK_SECRET ? String(process.env.WEBHOOK_SECRET).trim() : ''),

  CORS_ORIGINS: (process.env.CORS_ORIGINS || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
};

module.exports = {
  env
};
