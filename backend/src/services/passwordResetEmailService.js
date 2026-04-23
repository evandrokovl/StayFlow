const { env } = require('../config/env');
const { sendEmail } = require('./emailService');

function buildPasswordResetUrl(token) {
  const baseUrl = String(env.FRONTEND_BASE_URL || env.APP_BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
  return `${baseUrl}/app.html?resetToken=${encodeURIComponent(token)}`;
}

async function sendPasswordResetEmail({ to, token, expiresAt }) {
  const resetUrl = buildPasswordResetUrl(token);
  const expirationText = expiresAt instanceof Date
    ? expiresAt.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
    : 'em 1 hora';

  return sendEmail({
    to,
    subject: 'Redefinicao de senha - StayFlow',
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.5;color:#111827;">
        <h2>Redefina sua senha do StayFlow</h2>
        <p>Recebemos uma solicitacao para redefinir sua senha.</p>
        <p>Use o botao abaixo para criar uma nova senha. O link expira em ${expirationText}.</p>
        <p>
          <a href="${resetUrl}" style="display:inline-block;background:#111827;color:#ffffff;padding:12px 18px;border-radius:8px;text-decoration:none;font-weight:bold;">
            Redefinir senha
          </a>
        </p>
        <p>Se o botao nao abrir, copie e cole este link no navegador:</p>
        <p style="word-break:break-all;color:#2563eb;">${resetUrl}</p>
        <p>Se voce nao solicitou isso, ignore este e-mail.</p>
      </div>
    `
  });
}

module.exports = {
  buildPasswordResetUrl,
  sendPasswordResetEmail
};
