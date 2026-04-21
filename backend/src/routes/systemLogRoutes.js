const express = require('express');
const router = express.Router();

const pool = require('../config/database');
const authMiddleware = require('../middlewares/authMiddleware');
const adminMiddleware = require('../middlewares/adminMiddleware');

router.use(authMiddleware);
router.use(adminMiddleware);

// LISTAR LOGS DO SISTEMA
router.get('/', async (req, res) => {
  try {
    const {
      level,
      service,
      user_id,
      limit = 100
    } = req.query;

    let sql = `
      SELECT
        id,
        level,
        message,
        service,
        user_id,
        context_json,
        created_at
      FROM system_logs
      WHERE 1=1
    `;

    const params = [];

    if (level) {
      sql += ' AND level = ?';
      params.push(level);
    }

    if (service) {
      sql += ' AND service = ?';
      params.push(service);
    }

    if (user_id) {
      sql += ' AND user_id = ?';
      params.push(Number(user_id));
    }

    const safeLimit = Math.min(Math.max(Number(limit) || 100, 1), 500);

    sql += ' ORDER BY id DESC LIMIT ?';
    params.push(safeLimit);

    const [rows] = await pool.query(sql, params);

    const parsedRows = rows.map((item) => ({
      ...item,
      context_json: item.context_json ? tryParseJson(item.context_json) : null
    }));

    return res.json({
      success: true,
      total: parsedRows.length,
      logs: parsedRows
    });
  } catch (error) {
    console.error('Erro ao listar system_logs:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Erro ao listar logs do sistema'
    });
  }
});

function tryParseJson(value) {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

module.exports = router;