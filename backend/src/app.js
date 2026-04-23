const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

const pool = require('./config/database');
const { env } = require('./config/env');
const logger = require('./utils/logger');

const icalRoutes = require('./routes/icalRoutes');
const propertyRoutes = require('./routes/propertyRoutes');
const reservationRoutes = require('./routes/reservationRoutes');
const authRoutes = require('./routes/authRoutes');
const syncRoutes = require('./routes/syncRoutes');
const inboundEmailRoutes = require('./routes/inboundEmailRoutes');
const systemLogRoutes = require('./routes/systemLogRoutes');

const messageTemplateRoutes = require('./routes/messageTemplateRoutes');
const messageAutomationRoutes = require('./routes/messageAutomationRoutes');
const messageLogRoutes = require('./routes/messageLogRoutes');
const financialRoutes = require('./routes/financialRoutes');
const billingRoutes = require('./routes/billingRoutes');
const asaasWebhookRoutes = require('./routes/asaasWebhookRoutes');

const notFoundMiddleware = require('./middlewares/notFoundMiddleware');
const errorMiddleware = require('./middlewares/errorMiddleware');

const app = express();

app.disable('x-powered-by');

const allowedCorsOrigins = Array.from(new Set([
  'https://app.stayflowapp.online',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'null',
  ...env.CORS_ORIGINS
]));

const corsOptions = {
  origin(origin, callback) {
    if (!origin) {
      return callback(null, true);
    }

    if (allowedCorsOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(new Error('Origem nao permitida pelo CORS'));
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  optionsSuccessStatus: 204
};

app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' }
}));

app.use(cors(corsOptions));
app.options(/.*/, cors(corsOptions));

app.use(express.json({ limit: '2mb' }));

app.use('/auth', authRoutes);
app.use('/ical', icalRoutes);
app.use('/properties', propertyRoutes);
app.use('/reservations', reservationRoutes);
app.use('/sync', syncRoutes);
app.use('/inbound-emails', inboundEmailRoutes);
app.use('/system-logs', systemLogRoutes);

app.use('/message-templates', messageTemplateRoutes);
app.use('/message-automations', messageAutomationRoutes);
app.use('/message-logs', messageLogRoutes);
app.use('/financial', financialRoutes);
app.use('/billing', billingRoutes);
app.use('/webhooks', asaasWebhookRoutes);

app.get('/', (req, res) => {
  res.send('API funcionando 🚀');
});

app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');

    return res.status(200).json({
      success: true,
      status: 'ok',
      service: 'api'
    });
  } catch (error) {
    logger.error('Health check falhou', {
      service: 'api',
      scope: 'health',
      error
    });

    return res.status(500).json({
      success: false,
      status: 'degraded',
      service: 'api',
      message: 'Servico temporariamente indisponivel'
    });
  }
});

app.use(notFoundMiddleware);
app.use(errorMiddleware);

module.exports = app;
