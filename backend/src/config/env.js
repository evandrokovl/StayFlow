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

function getBooleanEnv(name, defaultValue = false) {
  const raw = process.env[name];

  if (raw === undefined || raw === null || String(raw).trim() === '') {
    return defaultValue;
  }

  const normalized = String(raw).trim().toLowerCase();

  if (['true', '1', 'yes', 'y', 'on'].includes(normalized)) return true;
  if (['false', '0', 'no', 'n', 'off'].includes(normalized)) return false;

  throw new Error(`Variavel de ambiente invalida (boolean esperado): ${name}`);
}

const nodeEnv = process.env.NODE_ENV || 'development';
const isProduction = nodeEnv === 'production';
const appBaseUrl = requireEnv('APP_BASE_URL', { defaultValue: 'http://localhost:3000' });

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
  DB_SSL_ENABLED: getBooleanEnv('DB_SSL_ENABLED', false),
  DB_SSL_REJECT_UNAUTHORIZED: getBooleanEnv('DB_SSL_REJECT_UNAUTHORIZED', true),

  APP_BASE_URL: appBaseUrl,
  FRONTEND_BASE_URL: requireEnv('FRONTEND_BASE_URL', { defaultValue: appBaseUrl }),
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

  ASAAS_BASE_URL: requireEnv('ASAAS_BASE_URL', { defaultValue: 'https://api-sandbox.asaas.com/v3' }),
  ASAAS_API_KEY: process.env.ASAAS_API_KEY ? String(process.env.ASAAS_API_KEY).trim() : '',
  ASAAS_WEBHOOK_TOKEN: process.env.ASAAS_WEBHOOK_TOKEN ? String(process.env.ASAAS_WEBHOOK_TOKEN).trim() : '',

  CORS_ORIGINS: (process.env.CORS_ORIGINS || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
};

module.exports = {
  env
};
