const express = require('express');
const crypto = require('crypto');
const { createRateLimiter } = require('../middlewares/rateLimit');
const { enqueueInboundResendWebhook } = require('../queues/jobQueue');
const logger = require('../utils/logger');
const { env } = require('../config/env');

const router = express.Router();

const inboundRateLimit = createRateLimiter({
  name: 'inbound_resend',
  windowMs: 60 * 1000,
  max: 30,
  message: 'Muitas requisições no webhook inbound. Tente novamente em instantes.'
});

function getWebhookSignature(req) {
  return (
    req.headers['x-webhook-secret'] ||
    req.headers['x-stayflow-webhook-secret'] ||
    null
  );
}

function validateWebhookSecret(req) {
  const signature = getWebhookSignature(req);

  if (!env.WEBHOOK_SECRET) {
    return !env.IS_PRODUCTION;
  }

  return signature && String(signature) === env.WEBHOOK_SECRET;
}

function buildFallbackJobId(payload) {
  return crypto
    .createHash('sha1')
    .update(JSON.stringify(payload || {}))
    .digest('hex')
    .slice(0, 24);
}

router.post('/resend', inboundRateLimit, async (req, res, next) => {
  try {
    if (!validateWebhookSecret(req)) {
      const err = new Error('Webhook sem autorização válida');
      err.statusCode = 401;
      throw err;
    }

    const event = req.body || {};
    const eventType = event.type || 'unknown';
    const data = event.data || {};
    const emailId = data.email_id || data.id || null;

    if (eventType !== 'email.received') {
      return res.status(200).json({
        success: true,
        ignored: true,
        message: 'Evento ignorado'
      });
    }

    const job = await enqueueInboundResendWebhook(event);

    logger.info('Webhook inbound enfileirado com sucesso', {
      service: 'inbound',
      eventType,
      emailId,
      jobId: job.id || buildFallbackJobId(event)
    });

    return res.status(202).json({
      success: true,
      queued: true,
      message: 'Webhook recebido e enfileirado com sucesso',
      email_id: emailId,
      job_id: job.id || null
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;