function notFoundMiddleware(req, res, next) {
  const error = new Error(`Rota não encontrada: ${req.originalUrl}`);
  error.statusCode = 404;
  next(error);
}

module.exports = notFoundMiddleware;