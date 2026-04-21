require('dotenv').config();

const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

async function run() {
  if (!process.env.RESEND_API_KEY) {
    console.error('❌ RESEND_API_KEY não encontrada no .env');
    process.exit(1);
  }

  const response = await resend.emails.send({
    from: 'noreply@inbound.stayflowapp.online',
    to: 'evandrokozowski@gmail.com',
    subject: 'Teste StayFlow',
    html: '<p>Funcionando 🚀</p>'
  });

  console.log('✅ Email enviado:', response);
}

run();