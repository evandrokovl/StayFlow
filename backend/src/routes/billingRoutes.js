const express = require('express');
const authMiddleware = require('../middlewares/authMiddleware');
const billingController = require('../controllers/billingController');
const validate = require('../middlewares/validate');
const { activateSubscriptionSchema } = require('../schemas/billingSchemas');

const router = express.Router();

router.use(authMiddleware);

router.get('/me', billingController.getMyBilling);
router.post('/activate-subscription', validate(activateSubscriptionSchema), billingController.activateSubscription);
router.post('/recalculate', billingController.recalculate);
router.post('/cancel-subscription', billingController.cancelSubscription);
router.get('/payments', billingController.listPayments);

module.exports = router;
