const billingService = require('../services/billingService');

function deny(message, statusCode = 403) {
  const err = new Error(message);
  err.statusCode = statusCode;
  throw err;
}

async function getAccess(userId) {
  if (typeof billingService.refreshUserAccessStatus !== 'function') {
    return {
      billingStatus: 'ACTIVE',
      accessStatus: 'FULL',
      blockReason: null
    };
  }

  return billingService.refreshUserAccessStatus(userId);
}

async function requireActiveBilling(req, res, next) {
  try {
    const access = await getAccess(req.user.id);

    if (access.accessStatus === 'BLOCKED') {
      deny(access.blockReason || 'Acesso bloqueado por billing');
    }

    next();
  } catch (error) {
    next(error);
  }
}

async function requireWritableBilling(req, res, next) {
  try {
    const access = await getAccess(req.user.id);

    if (access.accessStatus === 'BLOCKED') {
      deny(access.blockReason || 'Acesso bloqueado por billing');
    }

    if (access.accessStatus === 'READ_ONLY') {
      deny('Conta em modo somente leitura por pendencia de pagamento');
    }

    next();
  } catch (error) {
    next(error);
  }
}

async function requireFullBilling(req, res, next) {
  try {
    const access = await getAccess(req.user.id);

    if (access.accessStatus === 'BLOCKED') {
      deny(access.blockReason || 'Acesso bloqueado por billing');
    }

    if (access.accessStatus === 'READ_ONLY') {
      deny('Acesso operacional indisponivel por pendencia de pagamento');
    }

    next();
  } catch (error) {
    next(error);
  }
}

module.exports = {
  requireActiveBilling,
  requireWritableBilling,
  requireFullBilling
};
