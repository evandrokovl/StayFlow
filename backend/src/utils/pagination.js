function parsePagination(query = {}, options = {}) {
  const defaultLimit = Number(options.defaultLimit || 25);
  const maxLimit = Number(options.maxLimit || 100);
  const hasPagination = query.page !== undefined || query.limit !== undefined;

  const page = Math.max(1, Number.parseInt(query.page || '1', 10) || 1);
  const requestedLimit = Number.parseInt(query.limit || String(defaultLimit), 10) || defaultLimit;
  const limit = Math.min(Math.max(1, requestedLimit), maxLimit);
  const offset = (page - 1) * limit;

  return {
    hasPagination,
    page,
    limit,
    offset
  };
}

function buildPaginationMeta(total, page, limit) {
  const safeTotal = Number(total || 0);
  const totalPages = Math.max(1, Math.ceil(safeTotal / limit));

  return {
    total: safeTotal,
    page,
    limit,
    totalPages
  };
}

module.exports = {
  parsePagination,
  buildPaginationMeta
};
