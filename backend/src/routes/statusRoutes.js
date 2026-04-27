const express = require('express');

const { getSystemStatus } = require('../services/statusService');

const router = express.Router();

router.get('/', async (req, res, next) => {
  try {
    const status = await getSystemStatus({
      requestId: req.requestId || req.id || null
    });

    return res.status(200).json(status);
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
