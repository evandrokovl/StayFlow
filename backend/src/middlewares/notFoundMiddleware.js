function notFoundMiddleware(req, res, next) {
  const error = new Error('Rota nao encontrada');
  error.statusCode = 404;
  next(error);
}

module.exports = notFoundMiddleware;