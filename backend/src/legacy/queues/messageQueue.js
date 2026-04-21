const { Queue } = require('bullmq');
const connection = require('../config/redis');
const logger = require('../utils/logger');

const messageQueue = new Queue('message-queue', {
  connection,
  defaultJobOptions: {
    attempts: 5,
    backoff: {
      type: 'exponential',
      delay: 5000
    },
    removeOnComplete: true,
    removeOnFail: false
  }
});

async function enqueueMessage(messageLogId) {
  try {
    await messageQueue.add(
      'send-message',
      { messageLogId },
      {
        jobId: `message-${messageLogId}` // evita duplicação
      }
    );

    logger.info('Mensagem enviada para fila', { messageLogId });

  } catch (error) {
    logger.error('Erro ao enfileirar mensagem', {
      messageLogId,
      error: error.message
    });
  }
}

module.exports = {
  enqueueMessage
};