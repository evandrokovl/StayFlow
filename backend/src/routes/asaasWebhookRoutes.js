const express = require('express');
const asaasWebhookController = require('../controllers/asaasWebhookController');
const { createRateLimiter } = require('../middlewares/rateLimit');

const router = express.Router();

const asaasWebhookRateLimit = createRateLimiter({
  name: 'webhook_asaas',
  windowMs: 60 * 1000,
  max: 60,
  message: 'Muitas requisicoes no webhook Asaas. Tente novamente em instantes.'
});

router.post('/asaas', asaasWebhookRateLimit, asaasWebhookController.handleAsaasWebhook);

module.exports = router;
