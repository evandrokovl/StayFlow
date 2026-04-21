const axios = require('axios');
const { env } = require('../config/env');

function normalizeBaseUrl() {
  return String(env.ASAAS_BASE_URL || 'https://api-sandbox.asaas.com/v3').replace(/\/$/, '');
}

function buildAsaasError(error, fallbackMessage) {
  const responseData = error.response?.data;
  const remoteErrors = Array.isArray(responseData?.errors)
    ? responseData.errors.map((item) => item.description || item.message).filter(Boolean)
    : [];

  const err = new Error(remoteErrors[0] || responseData?.message || error.message || fallbackMessage);
  err.statusCode = error.response?.status || 502;
  err.provider = 'ASAAS';
  err.details = responseData || null;
  return err;
}

function client() {
  if (!env.ASAAS_API_KEY) {
    const err = new Error('ASAAS_API_KEY nao configurada');
    err.statusCode = 500;
    throw err;
  }

  return axios.create({
    baseURL: normalizeBaseUrl(),
    timeout: 15000,
    headers: {
      access_token: env.ASAAS_API_KEY,
      'Content-Type': 'application/json',
      Accept: 'application/json'
    }
  });
}

function cleanPayload(payload) {
  if (!payload || typeof payload !== 'object') return payload;
  return Object.fromEntries(
    Object.entries(payload).filter(([, value]) => value !== undefined && value !== null && value !== '')
  );
}

async function request(method, url, payload, fallbackMessage) {
  try {
    const config = {
      method,
      url
    };

    if (!['get', 'delete'].includes(String(method).toLowerCase())) {
      config.data = cleanPayload(payload);
    }

    const response = await client().request(config);

    return response.data;
  } catch (error) {
    throw buildAsaasError(error, fallbackMessage);
  }
}

async function createCustomer(user) {
  return request('post', '/customers', {
    name: user.name,
    email: user.email,
    cpfCnpj: user.cpf_cnpj || user.cpf,
    mobilePhone: user.phone,
    phone: user.phone,
    externalReference: `user:${user.id}`
  }, 'Erro ao criar cliente na Asaas');
}

async function createSubscription({ customerId, billingType, value, nextDueDate, description, externalReference }) {
  return request('post', '/subscriptions', {
    customer: customerId,
    billingType,
    nextDueDate,
    value,
    cycle: 'MONTHLY',
    description,
    externalReference
  }, 'Erro ao criar assinatura na Asaas');
}

async function updateSubscription(subscriptionId, payload) {
  return request('put', `/subscriptions/${subscriptionId}`, payload, 'Erro ao atualizar assinatura na Asaas');
}

async function getSubscriptionPayments(subscriptionId) {
  return request('get', `/subscriptions/${subscriptionId}/payments`, null, 'Erro ao buscar pagamentos da assinatura');
}

async function getPayment(paymentId) {
  return request('get', `/payments/${paymentId}`, null, 'Erro ao buscar pagamento na Asaas');
}

async function cancelSubscription(subscriptionId) {
  return request('delete', `/subscriptions/${subscriptionId}`, null, 'Erro ao cancelar assinatura na Asaas');
}

module.exports = {
  createCustomer,
  createSubscription,
  updateSubscription,
  getSubscriptionPayments,
  getPayment,
  cancelSubscription
};
