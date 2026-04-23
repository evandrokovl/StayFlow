const express = require('express');
const crypto = require('crypto');
const { createRateLimiter } = require('../middlewares/rateLimit');
const { enqueueInboundResendWebhook, jobQueue } = require('../queues/jobQueue');
const pool = require('../config/database');
const authMiddleware = require('../middlewares/authMiddleware');
const { requireFullBilling, requireWritableBilling } = require('../middlewares/billingAccessMiddleware');
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
  const expectedSecret = env.WEBHOOK_SECRET;

  if (!expectedSecret || !signature) {
    return false;
  }

  const received = Buffer.from(String(signature));
  const expected = Buffer.from(String(expectedSecret));

  return received.length === expected.length && crypto.timingSafeEqual(received, expected);
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

router.use(authMiddleware);
router.use(requireFullBilling);

router.get('/', async (req, res, next) => {
  try {
    const {
      status,
      property_id,
      from,
      to,
      limit = 100
    } = req.query;

    const params = [req.user.id];
    let where = 'WHERE ie.user_id = ?';

    if (status) {
      where += ' AND ie.parsing_status = ?';
      params.push(status);
    }

    if (property_id) {
      where += ' AND ie.property_id = ?';
      params.push(Number(property_id));
    }

    if (from) {
      where += ' AND DATE(ie.created_at) >= ?';
      params.push(from);
    }

    if (to) {
      where += ' AND DATE(ie.created_at) <= ?';
      params.push(to);
    }

    const safeLimit = Math.min(Math.max(Number(limit) || 100, 1), 500);

    const [rows] = await pool.query(
      `
      SELECT
        ie.id,
        ie.property_id,
        ie.created_reservation_id,
        ie.provider,
        ie.event_type,
        ie.email_id,
        ie.to_email,
        ie.from_email,
        ie.subject,
        ie.parsing_status,
        ie.parsing_notes,
        ie.raw_payload,
        ie.created_at,
        ie.updated_at,
        p.name AS property_name
      FROM inbound_emails ie
      LEFT JOIN properties p ON p.id = ie.property_id
      ${where}
      ORDER BY ie.id DESC
      LIMIT ?
      `,
      [...params, safeLimit]
    );

    const emails = rows.map((row) => {
      const rawPayload = tryParseJson(row.raw_payload);
      const parseResult = rawPayload?.parse_result || {};

      return {
        id: row.id,
        property_id: row.property_id,
        created_reservation_id: row.created_reservation_id,
        provider: row.provider,
        event_type: row.event_type,
        email_id: row.email_id,
        to_email: row.to_email,
        from_email: row.from_email,
        subject: row.subject,
        parsing_status: row.parsing_status,
        parsing_notes: row.parsing_notes,
        created_at: row.created_at,
        updated_at: row.updated_at,
        property_name: row.property_name,
        platform: rawPayload?.detected_platform || rawPayload?.detected_source || parseResult.platform || 'unknown',
        action: rawPayload?.detected_action || parseResult.action || rawPayload?.workflow_action || 'unknown',
        confidence: parseResult.confidence ?? null,
        raw_payload: rawPayload
      };
    });

    return res.json({
      success: true,
      total: emails.length,
      emails
    });
  } catch (error) {
    next(error);
  }
});

router.post('/:id/reprocess', requireWritableBilling, async (req, res, next) => {
  try {
    const inboundEmailId = Number(req.params.id);

    if (!inboundEmailId) {
      return res.status(400).json({
        success: false,
        message: 'ID do inbound inválido'
      });
    }

    const [rows] = await pool.query(
      `
      SELECT id, raw_payload
      FROM inbound_emails
      WHERE id = ?
        AND user_id = ?
      LIMIT 1
      `,
      [inboundEmailId, req.user.id]
    );

    if (!rows.length) {
      return res.status(404).json({
        success: false,
        message: 'Inbound não encontrado'
      });
    }

    const rawPayload = tryParseJson(rows[0].raw_payload);
    const webhookEvent = rawPayload?.webhook_event;

    if (!webhookEvent) {
      return res.status(400).json({
        success: false,
        message: 'Inbound não possui payload original para reprocessamento'
      });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const job = await jobQueue.add(
      'inbound_resend',
      { payload: webhookEvent },
      {
        jobId: `inbound_reprocess_${inboundEmailId}_${timestamp}`,
        removeOnComplete: 200,
        removeOnFail: 500
      }
    );

    return res.status(202).json({
      success: true,
      queued: true,
      message: 'Inbound reenfileirado para reprocessamento',
      inbound_email_id: inboundEmailId,
      job_id: job.id
    });
  } catch (error) {
    next(error);
  }
});

function tryParseJson(value) {
  if (!value) return null;

  try {
    return typeof value === 'string' ? JSON.parse(value) : value;
  } catch {
    return null;
  }
}

module.exports = router;
