const pool = require('../config/database');
const { env } = require('../config/env');
const { getRedisConnection } = require('../config/redis');
const { jobQueue, queueName } = require('../queues/jobQueue');

function elapsedSince(startedAt) {
  return Date.now() - startedAt;
}

function safeReason(error) {
  if (!error) return undefined;

  return error.code || error.name || 'check_failed';
}

function withTimeout(promise, timeoutMs, label) {
  let timeoutId;
  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      const error = new Error(`${label} timeout`);
      error.code = 'CHECK_TIMEOUT';
      reject(error);
    }, timeoutMs);
  });

  return Promise.race([promise, timeout]).finally(() => clearTimeout(timeoutId));
}

async function runCheck(name, callback, options = {}) {
  const startedAt = Date.now();
  const timeoutMs = options.timeoutMs || 1500;

  try {
    const details = await withTimeout(Promise.resolve().then(callback), timeoutMs, name);

    return {
      status: 'ok',
      latencyMs: elapsedSince(startedAt),
      ...(details || {})
    };
  } catch (error) {
    return {
      status: 'degraded',
      latencyMs: elapsedSince(startedAt),
      reason: safeReason(error),
      ...(env.IS_PRODUCTION ? {} : { message: error.message })
    };
  }
}

function configCheck(enabled, details = {}) {
  return {
    status: enabled ? 'ok' : 'not_configured',
    enabled,
    ...details
  };
}

async function getSystemStatus({ requestId = null } = {}) {
  const checks = {
    api: {
      status: 'ok',
      uptimeSeconds: Math.round(process.uptime())
    },
    database: await runCheck('database', async () => {
      await pool.query('SELECT 1');
      return {};
    }),
    redis: await runCheck('redis', async () => {
      const redis = getRedisConnection();
      await redis.ping();
      return {};
    }),
    queue: await runCheck('queue', async () => {
      const counts = await jobQueue.getJobCounts('waiting', 'active', 'delayed', 'failed');
      return {
        queueName,
        counts
      };
    }),
    email: configCheck(Boolean(env.RESEND_API_KEY && env.EMAIL_FROM), {
      provider: 'resend'
    }),
    inbound: configCheck(Boolean(env.INBOUND_DOMAIN && (env.WEBHOOK_SECRET || !env.IS_PRODUCTION)), {
      domainConfigured: Boolean(env.INBOUND_DOMAIN),
      webhookProtected: Boolean(env.WEBHOOK_SECRET)
    })
  };

  const criticalChecks = ['database', 'redis', 'queue'];
  const hasCriticalFailure = criticalChecks.some((key) => checks[key]?.status === 'degraded');
  const status = hasCriticalFailure ? 'degraded' : 'ok';

  return {
    success: !hasCriticalFailure,
    status,
    service: 'api',
    requestId,
    timestamp: new Date().toISOString(),
    checks
  };
}

module.exports = {
  getSystemStatus,
  runCheck
};
