const logger = require('../utils/logger');

function errorMiddleware(err, req, res, next) {
  const statusCode = err.statusCode || 500;
  const publicMessage = statusCode >= 500
    ? 'Erro interno do servidor'
    : (err.message || 'Erro na requisicao');

  logger.error('Erro na requisição', {
    service: 'api',
    requestId: req.requestId || req.id || null,
    method: req.method,
    url: req.originalUrl,
    statusCode,
    message: err.message,
    stack: err.stack,
    userId: req.user?.id || null
  });

  res.status(statusCode).json({
    success: false,
    requestId: req.requestId || req.id || null,
    message: publicMessage
  });
}

module.exports = errorMiddleware;
