const assert = require('node:assert/strict');
const test = require('node:test');

const { srcPath, withRoute } = require('./helpers');

test('status endpoint retorna degraded sem crash quando dependencia falha', async () => {
  const statusRoutePath = srcPath('routes', 'statusRoutes.js');
  const statusServicePath = srcPath('services', 'statusService.js');

  await withRoute(statusRoutePath, '/status', async (baseUrl) => {
    const response = await fetch(`${baseUrl}/status`, {
      headers: {
        'X-Request-Id': 'status-test-1'
      }
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.status, 'degraded');
    assert.equal(body.requestId, 'status-test-1');
    assert.equal(body.checks.database.status, 'degraded');
  }, {
    beforeRoute(app) {
      const { requestIdMiddleware } = require(srcPath('middlewares', 'requestIdMiddleware.js'));
      app.use(requestIdMiddleware);
    },
    mocks: {
      [statusServicePath]: {
        async getSystemStatus({ requestId }) {
          return {
            success: false,
            status: 'degraded',
            service: 'api',
            requestId,
            timestamp: new Date().toISOString(),
            checks: {
              api: { status: 'ok' },
              database: { status: 'degraded', reason: 'ECONNREFUSED' }
            }
          };
        }
      }
    }
  });
});
