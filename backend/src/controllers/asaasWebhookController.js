const crypto = require('crypto');
const pool = require('../config/database');
const { env } = require('../config/env');
const billingService = require('../services/billingService');
const logger = require('../utils/logger');

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

  if (!expectedToken || receivedToken !== expectedToken) {
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

    res.status(200).json({
      success: true,
      received: true
    });

    setImmediate(async () => {
      try {
        await billingService.syncPaymentStatusFromWebhook(payload);

        await pool.query(
          `
          UPDATE billing_events
          SET processed = 1, processed_at = NOW()
          WHERE event_id = ?
          `,
          [eventId]
        );
      } catch (processingError) {
        logger.error('Erro ao processar webhook Asaas', {
          service: 'billing',
          eventId,
          eventType,
          error: processingError
        });
      }
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  handleAsaasWebhook
};
