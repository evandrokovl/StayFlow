const cron = require('node-cron');
const logger = require('../utils/logger');
const { enqueueSyncAllProperties, enqueueProcessMessageAutomations } = require('../queues/jobQueue');
const { dispatchScheduledMessages } = require('./emailDispatchService');

function startCronJobs() {
  logger.info('Cron de sincronização iniciado.', {
    service: 'cron'
  });

  // Sincronização automática de iCal a cada 5 minutos
  cron.schedule('*/5 * * * *', async () => {
    try {
      logger.info('Enfileirando sincronização automática de imóveis', {
        service: 'cron',
        job: 'sync_all_properties'
      });

      await enqueueSyncAllProperties();
    } catch (error) {
      logger.error('Erro ao enfileirar sincronização automática', {
        service: 'cron',
        job: 'sync_all_properties',
        error
      });
    }
  });

  // Criação de logs de automação a cada 10 minutos
  cron.schedule('*/10 * * * *', async () => {
    try {
      logger.info('Enfileirando processamento de automações de mensagens', {
        service: 'cron',
        job: 'process_message_automations'
      });

      await enqueueProcessMessageAutomations();
    } catch (error) {
      logger.error('Erro ao enfileirar processamento de automações', {
        service: 'cron',
        job: 'process_message_automations',
        error
      });
    }
  });

  // Despacho das mensagens agendadas a cada 1 minuto
  cron.schedule('* * * * *', async () => {
    try {
      logger.info('Despachando mensagens agendadas pendentes', {
        service: 'cron',
        job: 'dispatch_scheduled_messages'
      });

      await dispatchScheduledMessages();
    } catch (error) {
      logger.error('Erro no despacho de mensagens agendadas', {
        service: 'cron',
        job: 'dispatch_scheduled_messages',
        error
      });
    }
  });
}

module.exports = {
  startCronJobs
};
