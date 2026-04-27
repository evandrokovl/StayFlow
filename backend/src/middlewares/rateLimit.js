const logger = require('../utils/logger');
const { getRedisConnection } = require('../config/redis');

function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];

  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0].trim();
  }

  return (
    req.ip ||
    req.connection?.remoteAddress ||
    req.socket?.remoteAddress ||
    'unknown'
  );
}

function createRateLimiter(options = {}) {
  const {
    windowMs = 60 * 1000,
    max = 10,
    message = 'Muitas requisições. Tente novamente mais tarde.',
    keyGenerator = getClientIp,
    name = 'rate_limit'
  } = options;

  const redis = getRedisConnection();

  function buildRedisKey(key) {
    return `rate_limit:${name}:${String(key).replace(/[^a-zA-Z0-9:._-]/g, '_')}`;
  }

  return async function rateLimitMiddleware(req, res, next) {
    const key = keyGenerator(req);
    const redisKey = buildRedisKey(key);

    try {
      const count = await redis.incr(redisKey);

      if (count === 1) {
        await redis.pexpire(redisKey, windowMs);
      }

      let remainingMs = await redis.pttl(redisKey);
      if (remainingMs < 0) {
        await redis.pexpire(redisKey, windowMs);
        remainingMs = windowMs;
      }

      const retryAfterSeconds = Math.ceil(Math.max(remainingMs, 0) / 1000);

      if (count > max) {
        logger.warn('Rate limit excedido', {
          service: 'api',
          middleware: 'rateLimit',
          limiterName: name,
          ip: key,
          method: req.method,
          url: req.originalUrl,
          max,
          windowMs,
          retryAfterSeconds
        });

        res.setHeader('Retry-After', String(retryAfterSeconds));

        return res.status(429).json({
          success: false,
          requestId: req.requestId || req.id || null,
          message,
          retry_after_seconds: retryAfterSeconds
        });
      }

      return next();
    } catch (error) {
      logger.error('Erro ao consultar rate limit no Redis', {
        service: 'api',
        middleware: 'rateLimit',
        limiterName: name,
        ip: key,
        method: req.method,
        url: req.originalUrl,
        error
      });

      return res.status(503).json({
        success: false,
        requestId: req.requestId || req.id || null,
        message: 'Servico temporariamente indisponivel. Tente novamente em instantes.'
      });
    }
  };
}

module.exports = {
  createRateLimiter
};
