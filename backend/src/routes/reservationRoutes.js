const express = require('express');
const router = express.Router();

const pool = require('../config/database');
const authMiddleware = require('../middlewares/authMiddleware');
const { requireFullBilling, requireWritableBilling } = require('../middlewares/billingAccessMiddleware');
const validate = require('../middlewares/validate');
const { createReservationSchema } = require('../schemas/reservationSchemas');
const { parsePagination, buildPaginationMeta } = require('../utils/pagination');

router.use(authMiddleware);

function normalizeOptionalText(value) {
  if (value === undefined || value === null) return null;

  const normalized = String(value).trim();
  return normalized === '' ? null : normalized;
}

function normalizeMoney(value) {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  const numericValue = Number(value);

  if (Number.isNaN(numericValue) || numericValue < 0) {
    const err = new Error('total_amount deve ser um número válido');
    err.statusCode = 400;
    throw err;
  }

  return numericValue;
}

// LISTAR RESERVAS
router.get('/', requireFullBilling, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { hasPagination, page, limit, offset } = parsePagination(req.query, {
      defaultLimit: 25,
      maxLimit: 100
    });
    const propertyId = req.query.property_id || '';

    let whereSql = 'WHERE properties.user_id = ?';
    const params = [userId];

    if (propertyId) {
      whereSql += ' AND reservations.property_id = ?';
      params.push(propertyId);
    }

    const [rows] = await pool.execute(
      `
      SELECT 
        reservations.id,
        reservations.property_id,
        properties.name AS property_name,
        reservations.guest_name,
        reservations.source,
        reservations.start_date,
        reservations.end_date,
        reservations.status,
        reservations.external_id,
        reservations.notes,
        reservations.guest_email,
        reservations.guest_phone,
        reservations.total_amount
      FROM reservations
      JOIN properties ON reservations.property_id = properties.id
      ${whereSql}
      ORDER BY reservations.start_date ASC, reservations.id DESC
      ${hasPagination ? 'LIMIT ? OFFSET ?' : ''}
      `,
      hasPagination ? [...params, limit, offset] : params
    );

    if (!hasPagination) {
      return res.json(rows);
    }

    const [countRows] = await pool.execute(
      `
      SELECT COUNT(*) AS total
      FROM reservations
      JOIN properties ON reservations.property_id = properties.id
      ${whereSql}
      `,
      params
    );

    return res.json({
      data: rows,
      pagination: buildPaginationMeta(countRows[0]?.total, page, limit)
    });
  } catch (error) {
    next(error);
  }
});

// CRIAR RESERVA OU BLOQUEIO
router.post('/', requireWritableBilling, validate(createReservationSchema), async (req, res, next) => {
  let connection;

  try {
    const userId = req.user.id;

    const {
      property_id,
      guest_name,
      start_date,
      end_date,
      type,
      guest_email,
      guest_phone,
      notes,
      total_amount
    } = req.body;

    const [properties] = await pool.query(
      `
      SELECT id
      FROM properties
      WHERE id = ? AND user_id = ?
      LIMIT 1
      `,
      [property_id, userId]
    );

    if (properties.length === 0) {
      const err = new Error('Imóvel não encontrado');
      err.statusCode = 404;
      throw err;
    }

    const source = type === 'blocked' ? 'blocked' : 'manual';
    const safeGuestName =
      source === 'blocked'
        ? normalizeOptionalText(guest_name) || 'Bloqueio'
        : normalizeOptionalText(guest_name);

    const safeGuestEmail = normalizeOptionalText(guest_email);
    const safeGuestPhone = normalizeOptionalText(guest_phone);
    const safeNotes = normalizeOptionalText(notes);
    const numericTotalAmount = normalizeMoney(total_amount);

    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [result] = await connection.query(
      `
      INSERT INTO reservations (
        property_id,
        guest_name,
        source,
        start_date,
        end_date,
        status,
        notes,
        guest_email,
        guest_phone,
        total_amount
      ) VALUES (?, ?, ?, ?, ?, 'confirmed', ?, ?, ?, ?)
      `,
      [
        property_id,
        safeGuestName,
        source,
        start_date,
        end_date,
        safeNotes,
        safeGuestEmail,
        safeGuestPhone,
        numericTotalAmount
      ]
    );

    const reservationId = result.insertId;

    if (source === 'manual' && numericTotalAmount !== null && numericTotalAmount > 0) {
      await connection.query(
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
        ) VALUES (?, ?, ?, 'income', 'reserva', ?, ?, ?, 'paid', 'manual')
        `,
        [
          userId,
          property_id,
          reservationId,
          `Receita da reserva #${reservationId}`,
          numericTotalAmount,
          start_date
        ]
      );
    }

    await connection.commit();

    res.status(201).json({
      success: true,
      message: 'Reserva criada com sucesso',
      reservation_id: reservationId
    });
  } catch (error) {
    if (connection) {
      await connection.rollback();
    }

    next(error);
  } finally {
    if (connection) {
      connection.release();
    }
  }
});

module.exports = router;
