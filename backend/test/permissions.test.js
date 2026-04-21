const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const { srcPath, withRoute, requestJson } = require('./helpers');

test('sync nega sincronizacao de imovel de outro usuario', async () => {
  let syncCalled = false;
  const token = jwt.sign({ id: 1, email: 'user@test.com' }, 'test-secret');

  const pool = {
    async query(sql, params) {
      if (sql.includes('SELECT id, user_id') && sql.includes('FROM properties')) {
        assert.equal(params[0], '99');
        return [[{ id: 99, user_id: 2 }]];
      }

      throw new Error(`Query nao mockada: ${sql}`);
    }
  };

  await withRoute(
    srcPath('routes', 'syncRoutes.js'),
    '/sync',
    async (baseUrl) => {
      const response = await requestJson(`${baseUrl}/sync/99`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      assert.equal(response.status, 403);
      assert.equal(syncCalled, false);
    },
    {
      mocks: {
        [srcPath('config', 'database.js')]: pool,
        [srcPath('config', 'env.js')]: {
          env: {
            JWT_SECRET: 'test-secret',
            LOG_LEVEL: 'error'
          }
        },
        [srcPath('services', 'syncService.js')]: {
          async syncAllProperties() {},
          async syncOneProperty() {
            syncCalled = true;
            return { success: true };
          }
        },
        [srcPath('utils', 'logger.js')]: {
          info() {},
          warn() {},
          error() {}
        }
      }
    }
  );
});
