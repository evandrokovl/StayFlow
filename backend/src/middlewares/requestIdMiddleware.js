const crypto = require('crypto');

const REQUEST_ID_HEADER = 'x-request-id';
const SAFE_REQUEST_ID_PATTERN = /^[a-zA-Z0-9._:-]+$/;

function normalizeRequestId(value) {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();

  if (!trimmed || trimmed.length > 128) {
    return null;
  }

  if (!SAFE_REQUEST_ID_PATTERN.test(trimmed)) {
    return null;
  }

  return trimmed;
}

function requestIdMiddleware(req, res, next) {
  const incomingRequestId = normalizeRequestId(req.get(REQUEST_ID_HEADER));
  const requestId = incomingRequestId || crypto.randomUUID();

  req.id = requestId;
  req.requestId = requestId;
  res.setHeader('X-Request-Id', requestId);

  next();
}

module.exports = {
  requestIdMiddleware,
  normalizeRequestId
};
