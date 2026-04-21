const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const authMiddleware = require('../middlewares/authMiddleware');

router.use(authMiddleware);

// LISTAR LANÇAMENTOS
router.get('/', async (req, res) => {
  try {
    const userId = req.user.id;
    const { property_id, type, status, month, reservation_id } = req.query;

    let sql = `
      SELECT
        f.id,
        f.user_id,
        f.property_id,
        f.reservation_id,
        f.type,
        f.category,
        f.description,
        f.amount,
        f.entry_date,
        f.status,
        f.source,
        f.created_at,
        f.updated_at,
        p.name AS property_name,
        r.guest_name
      FROM financial_entries f
      JOIN properties p ON f.property_id = p.id
      LEFT JOIN reservations r ON f.reservation_id = r.id
      WHERE f.user_id = ?
    `;

    const params = [userId];

    if (property_id) {
      sql += ' AND f.property_id = ?';
      params.push(property_id);
    }

    if (reservation_id) {
      sql += ' AND f.reservation_id = ?';
      params.push(reservation_id);
    }

    if (type) {
      sql += ' AND f.type = ?';
      params.push(type);
    }

    if (status) {
      sql += ' AND f.status = ?';
      params.push(status);
    }

    if (month) {
      sql += ' AND DATE_FORMAT(f.entry_date, "%Y-%m") = ?';
      params.push(month);
    }

    sql += ' ORDER BY f.entry_date DESC, f.id DESC';

    const [rows] = await pool.query(sql, params);

    res.json(rows);
  } catch (error) {
    console.error('Erro ao listar lançamentos financeiros:', error.message);
    res.status(500).json({ error: 'Erro ao listar lançamentos financeiros' });
  }
});

// RESUMO GERAL
router.get('/summary', async (req, res) => {
  try {
    const userId = req.user.id;
    const { property_id, month } = req.query;

    let sql = `
      SELECT
        COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) AS total_income,
        COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) AS total_expense,
        COALESCE(SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END), 0) AS total_pending
      FROM financial_entries
      WHERE user_id = ?
    `;

    const params = [userId];

    if (property_id) {
      sql += ' AND property_id = ?';
      params.push(property_id);
    }

    if (month) {
      sql += ' AND DATE_FORMAT(entry_date, "%Y-%m") = ?';
      params.push(month);
    }

    const [rows] = await pool.query(sql, params);

    const summary = rows[0] || {
      total_income: 0,
      total_expense: 0,
      total_pending: 0
    };

    const totalIncome = Number(summary.total_income || 0);
    const totalExpense = Number(summary.total_expense || 0);
    const totalPending = Number(summary.total_pending || 0);

    res.json({
      total_income: totalIncome,
      total_expense: totalExpense,
      total_pending: totalPending,
      profit: totalIncome - totalExpense
    });
  } catch (error) {
    console.error('Erro ao gerar resumo financeiro:', error.message);
    res.status(500).json({ error: 'Erro ao gerar resumo financeiro' });
  }
});

// RESUMO POR RESERVA
router.get('/by-reservation/:id', async (req, res) => {
  try {
    const userId = req.user.id;
    const reservationId = Number(req.params.id);

    if (Number.isNaN(reservationId)) {
      return res.status(400).json({ error: 'ID de reserva inválido' });
    }

    const [reservations] = await pool.query(
      `
      SELECT
        r.id,
        r.property_id,
        r.guest_name,
        r.source,
        r.start_date,
        r.end_date,
        r.status,
        r.notes,
        r.guest_email,
        r.guest_phone,
        r.total_amount,
        p.name AS property_name
      FROM reservations r
      JOIN properties p ON r.property_id = p.id
      WHERE r.id = ?
        AND p.user_id = ?
      LIMIT 1
      `,
      [reservationId, userId]
    );

    if (reservations.length === 0) {
      return res.status(404).json({ error: 'Reserva não encontrada' });
    }

    const reservation = reservations[0];

    const [entries] = await pool.query(
      `
      SELECT
        id,
        reservation_id,
        property_id,
        type,
        category,
        description,
        amount,
        entry_date,
        status,
        source
      FROM financial_entries
      WHERE user_id = ?
        AND reservation_id = ?
      ORDER BY entry_date ASC, id ASC
      `,
      [userId, reservationId]
    );

    const totalIncome = entries
      .filter((item) => item.type === 'income')
      .reduce((sum, item) => sum + Number(item.amount || 0), 0);

    const totalExpense = entries
      .filter((item) => item.type === 'expense')
      .reduce((sum, item) => sum + Number(item.amount || 0), 0);

    const totalPending = entries
      .filter((item) => item.status === 'pending')
      .reduce((sum, item) => sum + Number(item.amount || 0), 0);

    res.json({
      reservation,
      entries,
      summary: {
        total_income: totalIncome,
        total_expense: totalExpense,
        total_pending: totalPending,
        profit: totalIncome - totalExpense
      }
    });
  } catch (error) {
    console.error('Erro ao gerar resumo financeiro por reserva:', error.message);
    res.status(500).json({ error: 'Erro ao gerar resumo financeiro por reserva' });
  }
});

// CRIAR LANÇAMENTO
router.post('/', async (req, res) => {
  try {
    const userId = req.user.id;

    const {
      property_id,
      reservation_id,
      type,
      category,
      description,
      amount,
      entry_date,
      status,
      source
    } = req.body;

    if (!property_id || !type || amount === undefined || !entry_date) {
      return res.status(400).json({
        error: 'property_id, type, amount e entry_date são obrigatórios'
      });
    }

    if (!['income', 'expense'].includes(type)) {
      return res.status(400).json({
        error: 'type deve ser income ou expense'
      });
    }

    const numericAmount = Number(amount);

    if (Number.isNaN(numericAmount) || numericAmount <= 0) {
      return res.status(400).json({
        error: 'amount deve ser um número maior que zero'
      });
    }

    const [properties] = await pool.query(
      `
      SELECT id
      FROM properties
      WHERE id = ?
        AND user_id = ?
      LIMIT 1
      `,
      [property_id, userId]
    );

    if (properties.length === 0) {
      return res.status(404).json({ error: 'Imóvel não encontrado' });
    }

    let validReservationId = null;

    if (reservation_id) {
      const [reservations] = await pool.query(
        `
        SELECT r.id
        FROM reservations r
        JOIN properties p ON r.property_id = p.id
        WHERE r.id = ?
          AND p.user_id = ?
        LIMIT 1
        `,
        [reservation_id, userId]
      );

      if (reservations.length === 0) {
        return res.status(404).json({ error: 'Reserva não encontrada' });
      }

      validReservationId = reservation_id;
    }

    const [result] = await pool.query(
      `
      INSERT INTO financial_entries (
        user_id,
        property_id,
        reservation_id,
        type,
        category,
        description,
        amount,
        entry_date,
        status,
        source
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        userId,
        property_id,
        validReservationId,
        type,
        category || null,
        description || null,
        numericAmount,
        entry_date,
        status === 'pending' ? 'pending' : 'paid',
        source || null
      ]
    );

    const [entries] = await pool.query(
      `
      SELECT
        f.*,
        p.name AS property_name,
        r.guest_name
      FROM financial_entries f
      JOIN properties p ON f.property_id = p.id
      LEFT JOIN reservations r ON f.reservation_id = r.id
      WHERE f.id = ?
        AND f.user_id = ?
      LIMIT 1
      `,
      [result.insertId, userId]
    );

    res.status(201).json({
      message: 'Lançamento financeiro criado com sucesso',
      entry: entries[0]
    });
  } catch (error) {
    console.error('Erro ao criar lançamento financeiro:', error.message);
    res.status(500).json({ error: 'Erro ao criar lançamento financeiro' });
  }
});

// ATUALIZAR LANÇAMENTO
router.put('/:id', async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const {
      property_id,
      reservation_id,
      type,
      category,
      description,
      amount,
      entry_date,
      status,
      source
    } = req.body;

    const [existing] = await pool.query(
      `
      SELECT id
      FROM financial_entries
      WHERE id = ?
        AND user_id = ?
      LIMIT 1
      `,
      [id, userId]
    );

    if (existing.length === 0) {
      return res.status(404).json({ error: 'Lançamento não encontrado' });
    }

    if (!property_id || !type || amount === undefined || !entry_date) {
      return res.status(400).json({
        error: 'property_id, type, amount e entry_date são obrigatórios'
      });
    }

    if (!['income', 'expense'].includes(type)) {
      return res.status(400).json({
        error: 'type deve ser income ou expense'
      });
    }

    const numericAmount = Number(amount);

    if (Number.isNaN(numericAmount) || numericAmount <= 0) {
      return res.status(400).json({
        error: 'amount deve ser um número maior que zero'
      });
    }

    const [properties] = await pool.query(
      `
      SELECT id
      FROM properties
      WHERE id = ?
        AND user_id = ?
      LIMIT 1
      `,
      [property_id, userId]
    );

    if (properties.length === 0) {
      return res.status(404).json({ error: 'Imóvel não encontrado' });
    }

    let validReservationId = null;

    if (reservation_id) {
      const [reservations] = await pool.query(
        `
        SELECT r.id
        FROM reservations r
        JOIN properties p ON r.property_id = p.id
        WHERE r.id = ?
          AND p.user_id = ?
        LIMIT 1
        `,
        [reservation_id, userId]
      );

      if (reservations.length === 0) {
        return res.status(404).json({ error: 'Reserva não encontrada' });
      }

      validReservationId = reservation_id;
    }

    await pool.query(
      `
      UPDATE financial_entries
      SET
        property_id = ?,
        reservation_id = ?,
        type = ?,
        category = ?,
        description = ?,
        amount = ?,
        entry_date = ?,
        status = ?,
        source = ?,
        updated_at = NOW()
      WHERE id = ?
        AND user_id = ?
      `,
      [
        property_id,
        validReservationId,
        type,
        category || null,
        description || null,
        numericAmount,
        entry_date,
        status === 'pending' ? 'pending' : 'paid',
        source || null,
        id,
        userId
      ]
    );

    const [entries] = await pool.query(
      `
      SELECT
        f.*,
        p.name AS property_name,
        r.guest_name
      FROM financial_entries f
      JOIN properties p ON f.property_id = p.id
      LEFT JOIN reservations r ON f.reservation_id = r.id
      WHERE f.id = ?
        AND f.user_id = ?
      LIMIT 1
      `,
      [id, userId]
    );

    res.json({
      message: 'Lançamento atualizado com sucesso',
      entry: entries[0]
    });
  } catch (error) {
    console.error('Erro ao atualizar lançamento financeiro:', error.message);
    res.status(500).json({ error: 'Erro ao atualizar lançamento financeiro' });
  }
});

// EXCLUIR LANÇAMENTO
router.delete('/:id', async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const [existing] = await pool.query(
      `
      SELECT id
      FROM financial_entries
      WHERE id = ?
        AND user_id = ?
      LIMIT 1
      `,
      [id, userId]
    );

    if (existing.length === 0) {
      return res.status(404).json({ error: 'Lançamento não encontrado' });
    }

    await pool.query(
      `
      DELETE FROM financial_entries
      WHERE id = ?
        AND user_id = ?
      `,
      [id, userId]
    );

    res.json({ message: 'Lançamento excluído com sucesso' });
  } catch (error) {
    console.error('Erro ao excluir lançamento financeiro:', error.message);
    res.status(500).json({ error: 'Erro ao excluir lançamento financeiro' });
  }
});

module.exports = router;