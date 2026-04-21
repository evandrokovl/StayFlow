const express = require('express');
const router = express.Router();

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const pool = require('../config/database');
const { env } = require('../config/env');

const validate = require('../middlewares/validate');
const { registerSchema, loginSchema } = require('../schemas/authSchemas');
const { createRateLimiter } = require('../middlewares/rateLimit');

// =========================
// RATE LIMITS
// =========================

const authRateLimit = createRateLimiter({
  name: 'auth_general',
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: 'Muitas tentativas na autenticação. Tente novamente em alguns minutos.'
});

const loginRateLimit = createRateLimiter({
  name: 'auth_login',
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: 'Muitas tentativas de login. Aguarde alguns minutos antes de tentar novamente.'
});

// =========================
// AUXILIAR
// =========================

function buildInboundAlias(userId) {
  return `u${userId}@${env.INBOUND_DOMAIN}`;
}

// =========================
// REGISTER
// =========================

router.post('/register', authRateLimit, validate(registerSchema), async (req, res, next) => {
  try {
    const { name, email, password } = req.body;

    const normalizedEmail = String(email).trim().toLowerCase();

    const [existingUsers] = await pool.execute(
      'SELECT id FROM users WHERE email = ? LIMIT 1',
      [normalizedEmail]
    );

    if (existingUsers.length > 0) {
      const err = new Error('Este e-mail já está cadastrado');
      err.statusCode = 400;
      throw err;
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const [result] = await pool.execute(
      `
      INSERT INTO users (name, email, password)
      VALUES (?, ?, ?)
      `,
      [name.trim(), normalizedEmail, hashedPassword]
    );

    const userId = result.insertId;
    const inboundAlias = buildInboundAlias(userId);

    await pool.execute(
      `
      UPDATE users
      SET inbound_alias = ?
      WHERE id = ?
      `,
      [inboundAlias, userId]
    );

    res.status(201).json({
      success: true,
      message: 'Usuário cadastrado com sucesso',
      data: {
        userId,
        inbound_alias: inboundAlias
      }
    });
  } catch (error) {
    next(error);
  }
});

// =========================
// LOGIN
// =========================

router.post('/login', loginRateLimit, validate(loginSchema), async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const normalizedEmail = String(email).trim().toLowerCase();

    const [users] = await pool.execute(
      'SELECT id, email, password FROM users WHERE email = ? LIMIT 1',
      [normalizedEmail]
    );

    if (users.length === 0) {
      const err = new Error('Usuário não encontrado');
      err.statusCode = 400;
      throw err;
    }

    const user = users[0];

    const passwordIsValid = await bcrypt.compare(password, user.password);

    if (!passwordIsValid) {
      const err = new Error('Senha inválida');
      err.statusCode = 400;
      throw err;
    }

    const token = jwt.sign(
      {
        id: user.id,
        email: user.email
      },
      env.JWT_SECRET,
      {
        expiresIn: '7d'
      }
    );

    res.json({
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          email: user.email
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;