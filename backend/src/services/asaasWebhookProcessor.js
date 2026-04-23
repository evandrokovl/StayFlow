const pool = require('../config/database');
const billingService = require('./billingService');
const logger = require('../utils/logger');

async function processAsaasWebhookEvent({ eventId, eventType, payload }) {
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

    return {
      eventId,
      eventType,
      processed: true
    };
  } catch (error) {
    logger.error('Erro ao processar webhook Asaas', {
      service: 'billing',
      eventId,
      eventType,
      error
    });

    throw error;
  }
}

module.exports = {
  processAsaasWebhookEvent
};
