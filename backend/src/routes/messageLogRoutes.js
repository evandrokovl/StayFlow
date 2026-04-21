const express = require('express');
const router = express.Router();

const pool = require('../config/database');
const authMiddleware = require('../middlewares/authMiddleware');

router.use(authMiddleware);

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