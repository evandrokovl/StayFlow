const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const authMiddleware = require('../middlewares/authMiddleware');

router.use(authMiddleware);

// LISTAR templates do usuário
router.get('/', async (req, res) => {
  try {
    const userId = req.user.id;

    const [rows] = await pool.query(
      `
      SELECT id, user_id, name, channel, subject, body, created_at, updated_at
      FROM message_templates
      WHERE user_id = ?
      ORDER BY id DESC
      `,
      [userId]
    );

    res.json(rows);
  } catch (error) {
    console.error('Erro ao listar templates:', error.message);
    res.status(500).json({ error: 'Erro ao listar templates' });
  }
});

// BUSCAR template por id
router.get('/:id', async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const [rows] = await pool.query(
      `
      SELECT id, user_id, name, channel, subject, body, created_at, updated_at
      FROM message_templates
      WHERE id = ? AND user_id = ?
      LIMIT 1
      `,
      [id, userId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Template não encontrado' });
    }

    res.json(rows[0]);
  } catch (error) {
    console.error('Erro ao buscar template:', error.message);
    res.status(500).json({ error: 'Erro ao buscar template' });
  }
});

// CRIAR template
router.post('/', async (req, res) => {
  try {
    const userId = req.user.id;
    const { name, channel, subject, body } = req.body;

    if (!name || !body) {
      return res.status(400).json({
        error: 'name e body são obrigatórios'
      });
    }

    const allowedChannels = ['email', 'whatsapp'];
    const safeChannel = allowedChannels.includes(channel) ? channel : 'email';

    const [result] = await pool.query(
      `
      INSERT INTO message_templates (
        user_id, name, channel, subject, body
      ) VALUES (?, ?, ?, ?, ?)
      `,
      [userId, name, safeChannel, subject || null, body]
    );

    const [rows] = await pool.query(
      `
      SELECT id, user_id, name, channel, subject, body, created_at, updated_at
      FROM message_templates
      WHERE id = ? AND user_id = ?
      LIMIT 1
      `,
      [result.insertId, userId]
    );

    res.status(201).json({
      message: 'Template criado com sucesso',
      template: rows[0]
    });
  } catch (error) {
    console.error('Erro ao criar template:', error.message);
    res.status(500).json({ error: 'Erro ao criar template' });
  }
});

// ATUALIZAR template
router.put('/:id', async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { name, channel, subject, body } = req.body;

    if (!name || !body) {
      return res.status(400).json({
        error: 'name e body são obrigatórios'
      });
    }

    const [existing] = await pool.query(
      `
      SELECT id
      FROM message_templates
      WHERE id = ? AND user_id = ?
      LIMIT 1
      `,
      [id, userId]
    );

    if (existing.length === 0) {
      return res.status(404).json({ error: 'Template não encontrado' });
    }

    const allowedChannels = ['email', 'whatsapp'];
    const safeChannel = allowedChannels.includes(channel) ? channel : 'email';

    await pool.query(
      `
      UPDATE message_templates
      SET
        name = ?,
        channel = ?,
        subject = ?,
        body = ?,
        updated_at = NOW()
      WHERE id = ? AND user_id = ?
      `,
      [name, safeChannel, subject || null, body, id, userId]
    );

    const [rows] = await pool.query(
      `
      SELECT id, user_id, name, channel, subject, body, created_at, updated_at
      FROM message_templates
      WHERE id = ? AND user_id = ?
      LIMIT 1
      `,
      [id, userId]
    );

    res.json({
      message: 'Template atualizado com sucesso',
      template: rows[0]
    });
  } catch (error) {
    console.error('Erro ao atualizar template:', error.message);
    res.status(500).json({ error: 'Erro ao atualizar template' });
  }
});

// EXCLUIR template
router.delete('/:id', async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const [existing] = await pool.query(
      `
      SELECT id
      FROM message_templates
      WHERE id = ? AND user_id = ?
      LIMIT 1
      `,
      [id, userId]
    );

    if (existing.length === 0) {
      return res.status(404).json({ error: 'Template não encontrado' });
    }

    await pool.query(
      `
      DELETE FROM message_templates
      WHERE id = ? AND user_id = ?
      `,
      [id, userId]
    );

    res.json({
      message: 'Template excluído com sucesso'
    });
  } catch (error) {
    console.error('Erro ao excluir template:', error.message);
    res.status(500).json({ error: 'Erro ao excluir template' });
  }
});

module.exports = router;