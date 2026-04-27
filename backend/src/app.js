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
const statusRoutes = require('./routes/statusRoutes');

const { requestIdMiddleware } = require('./middlewares/requestIdMiddleware');
const notFoundMiddleware = require('./middlewares/notFoundMiddleware');
const errorMiddleware = require('./middlewares/errorMiddleware');

const app = express();

app.disable('x-powered-by');
app.use(requestIdMiddleware);

const allowedCorsOrigins = Array.from(new Set([
  'https://app.stayflowapp.online',
  'https://www.stayflowapp.online',
  'https://stayflowapp.online',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  ...(env.IS_PRODUCTION ? [] : ['null']),
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
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
  exposedHeaders: ['X-Request-Id'],
  credentials: true,
  optionsSuccessStatus: 204
};

function setCorsHeaders(req, res, next) {
  const origin = req.headers.origin;

  if (origin && allowedCorsOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Vary', 'Origin');
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Methods', corsOptions.methods.join(','));
    res.header('Access-Control-Allow-Headers', corsOptions.allowedHeaders.join(','));
    res.header('Access-Control-Expose-Headers', corsOptions.exposedHeaders.join(','));
  }

  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }

  return next();
}

app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      defaultSrc: ["'none'"],
      baseUri: ["'none'"],
      formAction: ["'none'"],
      frameAncestors: ["'none'"]
    }
  },
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' }
}));

app.use(setCorsHeaders);
app.use(cors(corsOptions));

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
app.use('/status', statusRoutes);

app.get('/', (req, res) => {
  res.send('API funcionando');
});

app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');

    return res.status(200).json({
      success: true,
      status: 'ok',
      service: 'api',
      dependencies: {
        database: 'ok'
      }
    });
  } catch (error) {
    logger.error('Health check falhou', {
      service: 'api',
      scope: 'health',
      requestId: req.requestId || req.id || null,
      error
    });

    return res.status(500).json({
      success: false,
      requestId: req.requestId || req.id || null,
      status: 'degraded',
      service: 'api',
      message: 'Serviço temporariamente indisponível',
      ...(env.IS_PRODUCTION ? {} : { reason: 'database_unavailable' })
    });
  }
});

app.use(notFoundMiddleware);
app.use(errorMiddleware);

module.exports = app;
