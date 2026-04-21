function adminMiddleware(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({
      error: 'Acesso negado. Apenas administradores.'
    });
  }

  next();
}

module.exports = adminMiddleware;