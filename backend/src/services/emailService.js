const { Resend } = require('resend');
const logger = require('../utils/logger');
const { env } = require('../config/env');

const resend = new Resend(env.RESEND_API_KEY);

async function sendEmail({ to, subject, html }) {
  try {
    const response = await resend.emails.send({
      from: env.EMAIL_FROM || 'StayFlow <noreply@stayflowapp.online>',
      to,
      subject,
      html
    });

    logger.info('Email enviado com sucesso', {
      to,
      subject,
      resendId: response?.data?.id
    });

    return {
      success: true,
      messageId: response?.data?.id
    };

  } catch (error) {
    logger.error('Erro ao enviar email', {
      to,
      subject,
      error: error.message
    });

    return {
      success: false,
      error: error.message
    };
  }
}

module.exports = {
  sendEmail
};
