function validate(schema) {
  return (req, res, next) => {
    try {
      const validated = schema.parse({
        body: req.body,
        params: req.params,
        query: req.query
      });

      req.body = validated.body;
      req.params = validated.params;
      req.query = validated.query;

      next();
    } catch (error) {
      const details = Array.isArray(error.issues)
        ? error.issues.map((issue) => ({
            field: issue.path.join('.'),
            message: issue.message
          }))
        : [];

      return res.status(400).json({
        success: false,
        requestId: req.requestId || req.id || null,
        message: 'Erro de validação',
        errors: details
      });
    }
  };
}

module.exports = validate;
