require('dotenv').config();

const { startCronJobs } = require('./src/services/cronService');
const { startQueueWorker } = require('./src/workers/queueWorker');
const { env } = require('./src/config/env');
const logger = require('./src/utils/logger');

logger.info('Worker iniciado', {
  service: 'worker',
  environment: env.NODE_ENV
});

startQueueWorker();
startCronJobs();