const logger = require('../utils/logger');

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

  const hits = new Map();

  function cleanup(now) {
    for (const [key, entry] of hits.entries()) {
      if (entry.resetAt <= now) {
        hits.delete(key);
      }
    }
  }

  return function rateLimitMiddleware(req, res, next) {
    const now = Date.now();

    cleanup(now);

    const key = keyGenerator(req);
    const existing = hits.get(key);

    if (!existing || existing.resetAt <= now) {
      hits.set(key, {
        count: 1,
        resetAt: now + windowMs
      });

      return next();
    }

    existing.count += 1;

    const remainingMs = Math.max(existing.resetAt - now, 0);
    const retryAfterSeconds = Math.ceil(remainingMs / 1000);

    if (existing.count > max) {
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
        message,
        retry_after_seconds: retryAfterSeconds
      });
    }

    next();
  };
}

module.exports = {
  createRateLimiter
};