const { Worker } = require('bullmq');
const { getRedisConnection } = require('../config/redis');
const { queueName } = require('../queues/jobQueue');
const { processInboundResendWebhook } = require('../services/inboundEmailProcessor');
const { syncAllProperties } = require('../services/syncService');
const { processMessageAutomations } = require('../services/messageAutomationService');
const { sendGuestEmailFromLog } = require('../services/emailDispatchService');
const { processAsaasWebhookEvent } = require('../services/asaasWebhookProcessor');
const logger = require('../utils/logger');

let workerInstance = null;

async function processJob(job) {
  switch (job.name) {
    case 'inbound_resend':
      return processInboundResendWebhook(job.data.payload);

    case 'sync_all_properties':
      return syncAllProperties();

    case 'process_message_automations':
      return processMessageAutomations(job.data.userId || null);

    case 'send_guest_email':
      return sendGuestEmailFromLog(job.data.messageLogId);

    case 'asaas_webhook':
      return processAsaasWebhookEvent(job.data);

    default:
      throw new Error(`Tipo de job não suportado: ${job.name}`);
  }
}

function startQueueWorker() {
  if (workerInstance) {
    return workerInstance;
  }

  workerInstance = new Worker(
    queueName,
    async (job) => {
      const startedAt = Date.now();

      logger.info('Iniciando processamento de job da fila', {
        service: 'queue',
        queueName,
        jobName: job.name,
        jobId: job.id,
        attemptsMade: job.attemptsMade,
        data: job.data
      });

      try {
        const result = await processJob(job);

        logger.info('Job da fila finalizado com sucesso', {
          service: 'queue',
          queueName,
          jobName: job.name,
          jobId: job.id,
          durationMs: Date.now() - startedAt,
          result
        });

        return result;
      } catch (error) {
        logger.error('Falha no processamento do job da fila', {
          service: 'queue',
          queueName,
          jobName: job.name,
          jobId: job.id,
          durationMs: Date.now() - startedAt,
          attemptsMade: job.attemptsMade,
          data: job.data,
          error: {
            message: error.message,
            stack: error.stack
          }
        });

        throw error;
      }
    },
    {
      connection: getRedisConnection(),
      concurrency: 5
    }
  );

  workerInstance.on('completed', (job) => {
    logger.info('Job concluído', {
      service: 'queue',
      queueName,
      jobName: job?.name || null,
      jobId: job?.id || null
    });
  });

  workerInstance.on('failed', (job, error) => {
    logger.error('Job falhou', {
      service: 'queue',
      queueName,
      jobName: job?.name || null,
      jobId: job?.id || null,
      attemptsMade: job?.attemptsMade || 0,
      data: job?.data || null,
      error: {
        message: error.message,
        stack: error.stack
      }
    });
  });

  workerInstance.on('error', (error) => {
    logger.error('Erro interno do worker da fila', {
      service: 'queue',
      queueName,
      error: {
        message: error.message,
        stack: error.stack
      }
    });
  });

  logger.info('Queue worker iniciado', {
    service: 'queue',
    queueName,
    concurrency: 5
  });

  return workerInstance;
}

module.exports = {
  startQueueWorker
};
