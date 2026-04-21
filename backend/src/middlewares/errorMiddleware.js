const logger = require('../utils/logger');

function errorMiddleware(err, req, res, next) {
  const statusCode = err.statusCode || 500;

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
    message: err.message || 'Erro interno do servidor',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
}

module.exports = errorMiddleware;