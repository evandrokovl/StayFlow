const express = require('express');
const router = express.Router();

const pool = require('../config/database');
const authMiddleware = require('../middlewares/authMiddleware');
const { requireFullBilling, requireWritableBilling } = require('../middlewares/billingAccessMiddleware');
const { jobQueue } = require('../queues/jobQueue');

router.use(authMiddleware);
router.use(requireFullBilling);

async function findMessageLogForUser(messageLogId, userId) {
  const [rows] = await pool.query(
    `
    SELECT
      ml.id,
      ml.status,
      ml.channel,
      ml.guest_contact,
      ml.reservation_id,
      ml.property_id,
      ma.user_id
    FROM message_logs ml
    JOIN message_automations ma ON ma.id = ml.automation_id
    WHERE ml.id = ?
      AND ma.user_id = ?
    LIMIT 1
    `,
    [messageLogId, userId]
  );

  return rows[0] || null;
}

async function enqueueMessageLogEmail(messageLogId, mode) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

  return jobQueue.add(
    'send_guest_email',
    { messageLogId, mode },
    {
      jobId: `send_guest_email_${mode}_${messageLogId}_${timestamp}`,
      removeOnComplete: 200,
      removeOnFail: 500
    }
  );
}

// RESUMO OPERACIONAL DOS LOGS
router.get('/summary', async (req, res, next) => {
  try {
    const userId = req.user.id;

    const [rows] = await pool.query(
      `
      SELECT
        ml.status,
        COUNT(*) AS total
      FROM message_logs ml
      JOIN message_automations ma ON ma.id = ml.automation_id
      WHERE ma.user_id = ?
      GROUP BY ml.status
      `,
      [userId]
    );

    const summary = {
      pending: 0,
      needs_contact: 0,
      sent: 0,
      failed: 0,
      processed: 0,
      queued: 0,
      total: 0
    };

    for (const row of rows) {
      const status = String(row.status || '').trim();
      const total = Number(row.total || 0);

      if (!summary[status] && summary[status] !== 0) {
        summary[status] = 0;
      }

      summary[status] += total;
      summary.total += total;
    }

    res.json({
      success: true,
      summary
    });
  } catch (error) {
    next(error);
  }
});

// LISTAR APENAS PENDENTES
router.get('/pending', async (req, res, next) => {
  try {
    const userId = req.user.id;

    const [rows] = await pool.query(
      `
      SELECT
        ml.id,
        ml.automation_id,
        ml.reservation_id,
        ml.property_id,
        ml.channel,
        ml.guest_name,
        ml.guest_contact,
        ml.subject,
        ml.scheduled_for,
        ml.processed_at,
        ml.sent_at,
        ml.status,
        ml.error_message,
        ml.created_at,
        ma.name AS automation_name,
        p.name AS property_name
      FROM message_logs ml
      JOIN message_automations ma ON ma.id = ml.automation_id
      JOIN properties p ON p.id = ml.property_id
      WHERE ma.user_id = ?
        AND ml.status = 'pending'
      ORDER BY ml.scheduled_for ASC, ml.id ASC
      `,
      [userId]
    );

    res.json({
      success: true,
      total: rows.length,
      logs: rows
    });
  } catch (error) {
    next(error);
  }
});

// LISTAR FALHAS
router.get('/failed', async (req, res, next) => {
  try {
    const userId = req.user.id;

    const [rows] = await pool.query(
      `
      SELECT
        ml.id,
        ml.automation_id,
        ml.reservation_id,
        ml.property_id,
        ml.channel,
        ml.guest_name,
        ml.guest_contact,
        ml.subject,
        ml.scheduled_for,
        ml.processed_at,
        ml.sent_at,
        ml.status,
        ml.error_message,
        ml.created_at,
        ma.name AS automation_name,
        p.name AS property_name
      FROM message_logs ml
      JOIN message_automations ma ON ma.id = ml.automation_id
      JOIN properties p ON p.id = ml.property_id
      WHERE ma.user_id = ?
        AND ml.status = 'failed'
      ORDER BY ml.id DESC
      `,
      [userId]
    );

    res.json({
      success: true,
      total: rows.length,
      logs: rows
    });
  } catch (error) {
    next(error);
  }
});

// LISTAR SEM CONTATO
router.get('/needs-contact', async (req, res, next) => {
  try {
    const userId = req.user.id;

    const [rows] = await pool.query(
      `
      SELECT
        ml.id,
        ml.automation_id,
        ml.reservation_id,
        ml.property_id,
        ml.channel,
        ml.guest_name,
        ml.guest_contact,
        ml.subject,
        ml.scheduled_for,
        ml.processed_at,
        ml.sent_at,
        ml.status,
        ml.error_message,
        ml.created_at,
        ma.name AS automation_name,
        p.name AS property_name
      FROM message_logs ml
      JOIN message_automations ma ON ma.id = ml.automation_id
      JOIN properties p ON p.id = ml.property_id
      WHERE ma.user_id = ?
        AND ml.status = 'needs_contact'
      ORDER BY ml.id DESC
      `,
      [userId]
    );

    res.json({
      success: true,
      total: rows.length,
      logs: rows
    });
  } catch (error) {
    next(error);
  }
});

router.post('/:id/reprocess', requireWritableBilling, async (req, res, next) => {
  try {
    const messageLogId = Number(req.params.id);

    if (!messageLogId) {
      return res.status(400).json({
        success: false,
        message: 'ID do log de mensagem inválido'
      });
    }

    const messageLog = await findMessageLogForUser(messageLogId, req.user.id);

    if (!messageLog) {
      return res.status(404).json({
        success: false,
        message: 'Log de mensagem não encontrado'
      });
    }

    await pool.query(
      `
      UPDATE message_logs
      SET status = 'queued',
          processed_at = NOW(),
          error_message = NULL
      WHERE id = ?
      `,
      [messageLogId]
    );

    const job = await enqueueMessageLogEmail(messageLogId, 'reprocess');

    return res.status(202).json({
      success: true,
      queued: true,
      message: 'Mensagem reenfileirada para reprocessamento',
      job_id: job.id,
      message_log_id: messageLogId
    });
  } catch (error) {
    next(error);
  }
});

router.post('/:id/force-send', requireWritableBilling, async (req, res, next) => {
  try {
    const messageLogId = Number(req.params.id);

    if (!messageLogId) {
      return res.status(400).json({
        success: false,
        message: 'ID do log de mensagem inválido'
      });
    }

    const messageLog = await findMessageLogForUser(messageLogId, req.user.id);

    if (!messageLog) {
      return res.status(404).json({
        success: false,
        message: 'Log de mensagem não encontrado'
      });
    }

    if (messageLog.channel && messageLog.channel !== 'email') {
      return res.status(400).json({
        success: false,
        message: 'Apenas mensagens de email podem ser forçadas neste dispatcher'
      });
    }

    await pool.query(
      `
      UPDATE message_logs
      SET status = 'queued',
          scheduled_for = NOW(),
          processed_at = NOW(),
          error_message = NULL
      WHERE id = ?
      `,
      [messageLogId]
    );

    const job = await enqueueMessageLogEmail(messageLogId, 'force');

    return res.status(202).json({
      success: true,
      queued: true,
      message: 'Envio forçado enfileirado',
      job_id: job.id,
      message_log_id: messageLogId
    });
  } catch (error) {
    next(error);
  }
});

// LISTAR LOGS DO USUÁRIO
router.get('/', async (req, res, next) => {
  try {
    const userId = req.user.id;

    const [rows] = await pool.query(
      `
      SELECT
        ml.id,
        ml.automation_id,
        ml.reservation_id,
        ml.property_id,
        ml.channel,
        ml.guest_name,
        ml.guest_contact,
        ml.subject,
        ml.body_rendered,
        ml.scheduled_for,
        ml.processed_at,
        ml.sent_at,
        ml.status,
        ml.error_message,
        ml.created_at,
        ma.name AS automation_name,
        p.name AS property_name
      FROM message_logs ml
      JOIN message_automations ma ON ma.id = ml.automation_id
      JOIN properties p ON p.id = ml.property_id
      WHERE ma.user_id = ?
      ORDER BY ml.id DESC
      `,
      [userId]
    );

    res.json(rows);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
