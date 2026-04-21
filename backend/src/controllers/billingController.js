const billingService = require('../services/billingService');

async function getMyBilling(req, res, next) {
  try {
    const overview = await billingService.getBillingOverview(req.user.id);

    res.json({
      success: true,
      data: overview
    });
  } catch (error) {
    next(error);
  }
}

async function activateSubscription(req, res, next) {
  try {
    const result = await billingService.activateSubscription({
      userId: req.user.id,
      billingType: req.body.billingType
    });

    res.status(201).json({
      success: true,
      message: 'Assinatura ativada com sucesso',
      data: result
    });
  } catch (error) {
    next(error);
  }
}

async function recalculate(req, res, next) {
  try {
    const plan = await billingService.recalculateUserPlan(req.user.id);
    const access = await billingService.refreshUserAccessStatus(req.user.id);

    res.json({
      success: true,
      message: 'Plano recalculado com sucesso',
      data: { plan, access }
    });
  } catch (error) {
    next(error);
  }
}

async function cancelSubscription(req, res, next) {
  try {
    const result = await billingService.cancelUserSubscription(req.user.id);

    res.json({
      success: true,
      message: 'Assinatura cancelada com sucesso',
      data: result
    });
  } catch (error) {
    next(error);
  }
}

async function listPayments(req, res, next) {
  try {
    const payments = await billingService.listUserPayments(req.user.id);

    res.json({
      success: true,
      data: payments
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getMyBilling,
  activateSubscription,
  recalculate,
  cancelSubscription,
  listPayments
};
