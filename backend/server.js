require('dotenv').config();
const app = require('./src/app');
const { env } = require('./src/config/env');
const logger = require('./src/utils/logger');

app.listen(env.PORT, () => {
  logger.info('API iniciada com sucesso', {
    service: 'api',
    port: env.PORT,
    baseUrl: env.APP_BASE_URL,
    environment: env.NODE_ENV
  });
});