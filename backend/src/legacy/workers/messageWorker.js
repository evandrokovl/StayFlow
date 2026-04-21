const { Worker } = require('bullmq');
const connection = require('../config/redis');
const db = require('../config/db');
const logger = require('../utils/logger');
const { sendEmail } = require('../services/emailService');

const worker = new Worker(
  'message-queue',
  async (job) => {
    const { messageLogId } = job.data;

    logger.info('Processando envio de mensagem', { messageLogId });

    try {
      // Buscar log
      const [rows] = await db.execute(
        `SELECT ml.*, mt.subject, mt.body
         FROM message_logs ml
         JOIN message_templates mt ON ml.template_id = mt.id
         WHERE ml.id = ?`,
        [messageLogId]
      );

      if (rows.length === 0) {
        throw new Error('Message log não encontrado');
      }

      const message = rows[0];

      // ⚠️ Aqui você vai melhorar depois com parser dinâmico
      const html = message.body;

      const result = await sendEmail({
        to: message.guest_email,
        subject: message.subject,
        html
      });

      if (result.success) {
        await db.execute(
          `UPDATE message_logs
           SET status = 'sent',
               sent_at = NOW(),
               external_id = ?
           WHERE id = ?`,
          [result.messageId, messageLogId]
        );

      } else {
        throw new Error(result.error);
      }

    } catch (error) {
      logger.error('Falha no envio da mensagem', {
        messageLogId,
        error: error.message
      });

      await db.execute(
        `UPDATE message_logs
         SET status = 'failed',
             error_message = ?
         WHERE id = ?`,
        [error.message, messageLogId]
      );

      throw error; // importante pro retry da fila
    }
  },
  {
    connection,
    attempts: 5,
    backoff: {
      type: 'exponential',
      delay: 5000
    }
  }
);

module.exports = worker;