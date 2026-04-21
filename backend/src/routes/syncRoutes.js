const express = require('express');
const router = express.Router();

const pool = require('../config/database');
const { syncAllProperties, syncOneProperty } = require('../services/syncService');
const authMiddleware = require('../middlewares/authMiddleware');
const adminMiddleware = require('../middlewares/adminMiddleware');
const { requireWritableBilling } = require('../middlewares/billingAccessMiddleware');
const { createRateLimiter } = require('../middlewares/rateLimit');

const syncRateLimit = createRateLimiter({
  name: 'sync_routes',
  windowMs: 5 * 60 * 1000,
  max: 10,
  message: 'Muitas tentativas de sincronização. Aguarde alguns minutos.'
});

router.use(authMiddleware);
router.use(syncRateLimit);

function runMiddleware(middleware, req, res) {
  return new Promise((resolve, reject) => {
    middleware(req, res, (error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

router.post('/all', adminMiddleware, requireWritableBilling, async (req, res, next) => {
  try {
    await syncAllProperties();

    return res.json({
      success: true,
      message: 'Sincronização de todos os imóveis executada'
    });
  } catch (error) {
    next(error);
  }
});

router.post('/:propertyId', async (req, res, next) => {
  try {
    const { propertyId } = req.params;

    const [rows] = await pool.query(
      `
      SELECT id, user_id
      FROM properties
      WHERE id = ?
      LIMIT 1
      `,
      [propertyId]
    );

    if (!rows.length) {
      const err = new Error('Imóvel não encontrado');
      err.statusCode = 404;
      throw err;
    }

    const property = rows[0];

    if (req.user.role !== 'admin' && property.user_id !== req.user.id) {
      const err = new Error('Você não tem permissão para sincronizar este imóvel');
      err.statusCode = 403;
      throw err;
    }

    await runMiddleware(requireWritableBilling, req, res);

    const result = await syncOneProperty(propertyId);

    if (!result.success) {
      const err = new Error(result.message || 'Erro ao sincronizar imóvel');
      err.statusCode = 400;
      throw err;
    }

    return res.json(result);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
