const express = require('express');
const asaasWebhookController = require('../controllers/asaasWebhookController');

const router = express.Router();

router.post('/asaas', asaasWebhookController.handleAsaasWebhook);

module.exports = router;
