const { Queue } = require('bullmq');
const crypto = require('crypto');
const { env } = require('../config/env');
const { getRedisConnection } = require('../config/redis');

const connection = getRedisConnection();

const queueName = `${env.QUEUE_PREFIX}_jobs`;

const jobQueue = new Queue(queueName, {
  connection,
  defaultJobOptions: {
    removeOnComplete: 200,
    removeOnFail: 500,
    attempts: 4,
    backoff: {
      type: 'exponential',
      delay: 3000
    }
  }
});

function hashPayload(payload) {
  return crypto
    .createHash('sha256')
    .update(JSON.stringify(payload || {}))
    .digest('hex');
}

function sanitizeIdPart(value) {
  return String(value || '')
    .replace(/[:\s\\/]+/g, '_')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .slice(0, 120);
}

async function enqueueInboundResendWebhook(payload) {
  const event = payload || {};
  const data = event.data || {};
  const emailId = data.email_id || data.id || null;

  const jobId = emailId
    ? `inbound_resend_${sanitizeIdPart(emailId)}`
    : `inbound_resend_${hashPayload(payload).slice(0, 32)}`;

  return jobQueue.add(
    'inbound_resend',
    { payload: event },
    {
      jobId
    }
  );
}

async function enqueueAsaasWebhookEvent({ eventId, eventType, payload }) {
  return jobQueue.add(
    'asaas_webhook',
    { eventId, eventType, payload },
    {
      jobId: `asaas_webhook_${sanitizeIdPart(eventId)}`
    }
  );
}

async function enqueueSyncAllProperties() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

  return jobQueue.add(
    'sync_all_properties',
    {},
    {
      jobId: `sync_all_properties_${timestamp}`
    }
  );
}

async function enqueueProcessMessageAutomations(userId = null) {
  const suffix = userId ? `user_${sanitizeIdPart(userId)}` : 'all';
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

  return jobQueue.add(
    'process_message_automations',
    { userId },
    {
      jobId: `process_message_automations_${suffix}_${timestamp}`
    }
  );
}

module.exports = {
  jobQueue,
  queueName,
  enqueueInboundResendWebhook,
  enqueueAsaasWebhookEvent,
  enqueueSyncAllProperties,
  enqueueProcessMessageAutomations
};
