const crypto = require('crypto');
const pool = require('../config/database');
const { env } = require('../config/env');
const { enqueueAsaasWebhookEvent } = require('../queues/jobQueue');

function resolveEventId(payload) {
  if (payload.id) return String(payload.id);
  if (payload.eventId) return String(payload.eventId);

  const eventType = payload.event || payload.event_type || 'UNKNOWN';
  const payment = payload.payment || {};
  const base = [
    eventType,
    payment.id || payload.paymentId || '',
    payment.status || '',
    payment.dateCreated || payload.dateCreated || '',
    payment.dueDate || ''
  ].join('|');

  return crypto.createHash('sha256').update(base).digest('hex');
}

function validateWebhookToken(req) {
  const expectedToken = env.ASAAS_WEBHOOK_TOKEN;
  const receivedToken = req.headers['asaas-access-token'];

  if (!expectedToken || !receivedToken) {
    const err = new Error('Webhook Asaas nao autorizado');
    err.statusCode = 401;
    throw err;
  }

  const received = Buffer.from(String(receivedToken));
  const expected = Buffer.from(String(expectedToken));

  if (received.length !== expected.length || !crypto.timingSafeEqual(received, expected)) {
    const err = new Error('Webhook Asaas nao autorizado');
    err.statusCode = 401;
    throw err;
  }
}

async function handleAsaasWebhook(req, res, next) {
  try {
    validateWebhookToken(req);

    const payload = req.body || {};
    const eventType = payload.event || payload.event_type || 'UNKNOWN';
    const eventId = resolveEventId(payload);

    const [insertResult] = await pool.query(
      `
      INSERT IGNORE INTO billing_events (
        provider,
        event_id,
        event_type,
        processed,
        payload_json
      ) VALUES ('ASAAS', ?, ?, 0, ?)
      `,
      [eventId, eventType, JSON.stringify(payload)]
    );

    if (insertResult.affectedRows === 0) {
      return res.status(200).json({
        success: true,
        duplicated: true
      });
    }

    const job = await enqueueAsaasWebhookEvent({
      eventId,
      eventType,
      payload
    });

    return res.status(202).json({
      success: true,
      received: true,
      queued: true,
      job_id: job.id || null
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  handleAsaasWebhook
};
