const logger = require('../utils/logger');

function errorMiddleware(err, req, res, next) {
  const statusCode = err.statusCode || 500;
  const publicMessage = statusCode >= 500
    ? 'Erro interno do servidor'
    : (err.message || 'Erro na requisicao');

  logger.error('Erro na requisição', {
    service: 'api',
    method: req.method,
    url: req.originalUrl,
    statusCode,
    message: err.message,
    stack: err.stack,
    userId: req.user?.id || null
  });

  res.status(statusCode).json({
    success: false,
    message: publicMessage
  });
}

module.exports = errorMiddleware;
