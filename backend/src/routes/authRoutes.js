const crypto = require('crypto');
const express = require('express');
const router = express.Router();

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const pool = require('../config/database');
const { env } = require('../config/env');
const { normalizeCpf, isValidCpf } = require('../utils/cpf');
const { sendPasswordResetEmail } = require('../services/passwordResetEmailService');
const billingService = require('../services/billingService');
const authMiddleware = require('../middlewares/authMiddleware');
const { requireActiveBilling } = require('../middlewares/billingAccessMiddleware');

const validate = require('../middlewares/validate');
const {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema
} = require('../schemas/authSchemas');
const { createRateLimiter } = require('../middlewares/rateLimit');

// =========================
// RATE LIMITS
// =========================

const authRateLimit = createRateLimiter({
  name: 'auth_general',
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: 'Muitas tentativas na autenticacao. Tente novamente em alguns minutos.'
});

const loginRateLimit = createRateLimiter({
  name: 'auth_login',
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: 'Muitas tentativas de login. Aguarde alguns minutos antes de tentar novamente.'
});

const passwordResetRateLimit = createRateLimiter({
  name: 'auth_password_reset',
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: 'Muitas tentativas de recuperacao de senha. Aguarde alguns minutos.'
});

// =========================
// AUXILIAR
// =========================

function buildInboundAlias(userId) {
  return `u${userId}@${env.INBOUND_DOMAIN}`;
}

function hashResetToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function publicForgotPasswordMessage() {
  return 'Se o e-mail estiver cadastrado, enviaremos as instrucoes para redefinir sua senha.';
}

function invalidLoginError() {
  const err = new Error('E-mail ou senha invalidos');
  err.statusCode = 400;
  return err;
}

function maskCpf(cpf) {
  const digits = normalizeCpf(cpf);
  if (digits.length !== 11) return cpf || null;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

function buildPublicUser(user) {
  const inboundAlias = user.inbound_alias || buildInboundAlias(user.id);

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    cpf: maskCpf(user.cpf),
    inbound_alias: inboundAlias,
    setup_status: inboundAlias ? 'configured' : 'pending'
  };
}

let userCpfColumnAvailable = null;

async function hasUserCpfColumn() {
  if (userCpfColumnAvailable !== null) {
    return userCpfColumnAvailable;
  }

  const [rows] = await pool.execute(
    `
    SELECT COUNT(*) AS total
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'users'
      AND COLUMN_NAME = 'cpf'
    `
  );

  userCpfColumnAvailable = Number(rows[0]?.total || 0) > 0;
  return userCpfColumnAvailable;
}

async function userSelectFields({ includePassword = false } = {}) {
  const hasCpf = await hasUserCpfColumn();
  const fields = [
    'id',
    'name',
    'email',
    hasCpf ? 'cpf' : 'NULL AS cpf',
    'inbound_alias'
  ];

  if (includePassword) {
    fields.push('password');
  }

  return fields.join(', ');
}

// =========================
// REGISTER
// =========================

router.post('/register', authRateLimit, validate(registerSchema), async (req, res, next) => {
  try {
    const { name, email, password } = req.body;
    const cpf = normalizeCpf(req.body.cpf);

    if (!isValidCpf(cpf)) {
      const err = new Error('CPF invalido');
      err.statusCode = 400;
      throw err;
    }

    const normalizedEmail = String(email).trim().toLowerCase();

    const [existingUsers] = await pool.execute(
      'SELECT id, email, cpf FROM users WHERE email = ? OR cpf = ? LIMIT 1',
      [normalizedEmail, cpf]
    );

    if (existingUsers.length > 0) {
      const existingUser = existingUsers[0];
      const err = new Error(existingUser.email === normalizedEmail
        ? 'Este e-mail ja esta cadastrado'
        : 'Este CPF ja esta cadastrado');
      err.statusCode = 400;
      throw err;
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const [result] = await pool.execute(
      `
      INSERT INTO users (name, email, cpf, password)
      VALUES (?, ?, ?, ?)
      `,
      [name.trim(), normalizedEmail, cpf, hashedPassword]
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

    await billingService.ensureTrialForUser(userId);

    res.status(201).json({
      success: true,
      message: 'Usuario cadastrado com sucesso',
      data: {
        userId,
        inbound_alias: inboundAlias
      }
    });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      error.statusCode = 400;
      error.message = String(error.message || '').includes('cpf')
        ? 'Este CPF ja esta cadastrado'
        : 'Este e-mail ja esta cadastrado';
    }
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

    const fields = await userSelectFields({ includePassword: true });

    const [users] = await pool.execute(
      `SELECT ${fields} FROM users WHERE email = ? LIMIT 1`,
      [normalizedEmail]
    );

    if (users.length === 0) {
      throw invalidLoginError();
    }

    const user = users[0];

    const passwordIsValid = await bcrypt.compare(password, user.password);

    if (!passwordIsValid) {
      throw invalidLoginError();
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
        user: buildPublicUser(user)
      }
    });
  } catch (error) {
    next(error);
  }
});

// =========================
// ME
// =========================

router.get('/me', authMiddleware, requireActiveBilling, async (req, res, next) => {
  try {
    const fields = await userSelectFields();

    const [users] = await pool.execute(
      `
      SELECT ${fields}
      FROM users
      WHERE id = ?
      LIMIT 1
      `,
      [req.user.id]
    );

    if (users.length === 0) {
      const err = new Error('Usuario nao encontrado');
      err.statusCode = 404;
      throw err;
    }

    const user = users[0];
    const inboundAlias = user.inbound_alias || buildInboundAlias(user.id);

    if (!user.inbound_alias) {
      await pool.execute(
        'UPDATE users SET inbound_alias = ? WHERE id = ?',
        [inboundAlias, user.id]
      );
    }

    res.json({
      success: true,
      data: {
        user: buildPublicUser({ ...user, inbound_alias: inboundAlias })
      }
    });
  } catch (error) {
    next(error);
  }
});

// =========================
// FORGOT PASSWORD
// =========================

router.post('/forgot-password', passwordResetRateLimit, validate(forgotPasswordSchema), async (req, res, next) => {
  try {
    const normalizedEmail = String(req.body.email).trim().toLowerCase();

    const [users] = await pool.execute(
      'SELECT id, email FROM users WHERE email = ? LIMIT 1',
      [normalizedEmail]
    );

    if (users.length === 0) {
      return res.json({
        success: true,
        message: publicForgotPasswordMessage()
      });
    }

    const user = users[0];
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = hashResetToken(rawToken);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    await pool.execute(
      `
      UPDATE password_reset_tokens
      SET used_at = NOW()
      WHERE user_id = ?
        AND used_at IS NULL
      `,
      [user.id]
    );

    await pool.execute(
      `
      INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
      VALUES (?, ?, ?)
      `,
      [user.id, tokenHash, expiresAt]
    );

    await sendPasswordResetEmail({
      to: user.email,
      token: rawToken,
      expiresAt
    });

    res.json({
      success: true,
      message: publicForgotPasswordMessage(),
      data: env.IS_PRODUCTION ? undefined : { reset_token: rawToken }
    });
  } catch (error) {
    next(error);
  }
});

// =========================
// RESET PASSWORD
// =========================

router.post('/reset-password', passwordResetRateLimit, validate(resetPasswordSchema), async (req, res, next) => {
  try {
    const { token: rawToken, password } = req.body;
    const tokenHash = hashResetToken(rawToken);

    const [tokens] = await pool.execute(
      `
      SELECT id, user_id
      FROM password_reset_tokens
      WHERE token_hash = ?
        AND used_at IS NULL
        AND expires_at > NOW()
      LIMIT 1
      `,
      [tokenHash]
    );

    if (tokens.length === 0) {
      const err = new Error('Token invalido ou expirado');
      err.statusCode = 400;
      throw err;
    }

    const resetToken = tokens[0];
    const hashedPassword = await bcrypt.hash(password, 10);

    await pool.execute(
      'UPDATE users SET password = ? WHERE id = ?',
      [hashedPassword, resetToken.user_id]
    );

    await pool.execute(
      `
      UPDATE password_reset_tokens
      SET used_at = NOW()
      WHERE id = ?
      `,
      [resetToken.id]
    );

    res.json({
      success: true,
      message: 'Senha redefinida com sucesso. Voce ja pode fazer login.'
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
