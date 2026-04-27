const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const authMiddleware = require('../middlewares/authMiddleware');
const { requireFullBilling, requireWritableBilling } = require('../middlewares/billingAccessMiddleware');
const { processMessageAutomations } = require('../services/messageAutomationService');
const validate = require('../middlewares/validate');
const { idParamSchema } = require('../schemas/commonSchemas');
const logger = require('../utils/logger');
const {
  messageAutomationCreateSchema,
  messageAutomationUpdateSchema
} = require('../schemas/messageAutomationSchemas');

router.use(authMiddleware);

// LISTAR automações
router.get('/', requireFullBilling, async (req, res) => {
  try {
    const userId = req.user.id;

    const [rows] = await pool.query(
      `
      SELECT
        ma.id,
        ma.user_id,
        ma.property_id,
        ma.template_id,
        ma.name,
        ma.trigger_type,
        ma.trigger_offset_value,
        ma.trigger_offset_unit,
        ma.is_active,
        ma.created_at,
        ma.updated_at,
        p.name AS property_name,
        mt.name AS template_name,
        mt.channel AS template_channel
      FROM message_automations ma
      LEFT JOIN properties p ON p.id = ma.property_id
      JOIN message_templates mt ON mt.id = ma.template_id
      WHERE ma.user_id = ?
      ORDER BY ma.id DESC
      `,
      [userId]
    );

    res.json(rows);
  } catch (error) {
    logger.error("Erro ao listar automações", { service: 'api', route: req.originalUrl, userId: req.user?.id || null, error });
    res.status(500).json({ error: 'Erro ao listar automações' });
  }
});

// CRIAR automação
router.post('/', requireWritableBilling, validate(messageAutomationCreateSchema), async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      property_id,
      template_id,
      name,
      trigger_type,
      trigger_offset_value,
      trigger_offset_unit,
      is_active
    } = req.body;

    if (!template_id || !name || !trigger_type) {
      return res.status(400).json({
        error: 'template_id, name e trigger_type são obrigatórios'
      });
    }

    const allowedTriggers = [
      'reservation_created',
      'before_checkin',
      'checkin_day',
      'before_checkout',
      'checkout_day',
      'after_checkout'
    ];

    const allowedUnits = ['minutes', 'hours', 'days'];

    if (!allowedTriggers.includes(trigger_type)) {
      return res.status(400).json({ error: 'trigger_type inválido' });
    }

    const safeUnit = allowedUnits.includes(trigger_offset_unit) ? trigger_offset_unit : 'days';
    const safeOffset = Number.isInteger(Number(trigger_offset_value)) ? Number(trigger_offset_value) : 0;
    const safeActive = is_active === 0 || is_active === false ? 0 : 1;

    const [templateRows] = await pool.query(
      `
      SELECT id
      FROM message_templates
      WHERE id = ? AND user_id = ?
      LIMIT 1
      `,
      [template_id, userId]
    );

    if (templateRows.length === 0) {
      return res.status(404).json({ error: 'Template não encontrado' });
    }

    if (property_id) {
      const [propertyRows] = await pool.query(
        `
        SELECT id
        FROM properties
        WHERE id = ? AND user_id = ?
        LIMIT 1
        `,
        [property_id, userId]
      );

      if (propertyRows.length === 0) {
        return res.status(404).json({ error: 'Imóvel não encontrado' });
      }
    }

    const [result] = await pool.query(
      `
      INSERT INTO message_automations (
        user_id,
        property_id,
        template_id,
        name,
        trigger_type,
        trigger_offset_value,
        trigger_offset_unit,
        is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        userId,
        property_id || null,
        template_id,
        name,
        trigger_type,
        safeOffset,
        safeUnit,
        safeActive
      ]
    );

    const [rows] = await pool.query(
      `
      SELECT *
      FROM message_automations
      WHERE id = ? AND user_id = ?
      LIMIT 1
      `,
      [result.insertId, userId]
    );

    res.status(201).json({
      message: 'Automação criada com sucesso',
      automation: rows[0]
    });
  } catch (error) {
    logger.error("Erro ao criar automação", { service: 'api', route: req.originalUrl, userId: req.user?.id || null, error });
    res.status(500).json({ error: 'Erro ao criar automação' });
  }
});

// ATUALIZAR automação
router.put('/:id', requireWritableBilling, validate(messageAutomationUpdateSchema), async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const {
      property_id,
      template_id,
      name,
      trigger_type,
      trigger_offset_value,
      trigger_offset_unit,
      is_active
    } = req.body;

    if (!template_id || !name || !trigger_type) {
      return res.status(400).json({
        error: 'template_id, name e trigger_type são obrigatórios'
      });
    }

    const allowedTriggers = [
      'reservation_created',
      'before_checkin',
      'checkin_day',
      'before_checkout',
      'checkout_day',
      'after_checkout'
    ];

    const allowedUnits = ['minutes', 'hours', 'days'];

    if (!allowedTriggers.includes(trigger_type)) {
      return res.status(400).json({ error: 'trigger_type inválido' });
    }

    const safeUnit = allowedUnits.includes(trigger_offset_unit) ? trigger_offset_unit : 'days';
    const safeOffset = Number.isInteger(Number(trigger_offset_value)) ? Number(trigger_offset_value) : 0;
    const safeActive = is_active === 0 || is_active === false ? 0 : 1;

    const [existing] = await pool.query(
      `
      SELECT id
      FROM message_automations
      WHERE id = ? AND user_id = ?
      LIMIT 1
      `,
      [id, userId]
    );

    if (existing.length === 0) {
      return res.status(404).json({ error: 'Automação não encontrada' });
    }

    const [templateRows] = await pool.query(
      `
      SELECT id
      FROM message_templates
      WHERE id = ? AND user_id = ?
      LIMIT 1
      `,
      [template_id, userId]
    );

    if (templateRows.length === 0) {
      return res.status(404).json({ error: 'Template não encontrado' });
    }

    if (property_id) {
      const [propertyRows] = await pool.query(
        `
        SELECT id
        FROM properties
        WHERE id = ? AND user_id = ?
        LIMIT 1
        `,
        [property_id, userId]
      );

      if (propertyRows.length === 0) {
        return res.status(404).json({ error: 'Imóvel não encontrado' });
      }
    }

    await pool.query(
      `
      UPDATE message_automations
      SET
        property_id = ?,
        template_id = ?,
        name = ?,
        trigger_type = ?,
        trigger_offset_value = ?,
        trigger_offset_unit = ?,
        is_active = ?,
        updated_at = NOW()
      WHERE id = ? AND user_id = ?
      `,
      [
        property_id || null,
        template_id,
        name,
        trigger_type,
        safeOffset,
        safeUnit,
        safeActive,
        id,
        userId
      ]
    );

    const [rows] = await pool.query(
      `
      SELECT *
      FROM message_automations
      WHERE id = ? AND user_id = ?
      LIMIT 1
      `,
      [id, userId]
    );

    res.json({
      message: 'Automação atualizada com sucesso',
      automation: rows[0]
    });
  } catch (error) {
    logger.error("Erro ao atualizar automação", { service: 'api', route: req.originalUrl, userId: req.user?.id || null, error });
    res.status(500).json({ error: 'Erro ao atualizar automação' });
  }
});

// EXCLUIR automação
router.delete('/:id', requireWritableBilling, validate(idParamSchema), async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const [existing] = await pool.query(
      `
      SELECT id
      FROM message_automations
      WHERE id = ? AND user_id = ?
      LIMIT 1
      `,
      [id, userId]
    );

    if (existing.length === 0) {
      return res.status(404).json({ error: 'Automação não encontrada' });
    }

    await pool.query(
      `
      DELETE FROM message_logs
      WHERE automation_id = ?
      `,
      [id]
    );

    await pool.query(
      `
      DELETE FROM message_automations
      WHERE id = ? AND user_id = ?
      `,
      [id, userId]
    );

    res.json({
      message: 'Automação excluída com sucesso'
    });
  } catch (error) {
    logger.error("Erro ao excluir automação", { service: 'api', route: req.originalUrl, userId: req.user?.id || null, error });
    res.status(500).json({ error: 'Erro ao excluir automação' });
  }
});

// PROCESSAR automações manualmente
router.post('/process/run', requireWritableBilling, async (req, res) => {
  try {
    const result = await processMessageAutomations(req.user.id);

    res.json({
      success: true,
      message: 'Processamento executado com sucesso',
      result
    });
  } catch (error) {
    logger.error("Erro ao processar automações", { service: 'api', route: req.originalUrl, userId: req.user?.id || null, error });
    res.status(500).json({
      success: false,
      error: 'Erro ao processar automações'
    });
  }
});

module.exports = router;
