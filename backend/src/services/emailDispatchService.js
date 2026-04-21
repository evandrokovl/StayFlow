const { Resend } = require('resend');
const logger = require('../utils/logger');
const pool = require('../config/database');
const { env } = require('../config/env');
const { jobQueue } = require('../queues/jobQueue');

function normalizeContact(value) {
  if (value === undefined || value === null) return null;

  const normalized = String(value).trim();
  return normalized === '' ? null : normalized;
}

async function sendGuestEmailFromLog(messageLogId) {
  if (!env.RESEND_API_KEY) {
    throw new Error('RESEND_API_KEY não configurada');
  }

  const resend = new Resend(env.RESEND_API_KEY);
  const emailFrom = env.EMAIL_FROM || 'StayFlow <noreply@stayflowapp.online>';

  logger.info('Processando envio de email', {
    service: 'email-dispatch',
    messageLogId
  });

  const [rows] = await pool.execute(
    `
    SELECT 
      id,
      guest_contact,
      subject,
      body_rendered,
      status,
      channel,
      scheduled_for
    FROM message_logs
    WHERE id = ?
    LIMIT 1
    `,
    [messageLogId]
  );

  if (!rows.length) {
    throw new Error(`Message log ${messageLogId} não encontrado`);
  }

  const message = rows[0];
  const to = normalizeContact(message.guest_contact);

  if (message.status === 'sent') {
    logger.info('Email já enviado anteriormente', {
      service: 'email-dispatch',
      messageLogId
    });

    return {
      success: true,
      skipped: true,
      reason: 'already_sent'
    };
  }

  if (message.channel && message.channel !== 'email') {
    logger.warn('Tentativa de envio por canal não suportado neste dispatcher', {
      service: 'email-dispatch',
      messageLogId,
      channel: message.channel
    });

    await pool.execute(
      `
      UPDATE message_logs
      SET status = 'failed',
          processed_at = NOW(),
          error_message = ?
      WHERE id = ?
      `,
      ['Canal não suportado para envio por email', messageLogId]
    );

    return {
      success: false,
      skipped: true,
      reason: 'unsupported_channel'
    };
  }

  if (!to) {
    logger.warn('Mensagem sem contato de hóspede. Marcando como needs_contact', {
      service: 'email-dispatch',
      messageLogId
    });

    await pool.execute(
      `
      UPDATE message_logs
      SET status = 'needs_contact',
          processed_at = NULL,
          error_message = ?
      WHERE id = ?
      `,
      ['Hóspede sem email disponível para automação de email', messageLogId]
    );

    return {
      success: false,
      skipped: true,
      reason: 'missing_contact'
    };
  }

  try {
    const response = await resend.emails.send({
      from: emailFrom,
      to,
      subject: message.subject || 'Mensagem StayFlow',
      html: message.body_rendered || ''
    });

    if (response?.error) {
      throw new Error(response.error.message || 'Resend retornou erro no envio');
    }

    const externalId = response?.data?.id || null;

    if (!externalId) {
      throw new Error('Resend não retornou ID de envio');
    }

    await pool.execute(
      `
      UPDATE message_logs
      SET status = 'sent',
          sent_at = NOW(),
          processed_at = NOW(),
          external_id = ?,
          error_message = NULL
      WHERE id = ?
      `,
      [externalId, messageLogId]
    );

    logger.info('Email enviado com sucesso', {
      service: 'email-dispatch',
      messageLogId,
      to
    });

    return {
      success: true,
      messageLogId,
      externalId
    };
  } catch (error) {
    await pool.execute(
      `
      UPDATE message_logs
      SET status = 'failed',
          processed_at = NOW(),
          error_message = ?
      WHERE id = ?
      `,
      [error.message, messageLogId]
    );

    logger.error('Erro ao enviar email', {
      service: 'email-dispatch',
      messageLogId,
      error
    });

    throw error;
  }
}

async function dispatchScheduledMessages(limit = 50) {
  const [rows] = await pool.execute(
    `
    SELECT id
    FROM message_logs
    WHERE status = 'pending'
      AND channel = 'email'
      AND scheduled_for <= NOW()
    ORDER BY scheduled_for ASC, id ASC
    LIMIT ?
    `,
    [Number(limit) || 50]
  );

  let queued = 0;

  for (const row of rows) {
    const messageLogId = row.id;

    const [updateResult] = await pool.execute(
      `
      UPDATE message_logs
      SET status = 'queued',
          processed_at = NOW(),
          error_message = NULL
      WHERE id = ?
        AND status = 'pending'
      `,
      [messageLogId]
    );

    if (updateResult.affectedRows === 0) continue;

    try {
      await jobQueue.add(
        'send_guest_email',
        { messageLogId },
        {
          jobId: `send_guest_email_${messageLogId}`,
          removeOnComplete: 200,
          removeOnFail: 500
        }
      );
    } catch (error) {
      await pool.execute(
        `
        UPDATE message_logs
        SET status = 'pending',
            processed_at = NULL,
            error_message = ?
        WHERE id = ?
        `,
        [error.message, messageLogId]
      );

      throw error;
    }

    queued++;
  }

  logger.info('Mensagens agendadas enfileiradas', {
    service: 'email-dispatch',
    queued
  });

  return {
    queued
  };
}

module.exports = {
  sendGuestEmailFromLog,
  dispatchScheduledMessages
};
