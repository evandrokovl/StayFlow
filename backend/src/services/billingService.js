const pool = require('../config/database');
const asaasService = require('./asaasService');
const logger = require('../utils/logger');

const PLAN = {
  code: 'STAYFLOW_BASE',
  name: 'StayFlow Base',
  basePrice: 49.90,
  includedProperties: 1,
  additionalPropertyPrice: 29.90,
  currency: 'BRL',
  trialDays: 15
};

const ACTIVE_PAYMENT_STATUSES = new Set(['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH']);
const OVERDUE_PAYMENT_STATUSES = new Set(['OVERDUE']);
const CANCELED_PAYMENT_STATUSES = new Set(['REFUNDED', 'CANCELED', 'PAYMENT_DELETED']);

function addDays(date, days) {
  const output = new Date(date);
  output.setDate(output.getDate() + days);
  return output;
}

function formatDate(date) {
  return new Date(date).toISOString().slice(0, 10);
}

function toDateOrNull(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  const normalized = String(value).includes('/') ? String(value).split('/').reverse().join('-') : value;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

function normalizeBillingType(value) {
  const billingType = String(value || 'PIX').toUpperCase();
  if (!['PIX', 'BOLETO', 'CREDIT_CARD'].includes(billingType)) {
    const err = new Error('billingType deve ser PIX, BOLETO ou CREDIT_CARD');
    err.statusCode = 400;
    throw err;
  }
  return billingType;
}

function calculatePlanValue(propertyCount) {
  const activePropertiesCount = Math.max(Number(propertyCount || 0), 0);
  const additionalPropertiesCount = Math.max(activePropertiesCount - PLAN.includedProperties, 0);
  const calculatedAmount = Number(
    (PLAN.basePrice + (additionalPropertiesCount * PLAN.additionalPropertyPrice)).toFixed(2)
  );

  return {
    basePrice: PLAN.basePrice,
    includedProperties: PLAN.includedProperties,
    additionalPropertyPrice: PLAN.additionalPropertyPrice,
    activePropertiesCount,
    additionalPropertiesCount,
    calculatedAmount
  };
}

async function getActivePropertyCount(userId, connection = pool) {
  const [rows] = await connection.query(
    'SELECT COUNT(*) AS total FROM properties WHERE user_id = ?',
    [userId]
  );

  return Number(rows[0]?.total || 0);
}

async function getUser(userId, connection = pool) {
  const [rows] = await connection.query(
    `
    SELECT
      id,
      name,
      email,
      cpf,
      cpf_cnpj,
      phone,
      asaas_customer_id,
      trial_starts_at,
      trial_ends_at,
      billing_status
    FROM users
    WHERE id = ?
    LIMIT 1
    `,
    [userId]
  );

  if (!rows.length) {
    const err = new Error('Usuario nao encontrado');
    err.statusCode = 404;
    throw err;
  }

  return rows[0];
}

async function getUserBilling(userId, connection = pool) {
  const [rows] = await connection.query(
    'SELECT * FROM user_billing WHERE user_id = ? LIMIT 1',
    [userId]
  );

  return rows[0] || null;
}

async function ensureTrialForUser(userId, options = {}) {
  const externalConnection = options.connection;
  const connection = externalConnection || await pool.getConnection();

  try {
    if (!externalConnection) await connection.beginTransaction();

    const user = await getUser(userId, connection);
    const existingBilling = await getUserBilling(userId, connection);
    const now = new Date();
    const trialStartedAt = user.trial_starts_at || now;
    const trialEndsAt = user.trial_ends_at || addDays(trialStartedAt, PLAN.trialDays);
    const activePropertyCount = await getActivePropertyCount(userId, connection);
    const plan = calculatePlanValue(activePropertyCount);

    await connection.query(
      `
      UPDATE users
      SET
        trial_starts_at = COALESCE(trial_starts_at, ?),
        trial_ends_at = COALESCE(trial_ends_at, ?),
        access_expires_at = COALESCE(access_expires_at, ?),
        billing_status = COALESCE(billing_status, 'TRIAL'),
        current_plan_amount = ?,
        additional_properties_count = ?
      WHERE id = ?
      `,
      [trialStartedAt, trialEndsAt, trialEndsAt, plan.calculatedAmount, plan.additionalPropertiesCount, userId]
    );

    if (!existingBilling) {
      await connection.query(
        `
        INSERT INTO user_billing (
          user_id,
          plan_code,
          plan_name,
          base_price,
          included_properties,
          additional_property_price,
          active_properties_count,
          additional_properties_count,
          calculated_amount,
          currency,
          trial_days,
          trial_started_at,
          trial_ends_at,
          subscription_status,
          access_status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'TRIAL', 'FULL')
        `,
        [
          userId,
          PLAN.code,
          PLAN.name,
          PLAN.basePrice,
          PLAN.includedProperties,
          PLAN.additionalPropertyPrice,
          plan.activePropertiesCount,
          plan.additionalPropertiesCount,
          plan.calculatedAmount,
          PLAN.currency,
          PLAN.trialDays,
          trialStartedAt,
          trialEndsAt
        ]
      );
    }

    if (!externalConnection) await connection.commit();
    return getUserBilling(userId, externalConnection || pool);
  } catch (error) {
    if (!externalConnection) await connection.rollback();
    throw error;
  } finally {
    if (!externalConnection) connection.release();
  }
}

async function ensureAsaasCustomer(userId) {
  const user = await getUser(userId);
  if (user.asaas_customer_id) return user.asaas_customer_id;

  const customer = await asaasService.createCustomer(user);
  const customerId = customer.id;

  await pool.query(
    'UPDATE users SET asaas_customer_id = ?, last_billing_sync_at = NOW() WHERE id = ?',
    [customerId, userId]
  );

  return customerId;
}

async function getCurrentSubscription(userId, connection = pool) {
  const [rows] = await connection.query(
    `
    SELECT *
    FROM subscriptions
    WHERE user_id = ?
      AND status <> 'CANCELED'
    ORDER BY id DESC
    LIMIT 1
    `,
    [userId]
  );

  return rows[0] || null;
}

async function activateSubscription({ userId, billingType }) {
  const normalizedBillingType = normalizeBillingType(billingType);
  const billing = await ensureTrialForUser(userId);
  const customerId = await ensureAsaasCustomer(userId);
  const propertyCount = await getActivePropertyCount(userId);
  const plan = calculatePlanValue(propertyCount);
  const nextDueDate = billing.trial_ends_at && new Date(billing.trial_ends_at) > new Date()
    ? billing.trial_ends_at
    : new Date();

  const subscription = await asaasService.createSubscription({
    customerId,
    billingType: normalizedBillingType,
    value: plan.calculatedAmount,
    nextDueDate: formatDate(nextDueDate),
    description: `${PLAN.name} - ${plan.activePropertiesCount || 1} imovel(is)`,
    externalReference: `user:${userId}:plan:${PLAN.code}`
  });

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    await connection.query(
      `
      INSERT INTO subscriptions (
        user_id,
        user_billing_id,
        asaas_subscription_id,
        asaas_customer_id,
        billing_type,
        cycle,
        status,
        value,
        next_due_date,
        remote_next_due_date,
        start_date,
        last_synced_at,
        raw_response_json
      ) VALUES (?, ?, ?, ?, ?, 'MONTHLY', ?, ?, ?, ?, ?, NOW(), ?)
      `,
      [
        userId,
        billing.id,
        subscription.id,
        customerId,
        normalizedBillingType,
        subscription.status || 'PENDING',
        plan.calculatedAmount,
        subscription.nextDueDate || formatDate(nextDueDate),
        subscription.nextDueDate || formatDate(nextDueDate),
        subscription.dateCreated || formatDate(new Date()),
        JSON.stringify(subscription)
      ]
    );

    await connection.query(
      `
      UPDATE user_billing
      SET
        active_properties_count = ?,
        additional_properties_count = ?,
        calculated_amount = ?,
        subscription_status = 'ACTIVE',
        access_status = 'FULL',
        next_billing_date = ?,
        updated_at = NOW()
      WHERE id = ?
      `,
      [plan.activePropertiesCount, plan.additionalPropertiesCount, plan.calculatedAmount, subscription.nextDueDate || formatDate(nextDueDate), billing.id]
    );

    await connection.query(
      `
      UPDATE users
      SET
        asaas_customer_id = ?,
        billing_status = 'ACTIVE',
        current_plan_amount = ?,
        additional_properties_count = ?,
        access_expires_at = NULL,
        billing_block_reason = NULL,
        last_billing_sync_at = NOW()
      WHERE id = ?
      `,
      [customerId, plan.calculatedAmount, plan.additionalPropertiesCount, userId]
    );

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }

  return {
    subscription,
    amount: plan.calculatedAmount,
    nextDueDate: subscription.nextDueDate || formatDate(nextDueDate)
  };
}

async function recalculateUserPlan(userId) {
  await ensureTrialForUser(userId);
  const propertyCount = await getActivePropertyCount(userId);
  const plan = calculatePlanValue(propertyCount);
  const subscription = await getCurrentSubscription(userId);

  if (subscription?.asaas_subscription_id) {
    try {
      const remote = await asaasService.updateSubscription(subscription.asaas_subscription_id, {
        value: plan.calculatedAmount,
        description: `${PLAN.name} - ${plan.activePropertiesCount || 1} imovel(is)`,
        updatePendingPayments: false
      });

      await pool.query(
        `
        UPDATE subscriptions
        SET value = ?, last_synced_at = NOW(), raw_response_json = ?
        WHERE id = ?
        `,
        [plan.calculatedAmount, JSON.stringify(remote), subscription.id]
      );
    } catch (error) {
      logger.warn('Falha ao atualizar assinatura na Asaas durante recalculo', {
        service: 'billing',
        userId,
        error
      });
    }
  }

  await pool.query(
    `
    UPDATE user_billing
    SET
      active_properties_count = ?,
      additional_properties_count = ?,
      calculated_amount = ?,
      updated_at = NOW()
    WHERE user_id = ?
    `,
    [plan.activePropertiesCount, plan.additionalPropertiesCount, plan.calculatedAmount, userId]
  );

  await pool.query(
    `
    UPDATE users
    SET
      current_plan_amount = ?,
      additional_properties_count = ?,
      last_billing_sync_at = NOW()
    WHERE id = ?
    `,
    [plan.calculatedAmount, plan.additionalPropertiesCount, userId]
  );

  return plan;
}

async function cancelUserSubscription(userId) {
  const subscription = await getCurrentSubscription(userId);

  if (subscription?.asaas_subscription_id) {
    await asaasService.cancelSubscription(subscription.asaas_subscription_id);
  }

  await pool.query(
    `
    UPDATE subscriptions
    SET status = 'CANCELED', canceled_at = NOW(), last_synced_at = NOW()
    WHERE user_id = ?
      AND status <> 'CANCELED'
    `,
    [userId]
  );

  await pool.query(
    `
    UPDATE user_billing
    SET subscription_status = 'CANCELED', access_status = 'BLOCKED', updated_at = NOW()
    WHERE user_id = ?
    `,
    [userId]
  );

  await pool.query(
    `
    UPDATE users
    SET billing_status = 'CANCELED', billing_block_reason = 'Assinatura cancelada', last_billing_sync_at = NOW()
    WHERE id = ?
    `,
    [userId]
  );

  return { canceled: true };
}

function normalizePaymentStatus(status, eventType) {
  if (eventType === 'PAYMENT_DELETED') return 'CANCELED';
  return String(status || 'PENDING').toUpperCase();
}

async function upsertPaymentFromPayload({ userId, subscriptionId, payment, eventType }) {
  const status = normalizePaymentStatus(payment.status, eventType);

  await pool.query(
    `
    INSERT INTO payments (
      user_id,
      subscription_id,
      asaas_payment_id,
      status,
      billing_type,
      value,
      net_value,
      due_date,
      original_due_date,
      payment_date,
      confirmed_date,
      invoice_url,
      bank_slip_url,
      pix_qr_code,
      pix_copy_paste,
      description,
      raw_payload_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      status = VALUES(status),
      subscription_id = VALUES(subscription_id),
      billing_type = VALUES(billing_type),
      value = VALUES(value),
      net_value = VALUES(net_value),
      due_date = VALUES(due_date),
      original_due_date = VALUES(original_due_date),
      payment_date = VALUES(payment_date),
      confirmed_date = VALUES(confirmed_date),
      invoice_url = VALUES(invoice_url),
      bank_slip_url = VALUES(bank_slip_url),
      pix_qr_code = VALUES(pix_qr_code),
      pix_copy_paste = VALUES(pix_copy_paste),
      description = VALUES(description),
      raw_payload_json = VALUES(raw_payload_json),
      updated_at = NOW()
    `,
    [
      userId,
      subscriptionId,
      payment.id,
      status,
      payment.billingType || 'PIX',
      Number(payment.value || 0),
      payment.netValue == null ? null : Number(payment.netValue),
      payment.dueDate || formatDate(new Date()),
      payment.originalDueDate || null,
      toDateOrNull(payment.paymentDate),
      toDateOrNull(payment.confirmedDate),
      payment.invoiceUrl || null,
      payment.bankSlipUrl || payment.bankSlipUrl || null,
      payment.pixQrCode || payment.encodedImage || null,
      payment.pixCopyPaste || payment.payload || null,
      payment.description || null,
      JSON.stringify(payment)
    ]
  );

  return status;
}

async function syncPaymentStatusFromWebhook(eventPayload) {
  const eventType = eventPayload.event || eventPayload.event_type;
  const payment = eventPayload.payment || eventPayload;

  if (!payment?.id) {
    return { ignored: true, reason: 'payload sem pagamento' };
  }

  const [subscriptions] = await pool.query(
    `
    SELECT id, user_id
    FROM subscriptions
    WHERE asaas_subscription_id = ?
       OR asaas_customer_id = ?
    ORDER BY id DESC
    LIMIT 1
    `,
    [payment.subscription || '', payment.customer || '']
  );

  if (!subscriptions.length) {
    return { ignored: true, reason: 'assinatura local nao encontrada' };
  }

  const subscription = subscriptions[0];
  const status = await upsertPaymentFromPayload({
    userId: subscription.user_id,
    subscriptionId: subscription.id,
    payment,
    eventType
  });

  if (ACTIVE_PAYMENT_STATUSES.has(status)) {
    await pool.query(
      `
      UPDATE users
      SET billing_status = 'ACTIVE', access_expires_at = NULL, billing_block_reason = NULL, last_billing_sync_at = NOW()
      WHERE id = ?
      `,
      [subscription.user_id]
    );
    await pool.query(
      `
      UPDATE user_billing
      SET
        subscription_status = 'ACTIVE',
        access_status = 'FULL',
        last_payment_date = COALESCE(?, NOW()),
        last_payment_amount = ?,
        last_payment_status = ?,
        updated_at = NOW()
      WHERE user_id = ?
      `,
      [toDateOrNull(payment.paymentDate || payment.confirmedDate), Number(payment.value || 0), status, subscription.user_id]
    );
  }

  if (OVERDUE_PAYMENT_STATUSES.has(status)) {
    await pool.query(
      `
      UPDATE users
      SET billing_status = 'PAST_DUE', billing_block_reason = 'Pagamento em atraso', last_billing_sync_at = NOW()
      WHERE id = ?
      `,
      [subscription.user_id]
    );
    await pool.query(
      `
      UPDATE user_billing
      SET subscription_status = 'PAST_DUE', access_status = 'READ_ONLY', last_payment_status = ?, updated_at = NOW()
      WHERE user_id = ?
      `,
      [status, subscription.user_id]
    );
  }

  if (CANCELED_PAYMENT_STATUSES.has(status)) {
    await refreshUserAccessStatus(subscription.user_id);
  }

  return { userId: subscription.user_id, paymentId: payment.id, status };
}

async function refreshUserAccessStatus(userId) {
  await ensureTrialForUser(userId);
  const user = await getUser(userId);
  const billing = await getUserBilling(userId);
  const now = new Date();
  const trialEndsAt = toDateOrNull(user.trial_ends_at || billing?.trial_ends_at);
  let billingStatus = user.billing_status || 'TRIAL';
  let accessStatus = billing?.access_status || 'FULL';
  let blockReason = null;
  let accessExpiresAt = trialEndsAt;

  if (billingStatus === 'ACTIVE') {
    accessStatus = 'FULL';
    accessExpiresAt = null;
  } else if (billingStatus === 'PAST_DUE') {
    accessStatus = 'READ_ONLY';
    blockReason = 'Pagamento em atraso';
  } else if (billingStatus === 'CANCELED') {
    accessStatus = 'BLOCKED';
    blockReason = 'Assinatura cancelada';
  } else if (billingStatus === 'INACTIVE' || billingStatus === 'BLOCKED') {
    accessStatus = 'BLOCKED';
    blockReason = billingStatus === 'INACTIVE'
      ? 'Assinatura inativa'
      : 'Acesso bloqueado por billing';
  } else if (trialEndsAt && trialEndsAt >= now) {
    billingStatus = 'TRIAL';
    accessStatus = 'FULL';
  } else {
    billingStatus = 'BLOCKED';
    accessStatus = 'BLOCKED';
    blockReason = 'Trial expirado sem pagamento ativo';
  }

  await pool.query(
    `
    UPDATE users
    SET billing_status = ?, access_expires_at = ?, billing_block_reason = ?, last_billing_sync_at = NOW()
    WHERE id = ?
    `,
    [billingStatus, accessExpiresAt, blockReason, userId]
  );

  const billingSubscriptionStatus = ['BLOCKED', 'INACTIVE'].includes(billingStatus)
    ? 'EXPIRED'
    : billingStatus;

  await pool.query(
    `
    UPDATE user_billing
    SET access_status = ?, subscription_status = ?, updated_at = NOW()
    WHERE user_id = ?
    `,
    [accessStatus, billingSubscriptionStatus, userId]
  );

  return { billingStatus, accessStatus, blockReason, accessExpiresAt };
}

async function getBillingOverview(userId) {
  await ensureTrialForUser(userId);
  await recalculateUserPlan(userId);
  const access = await refreshUserAccessStatus(userId);
  const billing = await getUserBilling(userId);
  const subscription = await getCurrentSubscription(userId);
  const now = new Date();
  const trialEndsAt = toDateOrNull(billing?.trial_ends_at);
  const trialDaysRemaining = trialEndsAt ? Math.max(Math.ceil((trialEndsAt - now) / 86400000), 0) : 0;

  return {
    billing,
    subscription,
    access,
    trial: {
      started_at: billing?.trial_started_at,
      ends_at: billing?.trial_ends_at,
      days_remaining: trialDaysRemaining
    }
  };
}

async function listUserPayments(userId) {
  const [rows] = await pool.query(
    `
    SELECT *
    FROM payments
    WHERE user_id = ?
    ORDER BY due_date DESC, id DESC
    `,
    [userId]
  );

  return rows;
}

module.exports = {
  PLAN,
  calculatePlanValue,
  getActivePropertyCount,
  ensureTrialForUser,
  ensureAsaasCustomer,
  activateSubscription,
  recalculateUserPlan,
  cancelUserSubscription,
  syncPaymentStatusFromWebhook,
  refreshUserAccessStatus,
  getBillingOverview,
  listUserPayments
};
