const assert = require('node:assert/strict');
const test = require('node:test');
const express = require('express');

const { requestJson, srcPath, mockModule, resetBackendModules } = require('./helpers');

test('request ID e propagado no header e em respostas de erro', async () => {
  resetBackendModules();

  const loggerCalls = [];
  mockModule(srcPath('utils', 'logger.js'), {
    error(message, meta) {
      loggerCalls.push({ message, meta });
    },
    warn() {},
    info() {},
    debug() {}
  });

  const { requestIdMiddleware } = require(srcPath('middlewares', 'requestIdMiddleware.js'));
  const errorMiddleware = require(srcPath('middlewares', 'errorMiddleware.js'));
  const app = express();

  app.use(requestIdMiddleware);
  app.get('/boom', (req, res, next) => {
    const error = new Error('Falha controlada');
    error.statusCode = 400;
    next(error);
  });
  app.use(errorMiddleware);

  const server = await new Promise((resolve) => {
    const instance = app.listen(0, () => resolve(instance));
  });

  try {
    const baseUrl = `http://127.0.0.1:${server.address().port}`;
    const response = await requestJson(`${baseUrl}/boom`, {
      headers: {
        'X-Request-Id': 'req_demo-123'
      }
    });

    assert.equal(response.status, 400);
    assert.equal(response.headers.get('x-request-id'), 'req_demo-123');
    assert.equal(response.body.requestId, 'req_demo-123');
    assert.equal(loggerCalls[0].meta.requestId, 'req_demo-123');
  } finally {
    await new Promise((resolve) => server.close(resolve));
    resetBackendModules();
  }
});

test('request ID invalido e substituido por UUID seguro', async () => {
  const { normalizeRequestId } = require(srcPath('middlewares', 'requestIdMiddleware.js'));

  assert.equal(normalizeRequestId('abc-123_:.'), 'abc-123_:.');
  assert.equal(normalizeRequestId('valor com espaco'), null);
  assert.equal(normalizeRequestId('a'.repeat(129)), null);
});
